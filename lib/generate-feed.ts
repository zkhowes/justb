import { anthropic } from "./anthropic";
import { geocodeCity } from "./geocode";
import { getAstroData } from "./astro";
import { enrichWithImages } from "./images";
import { FeedItem } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function generateFeed(
  city: string,
  date: string
): Promise<FeedItem[]> {
  // Pre-fetch verified astronomical data
  const { lat, lng } = await geocodeCity(city);
  const astro = getAstroData(lat, lng, new Date());

  const astroBlock = `## Verified Astronomical Data (from suncalc — use verbatim, do NOT hallucinate)
- Moon phase: ${astro.moonPhase}
- Moon illumination: ${astro.moonIllumination}%
- Moonrise: ~${astro.moonrise} (approximate, server UTC)
- Moonset: ~${astro.moonset} (approximate, server UTC)
- Sunrise: ~${astro.sunrise} (approximate, server UTC)
- Sunset: ~${astro.sunset} (approximate, server UTC)
Note: rise/set times are approximate because they're computed in UTC. Present them as "around X" rather than exact.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ],
    messages: [
      {
        role: "user",
        content: `Generate a daily feed of 10 locally relevant items for ${city} on ${date}.

${astroBlock}

## Date & Knowledge Rules
- Today's date is ${date}.
- You have access to a web search tool. Use it for sports schedules and local events/music.
- For astronomical data, use ONLY the verified data above. Do NOT make up moon phases or sunrise/sunset times.
- Set "confidence" to "low" for any item that references a specific event, game, or time-sensitive detail you cannot verify. Use "high" for verified astronomical data and general seasonal knowledge. Use "medium" for things that are very likely true but not guaranteed.

## Categories & Item Counts
Generate exactly 10 items spread across these categories:

**sky-space** (2 items): Use the verified astronomical data above for moon phase, illumination, and rise/set times. Also include visible planets or constellations for the season. Astronomical facts from the verified data are high-confidence.

**nature** (2 items): Birds migrating through or resident in the area this time of year, insects/wildlife active now, wildflowers or trees blooming. Be specific to the region and season.

**local-scene** (1 item): Real neighborhoods, venues, parks, and landmarks — go beyond the top-2 tourist spots. Reference real places.

**sports** (1 item): Search the web for today's professional sports schedule in ${city}. Consolidate ALL games happening today into ONE entry. If no games today, mention the next upcoming game or current season status. Always name real teams and real opponents.

**events** (1 item): Search the web for events and live music happening today/tonight in ${city}. Name real venues and real acts/performers. If you find specific events, list 2-3 of the best ones.

**earth-garden** (1 item): Either a gardening tip (what to plant, prune, harvest for the region's climate and season) OR a geology/landscape fact (how a local landform was created, interesting rocks/minerals in the area, volcanic/glacial history). Alternate between gardening and geology.

**history** (1 item): A real historical fact tied to ${city} — include indigenous peoples and their relationship to the land, early European explorers, significant regional events, or "on this day" facts. Go beyond well-known history.

**Pick 1 from**: culture, food, community — for variety. Culture: a museum, gallery, or cultural institution worth visiting. Food: a seasonal ingredient or iconic local dish. Community: farmers markets, volunteer opportunities, neighborhood traditions.

## Output Format
Return ONLY a JSON array (no markdown, no wrapping) with 10 objects, each having:
- "id": a short unique slug (e.g. "march-moon-phase")
- "title": compelling headline (5-10 words)
- "body": 2-3 sentences, specific and vivid
- "category": one of "sky-space", "nature", "local-scene", "sports", "events", "earth-garden", "history", "culture", "food", "community"
- "confidence": "high", "medium", or "low"
- "imageQuery": a 2-4 word Pexels search query for a relevant photo (e.g. "full moon night", "seattle pike place", "cherry blossoms spring")

## Tone
Like a knowledgeable, curious local friend — warm, informative, grounded in the specific place and time. Never preachy or clickbait-y. When uncertain, be honest: "Worth checking..." is better than fabricating.`,
      },
    ],
  });

  // Web search produces interleaved text/tool blocks — extract JSON from last text block
  let text = "";
  for (let i = message.content.length - 1; i >= 0; i--) {
    const block = message.content[i];
    if (block.type === "text") {
      text = block.text;
      break;
    }
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse feed items from Claude response");
  }

  let items = JSON.parse(jsonMatch[0]) as FeedItem[];
  items = await enrichWithImages(items);
  items = shuffle(items);

  return items;
}
