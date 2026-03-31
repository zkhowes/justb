import { anthropic } from "./anthropic";
import { gatherAllMoments, MomentContext } from "./moments";
import { FeedItem, GlyphData, Category } from "./types";

const VALID_CATEGORIES: Set<string> = new Set<string>([
  "sky-space", "sky", "space", "nature", "local-scene", "sports", "events",
  "earth-garden", "history", "culture", "food", "community",
]);

/** Normalize common LLM misspellings/variations to valid category strings */
function normalizeCategory(raw: string): Category | null {
  const s = raw.toLowerCase().trim().replace(/_/g, "-");
  if (VALID_CATEGORIES.has(s)) return s as Category;
  // Common LLM variations
  if (s === "sky-space") return "sky"; // legacy fallback
  if (s === "garden" || s === "earth") return "earth-garden";
  if (s === "local" || s === "scene") return "local-scene";
  if (s === "event" || s === "music") return "events";
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// In-memory cache: city+date -> feed items + glyphs
const feedCache = new Map<string, { items: FeedItem[]; glyphs: GlyphData; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours

function formatMomentsForPrompt(moments: MomentContext[]): string {
  return moments
    .map((m) => `[${m.category}] (source: ${m.source})\n${m.data}`)
    .join("\n\n");
}

export async function generateFeed(
  city: string,
  date: string,
  recentTopics?: string[]
): Promise<{ items: FeedItem[]; glyphs: GlyphData }> {
  const cacheKey = `${city.toLowerCase().trim()}:${date}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { items: shuffle([...cached.items]), glyphs: cached.glyphs };
  }

  // 1. Gather structured data from all moment providers (APIs, suncalc, etc.)
  const { loc, moments, glyphs } = await gatherAllMoments(city, date);
  const momentData = formatMomentsForPrompt(moments);

  // 2. Determine which categories already have API data
  const coveredCategories = new Set(moments.map((m) => m.category));
  const llmOnlyCategories: string[] = [];
  if (!coveredCategories.has("nature")) llmOnlyCategories.push("nature(3): what's happening in nature RIGHT NOW — migrating/arriving birds, flowers blooming (daffodils, cherry blossoms, crocuses), trees budding or leafing out, seasonal fungi, tidal patterns. Be phenologically specific to this week and region. Skip if nothing specific to this week/season/place.");
  if (!coveredCategories.has("local-scene")) llmOnlyCategories.push("local-scene(1): a specific real neighborhood, park, street, or local institution (e.g. a beloved independent radio station, bookstore, coffee roaster) — NOT the city's most famous tourist landmark. Rotate through a variety of neighborhoods, parks, and local institutions — only feature the city's most famous landmark if something specific and timely is happening there. Skip if nothing specific to this week/season/place.");
  if (!coveredCategories.has("earth-garden")) llmOnlyCategories.push("earth-garden(1): pick whichever is more fascinating today — local geology (volcanic history, glacial features, fault lines, soil composition, notable rock formations) OR a timely gardening tip for the region. Vary between the two across days. Skip if nothing specific to this week/season/place.");
  if (!coveredCategories.has("food")) llmOnlyCategories.push("food/community(1): seasonal ingredient, local dish, or community tradition. Skip if nothing specific to this week/season/place.");

  // 3. Send to Claude — NO web search, just prose generation
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Write a daily feed for ${city} on ${date} (timezone: ${loc.timezone}). Return ONLY a JSON array, no markdown.

## Structured data from APIs (use this verbatim for these categories):
${momentData}

## Categories you must generate from your knowledge:
${llmOnlyCategories.join("\n")}

## Rules
- For categories with API data above, write compelling prose BASED ON that data. Don't invent different events/games.
- "sky" gets 1 item about golden hour, sunset quality, and daylight milestones. Do NOT repeat sunrise/sunset times or moon phase (shown separately in the UI glyphs).
- "space" gets 1 item about visible planets, constellations, and notable celestial objects tonight. Be specific about where to look (compass direction) and when. Do NOT repeat moon phase (shown in glyphs).
- sports gets 1 item: consolidate the game data into one engaging summary. If no sports data was provided, skip this category entirely.
- events gets 1 item: pick the 2-3 best events and highlight them. If no events data was provided, skip this category entirely.
- history gets 1 item: STRONGLY prefer an on-this-day fact with a direct connection to ${city} or its region (state, Pacific NW, etc). If none of the provided facts connect, use your own knowledge — but ONLY if you are highly confident about the specific date. If you cannot confidently tie a specific event to this exact date, write about a seasonal historical pattern for the region instead (e.g. "This time of year in the 1850s, settlers were..." or "Late March historically marked..."). NEVER fabricate or guess specific dates — getting a date wrong is worse than being general. Include indigenous history when relevant.
- If community/reddit data was provided, write 1 community item highlighting the most interesting local intel. Focus on actionable tips, timely discoveries, or useful PSAs — not complaints or generic chatter.
- If culture data was provided, use it for the culture item. Otherwise pick 1 from culture/food/community.
- Aim for 10 items, but only include what's genuinely relevant — fewer is fine. Do not pad with generic filler.
${recentTopics && recentTopics.length > 0 ? `\n## Recently covered topics (vary your coverage, avoid repeating these):\n${recentTopics.join(", ")}` : ""}

Each object: {"id":"slug","title":"5-10 words","body":"2-3 sentences plain text","category":"...","confidence":"high|medium|low","imageQuery":"specific 2-4 word Pexels search for the SINGLE most visual subject in your body text. If the body mentions multiple things (e.g. cherry blossoms AND returning swallows), pick the ONE most visually striking for the image — do NOT try to summarize everything. Examples: 'cherry blossoms branch closeup' not 'spring nature seattle', 'barn swallow flight' not 'birds flowers'. NEVER use a famous landmark unless the body is actually about that landmark. For sky-space: use the specific constellation or planet name (e.g. 'orion constellation stars' not 'night sky')."}

Tone: knowledgeable local friend. No HTML tags.`,
      },
    ],
  });

  let text = "";
  for (const block of message.content) {
    if (block.type === "text") {
      text = block.text;
      break;
    }
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse feed items from Claude response");
  }

  const rawItems = JSON.parse(jsonMatch[0]) as FeedItem[];

  // Validate and normalize categories so every card gets a pill
  const items = rawItems
    .map((item) => {
      const cat = normalizeCategory(item.category);
      if (!cat) return null;
      return { ...item, category: cat };
    })
    .filter((item): item is FeedItem => item !== null);

  feedCache.set(cacheKey, { items, glyphs, timestamp: Date.now() });

  return { items: shuffle(items), glyphs };
}
