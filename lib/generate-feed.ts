import { anthropic } from "./anthropic";
import { geocodeCity } from "./geocode";
import { getAstroData } from "./astro";
import { FeedItem } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripCitations(text: string): string {
  return text.replace(/<\/?cite[^>]*>/g, "");
}

// In-memory cache: city+date -> feed items
const feedCache = new Map<string, { items: FeedItem[]; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours

export async function generateFeed(
  city: string,
  date: string
): Promise<FeedItem[]> {
  const cacheKey = `${city.toLowerCase().trim()}:${date}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Return shuffled copy so order varies on refresh
    return shuffle([...cached.items]);
  }

  const { lat, lng, timezone } = await geocodeCity(city);
  const astro = getAstroData(lat, lng, new Date(), timezone);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Daily feed for ${city} on ${date}. Return ONLY a JSON array of 10 objects, no markdown.

Verified astro data (use verbatim): Moon: ${astro.moonPhase}, ${astro.moonIllumination}% illumination. Moonrise ${astro.moonrise}, moonset ${astro.moonset}. Sunrise ${astro.sunrise}, sunset ${astro.sunset} (${timezone}).

Categories (exact counts): sky-space(2), nature(2), local-scene(1), sports(1), events(1), earth-garden(1), history(1), pick 1 from culture/food/community.

Rules:
- Web search for sports schedules and local events/music only
- Use verified astro data above for sky items, don't hallucinate
- Be specific to ${city}'s region, season, and ecology
- Sports: consolidate all games today into ONE item. Name real teams/opponents.
- Events: name real venues and performers
- "confidence": "high" for verified astro, "medium" for seasonal/general, "low" for specific events/times

Each object: {"id":"slug","title":"5-10 words","body":"2-3 sentences, plain text","category":"...","confidence":"...","imageQuery":"2-4 word photo search that will find a RELEVANT photo, be specific (e.g. 'waxing crescent moon' not 'moon', 'portland japanese garden' not 'garden')"}

Tone: knowledgeable local friend, warm, specific. No HTML/citation tags in values.`,
      },
    ],
  });

  let text = "";
  for (let i = message.content.length - 1; i >= 0; i--) {
    const block = message.content[i];
    if (block.type === "text") {
      text = block.text;
      break;
    }
  }

  text = stripCitations(text);

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse feed items from Claude response");
  }

  let items = JSON.parse(jsonMatch[0]) as FeedItem[];

  items = items.map((item) => ({
    ...item,
    title: stripCitations(item.title),
    body: stripCitations(item.body),
  }));

  // Cache the canonical order
  feedCache.set(cacheKey, { items, timestamp: Date.now() });

  return shuffle(items);
}
