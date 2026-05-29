import { FeedItem, Category } from "./types";
import { MomentContext } from "./moments/types";

export const MIN_FEED_ITEMS = 10;
/** Max grew from 12 → 18 so happenings (now 0–N cards, one per local event)
 *  doesn't displace the core mix. The page caps section sizes so the user
 *  never sees a wall of cards. */
export const MAX_FEED_ITEMS = 18;
/** Categories that may legitimately produce more than one card. The
 *  category-balancer keeps only the first card from any other category. */
export const MULTI_CARD_CATEGORIES: Set<Category> = new Set<Category>(["happenings"]);
export const CORE_FEED_CATEGORIES: Category[] = [
  "sky",
  "space",
  "nature",
  "local-scene",
  "earth-garden",
  "history",
  "community",
  "food",
];

export const MIX_FEED_CATEGORIES: Category[] = [
  ...CORE_FEED_CATEGORIES,
  "happenings",
  "events",
  "culture",
  "sports",
  "daylight",
  "water",
  "air",
  "civic",
];

const VARIETY_CATEGORIES: Set<Category> = new Set<Category>([
  "sky",
  "space",
  "nature",
  "local-scene",
  "earth-garden",
  "history",
  "food",
  "community",
  "water",
]);

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "along",
  "around",
  "because",
  "before",
  "being",
  "between",
  "could",
  "daily",
  "from",
  "have",
  "here",
  "into",
  "local",
  "near",
  "over",
  "that",
  "their",
  "there",
  "this",
  "today",
  "tonight",
  "under",
  "where",
  "with",
  "worth",
  "your",
]);

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return compactWhitespace(
    value
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
  );
}

function tokensFrom(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function subjectPhraseCandidates(value: string): string[] {
  const normalized = normalizeText(value);
  const tokens = tokensFrom(normalized);
  const phrases = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const one = tokens[i];
    if (one.length >= 6) phrases.add(one);
    if (i + 1 < tokens.length) phrases.add(`${one} ${tokens[i + 1]}`);
    if (i + 2 < tokens.length) phrases.add(`${one} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  if (normalized.includes("ballard") && normalized.includes("salmon")) {
    phrases.add("ballard locks salmon");
    phrases.add("salmon ladder");
    phrases.add("fish ladder");
  }
  if (normalized.includes("salmon") && (normalized.includes("lock") || normalized.includes("ladder") || normalized.includes("run"))) {
    phrases.add("salmon run");
    phrases.add("salmon ladder");
  }
  if (normalized.includes("vancouver") && (normalized.includes("expedition") || normalized.includes("voyage"))) {
    phrases.add("vancouver expedition");
    phrases.add("vancouver voyage");
  }

  return Array.from(phrases).filter((phrase) => phrase.length >= 6);
}

export function recentTopicsFromItems(items: FeedItem[]): string[] {
  const topics = new Set<string>();
  for (const item of items) {
    const pieces = [item.title, item.body, item.category, item.imageQuery ?? ""]
      .map(compactWhitespace)
      .filter(Boolean);
    if (pieces.length === 0) continue;
    topics.add(`${item.category}: ${pieces.join(" | ").slice(0, 220)}`);
  }
  return Array.from(topics);
}

export function normalizeRecentTopics(recentTopics?: string[], limit = 80): string[] {
  if (!recentTopics || recentTopics.length === 0) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const topic of recentTopics) {
    const clean = compactWhitespace(topic).slice(0, 240);
    if (!clean) continue;
    const key = normalizeText(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function recentTopicsCachePart(recentTopics?: string[]): string {
  const normalized = normalizeRecentTopics(recentTopics, 40);
  if (normalized.length === 0) return "none";
  let hash = 5381;
  for (const char of normalized.join("|")) {
    hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  }
  return `r${(hash >>> 0).toString(36)}`;
}

export function buildRecentVarietyBlock(recentTopics?: string[]): string {
  const normalized = normalizeRecentTopics(recentTopics);
  if (normalized.length === 0) return "";

  return `
## Recently covered subjects — hard variety rule
Avoid repeating the same subject, place, named event, organism, expedition, landmark, river, tide pattern, constellation, planet, or historical episode from this list unless structured API data above makes it specifically relevant today. Avoid close paraphrases too.
If this list includes Ballard Locks salmon, salmon ladders/runs, or fish ladders, do not choose those again. If it includes the Vancouver Expedition or Vancouver's voyage, do not choose those again.
Recent subjects:
${normalized.map((topic) => `- ${topic}`).join("\n")}`;
}

export function buildLlmOnlyInstructions(coveredCategories: Set<string>): string[] {
  const instructions: string[] = [];
  const distinctFromSources =
    coveredCategories.size > 0
      ? " If this category already has structured source data, add a separate angle instead of paraphrasing that same source item."
      : "";

  instructions.push(`nature(3): what's happening in nature RIGHT NOW. Choose less-obvious local specificity across wildlife, plants, fungi, shoreline ecology, seasonal weather effects, or phenology. Be specific to this week and region. Do not default to the city's most famous nature landmark or recurring salmon/fish-ladder stories unless truly timely.${distinctFromSources}`);
  instructions.push(`local-scene(1): a specific real neighborhood, park, street, local institution, independent radio station, bookstore, coffee roaster, library branch, market, ferry stop, or community place. Avoid famous tourist landmarks unless something specific and timely is happening there. Rotate neighborhoods and institutions.${distinctFromSources}`);
  instructions.push(`earth-garden(1): pick whichever is more fascinating today: local geology, glacial/volcanic/soil features, watershed shape, garden timing, planting/pruning/compost advice, or a timely backyard observation. Vary geology vs. gardening across days.${distinctFromSources}`);
  instructions.push(`food/community(1): seasonal ingredient, local dish, market find, neighborhood food tradition, or community foodway. Skip only if you cannot make it specific to this season and place.${distinctFromSources}`);
  return instructions;
}

export function formatMomentsForPrompt(moments: MomentContext[]): string {
  return moments
    .map((m) => `[${m.category}] (source: ${m.source})\n${m.data}`)
    .join("\n\n");
}

export function buildFeedPrompt(input: {
  city: string;
  date: string;
  timezone: string;
  momentData: string;
  llmOnlyInstructions: string[];
  recentTopics?: string[];
  includeFacts: boolean;
}): string {
  const recentBlock = buildRecentVarietyBlock(input.recentTopics);
  const objectShape = input.includeFacts
    ? `{"id":"slug","title":"5-10 words","body":"2-3 sentences plain text","category":"...","confidence":"high|medium|low","imageQuery":"specific 2-4 word Pexels search for the SINGLE most visual subject in your body text. If the body mentions multiple things (e.g. cherry blossoms AND returning swallows), pick the ONE most visually striking for the image — do NOT try to summarize everything. Examples: 'cherry blossoms branch closeup' not 'spring nature seattle', 'barn swallow flight' not 'birds flowers'. NEVER use a famous landmark unless the body is actually about that landmark. For sky-space: use the specific constellation or planet name (e.g. 'orion constellation stars' not 'night sky').","facts":["1–3 short factual chips, each 1–4 words, extracted from the body or source data. Examples: '8pm tonight', '$25', 'free', '0.6mi', 'sold out', '78 mins in', '1923 — 103 yrs ago', 'bloom peak'. Skip facts already shown elsewhere in the UI (sunrise/sunset/moon are in glyphs). If nothing concrete to surface, return an empty array."]}`
    : `{"id":"slug","title":"5-10 words","body":"2-3 sentences plain text","category":"...","confidence":"high|medium|low","imageQuery":"specific 2-4 word Pexels search for the SINGLE most visual subject in your body text. If the body mentions multiple things (e.g. cherry blossoms AND returning swallows), pick the ONE most visually striking for the image — do NOT try to summarize everything. Examples: 'cherry blossoms branch closeup' not 'spring nature seattle', 'barn swallow flight' not 'birds flowers'. NEVER use a famous landmark unless the body is actually about that landmark. For sky-space: use the specific constellation or planet name (e.g. 'orion constellation stars' not 'night sky')."}`;

  return `Write a daily feed for ${input.city} on ${input.date} (timezone: ${input.timezone}). Return ONLY a JSON array, no markdown.

## Structured data from APIs (use this verbatim for these categories):
${input.momentData}

## Categories you must generate from your knowledge:
${input.llmOnlyInstructions.join("\n")}

${recentBlock}

## Rules
- For categories with API data above, write compelling prose BASED ON that data. Don't invent different events/games.
- Keep generated knowledge items within nature, local-scene, earth-garden, and food/community. Do not invent extra categories just for novelty.
- "sky" gets 1 item about golden hour, sunset quality, cloud texture, seasonal light, or viewing conditions. Vary the angle across days. Do NOT repeat sunrise/sunset times or moon phase (shown separately in the UI glyphs). Daylight milestones go in the separate "daylight" item — do not duplicate them here.
- "daylight" gets 1 item ONLY if structured daylight data was provided above. Write ONE short sentence about today's daylight length and direction (lengthening / shortening / milestone). Facts MUST be exactly the two chips named in the daylight source data: ["<H>h <M>m", "+/- N min"]. Title 2-4 words.
- "space" gets 1 item about visible planets, constellations, bright stars, meteor activity, and notable celestial objects tonight. Be specific about where to look (compass direction) and when. Vary the object across days. Do NOT repeat moon phase (shown in glyphs).
- sports gets 1 item: consolidate the game data into one engaging summary. If no sports data was provided, skip this category entirely.
- events gets 1 item: pick the 2-3 best events and highlight them. If no events data was provided, skip this category entirely.
- happenings can produce 0 to N items — ONE PER community event block above (each "Community event in <city>:" stanza is one card). Title MUST be the structured "name" verbatim. Facts MUST be exactly: ["<when>", "<venue>"] in that order; drop a fact only when its value is "—". Body is 2–3 sentences for a curious local; lead with what it is, not the date. Do not invent events beyond the structured data. Do not merge multiple events into one card.
- water gets at most 1 item, only when the supplied source data is genuinely useful or interesting today. Vary between tides, rivers, streamflow, water level, beach timing, and practical local water context. Keep it practical and plain-spoken.
- air and civic each get at most 1 item, only when the supplied source data is genuinely useful or interesting today. Keep them practical and plain-spoken.
- history gets 1 item: STRONGLY prefer an on-this-day fact with a direct connection to ${input.city} or its region. If none connect, use your own knowledge ONLY if highly confident about the specific date. If you cannot confidently tie a specific event to this exact date, write about a seasonal historical pattern for the region instead. Vary between exact on-this-day events and seasonal patterns; do not repeat the same expedition, founding story, disaster, or famous milestone. NEVER fabricate or guess specific dates.
- If community/reddit/local-news data was provided, write 1 community item highlighting the most interesting local intel. Focus on actionable tips, timely discoveries, or useful PSAs — not complaints or generic chatter.
- If culture data was provided, use it for the culture item. Otherwise pick 1 from culture/food/community.
- Return ${MIN_FEED_ITEMS}-${MAX_FEED_ITEMS} items. ${MIN_FEED_ITEMS} is the minimum; if structured sources are sparse, use the generated-knowledge categories above to reach the minimum while staying specific to ${input.city}, the season, and this week. Cover the main mix whenever possible: ${CORE_FEED_CATEGORIES.join(", ")}. Do not use generic filler or repeated subjects.

Each object: ${objectShape}

Tone: knowledgeable local friend. No HTML tags.`;
}

export function buildFeedSupplementPrompt(input: {
  city: string;
  date: string;
  timezone: string;
  momentData: string;
  existingItems: FeedItem[];
  needed: number;
  recentTopics?: string[];
  includeFacts: boolean;
}): string {
  const recentBlock = buildRecentVarietyBlock(input.recentTopics);
  const objectShape = input.includeFacts
    ? `{"id":"slug","title":"5-10 words","body":"2-3 sentences plain text","category":"nature|local-scene|earth-garden|food|culture|community|water|air|civic|sky|space|history","confidence":"high|medium|low","imageQuery":"specific 2-4 word Pexels search","facts":["1-3 short factual chips, each 1-4 words"]}`
    : `{"id":"slug","title":"5-10 words","body":"2-3 sentences plain text","category":"nature|local-scene|earth-garden|food|culture|community|water|air|civic|sky|space|history","confidence":"high|medium|low","imageQuery":"specific 2-4 word Pexels search"}`;

  return `The first JustB feed for ${input.city} on ${input.date} only produced ${input.existingItems.length} items. Generate exactly ${input.needed} additional items so the final feed reaches at least ${MIN_FEED_ITEMS}.
Return ONLY a JSON array, no markdown.

## Existing items to avoid repeating
${input.existingItems.map((item) => `- [${item.category}] ${item.title}: ${item.body}`).join("\n")}

## Structured data available
${input.momentData}

${recentBlock}

## Rules
- Prefer nature, local-scene, earth-garden, food, culture, community, sky, space, and history items with specific local and seasonal detail.
- Do not invent ticketed events, sports games, civic alerts, water readings, or air readings unless they are present in the structured data.
- Do not repeat an existing item's subject, place, organism, historical episode, constellation, planet, event, or image subject.
- Keep each item specific to ${input.city}, the season, and this week. No generic filler.

Each object: ${objectShape}

Tone: knowledgeable local friend. No HTML tags.`;
}

function repeatedSubjectTerms(recentTopics?: string[]): string[] {
  const terms = new Set<string>();
  for (const topic of normalizeRecentTopics(recentTopics)) {
    for (const phrase of subjectPhraseCandidates(topic)) {
      terms.add(phrase);
    }
  }
  return Array.from(terms);
}

export function isRepeatedVarietySubject(item: FeedItem, recentTopics?: string[]): boolean {
  if (!VARIETY_CATEGORIES.has(item.category)) return false;
  const terms = repeatedSubjectTerms(recentTopics);
  if (terms.length === 0) return false;

  const haystack = normalizeText(`${item.title} ${item.body} ${item.imageQuery ?? ""}`);
  const haystackTokens = new Set(tokensFrom(haystack));
  for (const term of terms) {
    if (term.includes(" ")) {
      if (haystack.includes(term)) return true;
      continue;
    }
    if (haystackTokens.has(term)) return true;
  }
  return false;
}

export function filterRepeatedVarietySubjectsWithMinimum(
  items: FeedItem[],
  recentTopics: string[] | undefined,
  minimum = MIN_FEED_ITEMS,
  maximum = MAX_FEED_ITEMS
): FeedItem[] {
  const fresh = items.filter((item) => !isRepeatedVarietySubject(item, recentTopics));
  if (fresh.length >= minimum) return fresh.slice(0, maximum);

  const freshIds = new Set(fresh.map((item) => item.id));
  const backfill = items.filter((item) => !freshIds.has(item.id));
  return [...fresh, ...backfill].slice(0, Math.min(maximum, Math.max(minimum, items.length)));
}

function uniqueByIdAndTitle(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const unique: FeedItem[] = [];
  for (const item of items) {
    const key = `${item.id.toLowerCase().trim()}|${item.title.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function takeFirstByCategory(items: FeedItem[], category: Category): FeedItem | null {
  return items.find((item) => item.category === category) ?? null;
}

export function balanceFeedCategoryMix(
  items: FeedItem[],
  minimum = MIN_FEED_ITEMS,
  maximum = MAX_FEED_ITEMS
): FeedItem[] {
  const unique = uniqueByIdAndTitle(items);
  const selected: FeedItem[] = [];
  const selectedIds = new Set<string>();

  const add = (item: FeedItem | null) => {
    if (!item || selectedIds.has(item.id) || selected.length >= maximum) return;
    selected.push(item);
    selectedIds.add(item.id);
  };

  for (const category of CORE_FEED_CATEGORIES) {
    add(takeFirstByCategory(unique, category));
  }

  for (const category of MIX_FEED_CATEGORIES) {
    add(takeFirstByCategory(unique, category));
    if (selected.length >= minimum) break;
  }

  // Multi-card categories (happenings) get all their items added eagerly,
  // before the per-category-dedupe pass below would cap them at 1.
  for (const item of unique) {
    if (selectedIds.has(item.id)) continue;
    if (!MULTI_CARD_CATEGORIES.has(item.category)) continue;
    add(item);
  }

  const counts = new Map<Category, number>();
  for (const item of selected) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  for (const item of unique) {
    if (selectedIds.has(item.id)) continue;
    const count = counts.get(item.category) ?? 0;
    // Allow multi-card categories past the once-per-category gate.
    if (count > 0 && selected.length < minimum && !MULTI_CARD_CATEGORIES.has(item.category)) continue;
    add(item);
    counts.set(item.category, count + 1);
    if (selected.length >= minimum) break;
  }

  for (const item of unique) {
    if (selected.length >= maximum) break;
    if (selectedIds.has(item.id)) continue;
    add(item);
  }

  return selected;
}
