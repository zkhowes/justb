import { anthropic } from "./anthropic";
import { FeedItem } from "./types";

export async function generateFeed(
  city: string,
  date: string
): Promise<FeedItem[]> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Generate a daily feed of 8 locally relevant items for ${city} on ${date}.

Each item should feel like something a knowledgeable, curious local friend would share — warm, informative, and grounded in the specific place and time.

Return ONLY a JSON array (no markdown, no wrapping) with 8 objects, each having:
- "id": a short unique slug (e.g. "pike-place-history")
- "title": compelling headline (5-10 words)
- "body": 2-3 sentences, specific and vivid
- "category": one of "history", "nature", "weather", "culture", "food", "sports", "music", "community"
- "imageQuery": 2-3 word Unsplash search query for a relevant photo

Guidelines:
- Mix categories — don't repeat the same one more than twice
- Reference real places, events, seasonal details, and local culture
- Make the content feel specific to ${city}, not generic
- Include at least one item tied to the specific date or time of year
- Tone: warm, curious, never preachy or clickbait-y`,
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
