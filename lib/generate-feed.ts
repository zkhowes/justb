import { anthropic } from "./anthropic";
import { FeedItem } from "./types";

export async function generateFeed(
  city: string,
  date: string
): Promise<FeedItem[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3072,
    messages: [
      {
        role: "user",
        content: `Generate a daily feed of 10 locally relevant items for ${city} on ${date}.

## Date & Knowledge Rules
- Today's date is ${date}. You are an AI with a knowledge cutoff — you do NOT have access to live data, event calendars, scores, or real-time information.
- For anything that requires live data (sports scores, event schedules, show listings), frame it as a suggestion: "Check if...", "Worth looking up:", "Their calendar usually has..."
- Set "confidence" to "low" for any item that references a specific event, game, or time-sensitive detail you cannot verify. Use "high" for general seasonal/astronomical/cultural knowledge. Use "medium" for things that are very likely true but not guaranteed.

## Categories & Item Counts
Generate exactly 10 items spread across these categories:

**sky-space** (2 items): Moon phase for tonight, visible planets or constellations, sunset/sunrise time estimates for the region and season. Astronomical facts are high-confidence.

**nature** (2 items): Birds migrating through or resident in the area this time of year, insects/wildlife active now, wildflowers or trees blooming. Be specific to the region and season.

**local-scene** (3 items): Real neighborhoods, venues, parks, and landmarks — go beyond the top-2 tourist spots. For sports teams, frame as "check if [team] plays today." For music venues and theaters, suggest "check their calendar for tonight." Reference real venue names.

**gardening** (1 item): What to plant, prune, or harvest right now for the region's USDA hardiness zone. What's growing wild. Seasonal gardening tips specific to the climate.

**Pick 2 more from**: history, culture, food, community — for variety. History: a real "on this day" fact tied to the city. Culture: a museum, gallery, or cultural institution worth visiting. Food: a seasonal ingredient or iconic local dish. Community: farmers markets, volunteer opportunities, neighborhood traditions.

## Output Format
Return ONLY a JSON array (no markdown, no wrapping) with 10 objects, each having:
- "id": a short unique slug (e.g. "march-moon-phase")
- "title": compelling headline (5-10 words)
- "body": 2-3 sentences, specific and vivid
- "category": one of "sky-space", "nature", "local-scene", "gardening", "history", "culture", "food", "community"
- "confidence": "high", "medium", or "low"

## Tone
Like a knowledgeable, curious local friend — warm, informative, grounded in the specific place and time. Never preachy or clickbait-y. When uncertain, be honest: "Worth checking..." is better than fabricating.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Parse the JSON array from the response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse feed items from Claude response");
  }

  return JSON.parse(jsonMatch[0]) as FeedItem[];
}
