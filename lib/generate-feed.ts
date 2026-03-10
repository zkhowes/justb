import { anthropic } from "./anthropic";
import { gatherAllMoments, MomentContext } from "./moments";
import { FeedItem } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// In-memory cache: city+date -> feed items
const feedCache = new Map<string, { items: FeedItem[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours

function formatMomentsForPrompt(moments: MomentContext[]): string {
  return moments
    .map((m) => `[${m.category}] (source: ${m.source})\n${m.data}`)
    .join("\n\n");
}

export async function generateFeed(
  city: string,
  date: string
): Promise<FeedItem[]> {
  const cacheKey = `${city.toLowerCase().trim()}:${date}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return shuffle([...cached.items]);
  }

  // 1. Gather structured data from all moment providers (APIs, suncalc, etc.)
  const { loc, moments } = await gatherAllMoments(city, date);
  const momentData = formatMomentsForPrompt(moments);

  // 2. Determine which categories already have API data
  const coveredCategories = new Set(moments.map((m) => m.category));
  const llmOnlyCategories: string[] = [];
  if (!coveredCategories.has("nature")) llmOnlyCategories.push("nature(2): what's happening in nature RIGHT NOW — migrating/arriving birds, flowers blooming (daffodils, cherry blossoms, crocuses), trees budding or leafing out, seasonal fungi, tidal patterns. Be phenologically specific to this week and region.");
  if (!coveredCategories.has("local-scene")) llmOnlyCategories.push("local-scene(1): a specific real neighborhood, park, street, or local institution (e.g. a beloved independent radio station, bookstore, coffee roaster) — NOT the city's most famous tourist landmark. Rotate through lesser-known spots.");
  if (!coveredCategories.has("earth-garden")) llmOnlyCategories.push("earth-garden(1): pick whichever is more fascinating today — local geology (volcanic history, glacial features, fault lines, soil composition, notable rock formations) OR a timely gardening tip for the region. Vary between the two across days.");
  if (!coveredCategories.has("food")) llmOnlyCategories.push("food/community(1): seasonal ingredient, local dish, or community tradition");

  // 3. Send to Claude — NO web search, just prose generation
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Write a daily feed of 10 items for ${city} on ${date} (timezone: ${loc.timezone}). Return ONLY a JSON array, no markdown.

## Structured data from APIs (use this verbatim for these categories):
${momentData}

## Categories you must generate from your knowledge:
${llmOnlyCategories.join("\n")}

## Rules
- For categories with API data above, write compelling prose BASED ON that data. Don't invent different events/games.
- sky-space gets 2 items (one moon/sun from the data, one about visible planets/constellations for the season)
- sports gets 1 item: consolidate the game data into one engaging summary
- events gets 1 item: pick the 2-3 best events and highlight them
- history gets 1 item: STRONGLY prefer an on-this-day fact with a direct connection to ${city} or its region (state, Pacific NW, etc). If none of the provided facts connect, use your own knowledge of a historical event tied to ${city} and this date or time of year. Include indigenous history when relevant.
- If culture data was provided, use it for the culture item. Otherwise pick 1 from culture/food/community.
- Total: exactly 10 items

Each object: {"id":"slug","title":"5-10 words","body":"2-3 sentences plain text","category":"...","confidence":"high|medium|low","imageQuery":"specific 2-4 word Pexels search that matches the EXACT place/subject in your body text (e.g. 'fremont troll sculpture' not 'seattle market', 'daffodils blooming garden' not 'flowers'). NEVER use a famous landmark as imageQuery unless the body is actually about that landmark."}

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

  const items = JSON.parse(jsonMatch[0]) as FeedItem[];

  feedCache.set(cacheKey, { items, timestamp: Date.now() });

  return shuffle(items);
}
