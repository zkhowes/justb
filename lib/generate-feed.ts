import { anthropic } from "./anthropic";
import { gatherAllMoments, MomentContext } from "./moments";
import { FeedItem, GlyphData, Category } from "./types";
import {
  buildFeedPrompt,
  buildFeedSupplementPrompt,
  buildLlmOnlyInstructions,
  balanceFeedCategoryMix,
  filterRepeatedVarietySubjectsWithMinimum,
  formatMomentsForPrompt,
  MIN_FEED_ITEMS,
  recentTopicsCachePart,
} from "./feed-prompt";

const VALID_CATEGORIES: Set<string> = new Set<string>([
  "sky-space", "sky", "space", "daylight", "nature", "local-scene", "sports", "events",
  "earth-garden", "history", "culture", "food", "community", "happenings",
  "water", "air", "civic",
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
  if (s === "happening" || s === "calendar") return "happenings";
  if (s === "alert" || s === "alerts") return "civic";
  return null;
}

// In-memory cache: city+date -> feed items + glyphs
const feedCache = new Map<string, { items: FeedItem[]; glyphs: GlyphData; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 4; // 4 hours
const SERVER_FEED_CACHE_VERSION = 9;

function cleanLine(line: string): string {
  return line
    .replace(/&amp;/g, "&")
    .replace(/&#179;/g, "3")
    .replace(/&nbsp;/g, " ")
    .replace(/\[[^\]]+\]\s*/g, "")
    .replace(/^[-*\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromMoment(moment: MomentContext): string {
  const labels: Record<Category, string> = {
    "sky-space": "Sky and space",
    sky: "The sky has timing today",
    space: "Look up tonight",
    daylight: "Daylight today",
    nature: "Nature is shifting",
    "local-scene": "A local detail worth noticing",
    sports: "Local sports are moving",
    events: "Ticketed events tonight",
    "earth-garden": "Earth and garden note",
    history: "A local history thread",
    culture: "Culture on the calendar",
    food: "A seasonal food note",
    community: "Local chatter with signal",
    happenings: "Something happening nearby",
    water: "Water is worth checking",
    air: "Air conditions are notable",
    civic: "A local alert to know",
  };
  return labels[moment.category as Category] ?? "Local note";
}

function bodyFromMoment(moment: MomentContext): string {
  const lines = moment.data
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) =>
      !line.startsWith("Use this") &&
      !line.startsWith("Only include") &&
      !line.startsWith("Pick ") &&
      !line.startsWith("Highlight ") &&
      !line.includes("Provide visible planets") &&
      !line.includes("Do NOT repeat")
    )
    .slice(0, 4);
  const body = lines.join(" ");
  if (body.length <= 280) return body;
  return `${body.slice(0, 277).trim()}...`;
}

function factsFromText(text: string): string[] {
  const facts = new Set<string>();
  const time = text.match(/\b\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)\b|\b\d{1,2}\s?(?:AM|PM|am|pm)\b/);
  if (time) facts.add(time[0].replace(/\s+/g, "").toLowerCase());
  const weekday = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[A-Z][a-z]{2}\s+\d{1,2}\b/);
  if (weekday) facts.add(weekday[0]);
  const free = text.match(/\bfree\b/i);
  if (free) facts.add("free");
  const measurement = text.match(/\b\d+(?:\.\d+)?\s?(?:cfs|ft|µg\/m³|F|mi)\b/i);
  if (measurement) facts.add(measurement[0]);
  return Array.from(facts).slice(0, 3);
}

function fallbackImageQuery(category: Category): string {
  const queries: Record<Category, string> = {
    "sky-space": "night sky stars",
    sky: "golden hour clouds",
    space: "constellation stars",
    daylight: "morning light horizon",
    nature: "seasonal flowers closeup",
    "local-scene": "neighborhood street scene",
    sports: "stadium lights",
    events: "concert crowd",
    "earth-garden": "garden soil plants",
    history: "old city street",
    culture: "gallery wall art",
    food: "seasonal market produce",
    community: "city sidewalk people",
    happenings: "street fair market",
    water: "urban river water",
    air: "clear city skyline",
    civic: "city street sign",
  };
  return queries[category];
}

/** Extract a structured per-event happening into a FeedItem.
 *  Mirrors what the LLM is asked to do, so the no-LLM fallback still produces
 *  the new card shape. Returns null if the moment doesn't look like a happening. */
function happeningFromMoment(moment: MomentContext, index: number): FeedItem | null {
  if (moment.category !== "happenings") return null;
  const name = moment.data.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (!name) return null;
  const venue = moment.data.match(/^venue:\s*(.+)$/m)?.[1]?.trim();
  const when = moment.data.match(/^when:\s*(.+)$/m)?.[1]?.trim();
  const detail = moment.data.match(/^detail:\s*(.+)$/m)?.[1]?.trim();

  const facts = [when, venue].filter((f): f is string => !!f && f !== "—");
  const body = detail
    ? detail.slice(0, 220)
    : `${name}${venue && venue !== "—" ? ` at ${venue}` : ""}${when && when !== "—" ? ` on ${when}` : ""}.`;

  return {
    id: `happenings-${index}`,
    title: name,
    body,
    category: "happenings",
    confidence: "medium",
    ...(facts.length > 0 ? { facts } : {}),
  };
}

function buildFallbackFeed(moments: MomentContext[]): FeedItem[] {
  const seen = new Set<string>();
  const sourcePriority = (moment: MomentContext) => {
    if (moment.category === "community" && moment.source === "local-news") return -2;
    if (moment.category === "community" && moment.source === "reddit") return 4;
    if (moment.category === "space" && moment.data.includes("Provide visible planets")) return 10;
    return 0;
  };

  const items: FeedItem[] = [];
  let happeningIndex = 0;

  // Happenings: pass through all of them (each is its own card).
  for (const moment of moments) {
    if (moment.category !== "happenings") continue;
    const item = happeningFromMoment(moment, happeningIndex++);
    if (item) items.push(item);
  }

  // Everything else: one item per category, source-priority ordered.
  const others = [...moments]
    .filter((m) => m.category !== "happenings")
    .sort((a, b) => sourcePriority(a) - sourcePriority(b))
    .filter((moment) => {
      if (moment.category === "space" && moment.data.includes("Provide visible planets")) return false;
      if (seen.has(moment.category)) return false;
      seen.add(moment.category);
      return true;
    })
    .map((moment, index): FeedItem | null => {
      const category = moment.category as Category;
      const body = bodyFromMoment(moment);
      if (!body) return null;
      const facts = factsFromText(moment.data);
      return {
        id: `${category}-${index}`,
        title: titleFromMoment(moment),
        body,
        category,
        confidence: "medium",
        imageQuery: fallbackImageQuery(category),
        ...(facts.length > 0 ? { facts } : {}),
      };
    })
    .filter((item): item is FeedItem => item !== null);

  return [...items, ...others].slice(0, 16);
}

function normalizeFeedItems(rawItems: FeedItem[]): FeedItem[] {
  return rawItems
    .map((item) => {
      const cat = normalizeCategory(item.category);
      if (!cat) return null;
      const factsClean = Array.isArray(item.facts)
        ? item.facts
            .filter((f): f is string => typeof f === "string")
            .map((f) => f.trim())
            .filter((f) => f.length > 0 && f.length <= 30)
            .slice(0, 3)
        : null;
      const normalized: FeedItem = { ...item, category: cat };
      if (factsClean && factsClean.length > 0) normalized.facts = factsClean;
      else delete normalized.facts;
      return normalized;
    })
    .filter((item): item is FeedItem => item !== null);
}

function parseFeedItems(text: string): FeedItem[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse feed items from Claude response");
  }

  return JSON.parse(jsonMatch[0]) as FeedItem[];
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

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function buildMinimumBackfill(city: string, date: string, existingItems: FeedItem[]): FeedItem[] {
  const cityName = city.split(",")[0].trim() || city;
  const existingKeys = new Set(
    existingItems.map((item) => `${item.category}:${item.title.toLowerCase().trim()}`)
  );
  const candidates: Array<Omit<FeedItem, "id">> = [
    {
      title: "Watch the small seasonal signals",
      body: `Around ${cityName}, this part of the season rewards slow looking: fresh leaf growth, pollinator activity, and birds working the edges of parks and street trees. Pick one familiar block and notice what changed since last week.`,
      category: "nature",
      confidence: "medium",
      imageQuery: "spring street trees",
    },
    {
      title: "Try one different block",
      body: `${cityName} feels different when you change the route by a few streets. Use today as an excuse to pass a library branch, corner market, small park, or independent storefront you usually miss.`,
      category: "local-scene",
      confidence: "medium",
      imageQuery: "neighborhood storefront",
    },
    {
      title: "The soil is active now",
      body: `Garden timing is moving quickly around ${cityName}: tender starts, weeds, compost, and thirsty containers all show changes within days. A five-minute check is enough to spot what needs water, pruning, or patience.`,
      category: "earth-garden",
      confidence: "medium",
      imageQuery: "garden seedlings soil",
    },
    {
      title: "Market tables are turning",
      body: `Seasonal food is one of the easiest ways to feel the date without checking a calendar. Look for the local produce, bakery case, or neighborhood special that would not have been as good a month ago.`,
      category: "food",
      confidence: "medium",
      imageQuery: "farmers market produce",
    },
    {
      title: "The useful local thread",
      body: `A good ${cityName} day usually has one small piece of community signal: a neighbor tip, a transit habit, a library event, a market note, or a block-level change. Watch for the detail that would help someone else plan their next hour.`,
      category: "community",
      confidence: "medium",
      imageQuery: "community bulletin board",
    },
    {
      title: "Small rooms carry the week",
      body: `${cityName}'s quieter cultural calendar often lives in small venues: gallery openings, readings, record shops, community centers, and neighborhood stages. The best find today may be the one with a handwritten flyer.`,
      category: "culture",
      confidence: "medium",
      imageQuery: "small music venue",
    },
    {
      title: "Let twilight finish first",
      body: `For sky watching near ${cityName}, give your eyes a few minutes after dusk before judging the night. The first bright points and cloud breaks are easier to read once the city light settles into the background.`,
      category: "space",
      confidence: "medium",
      imageQuery: "twilight city sky",
    },
    {
      title: "The season has older rhythms",
      body: `This week sits inside older local patterns: shoreline work, planting windows, school calendars, transit habits, and neighborhood events have all shaped how ${cityName} moves through late spring. Notice which routines still show up today.`,
      category: "history",
      confidence: "medium",
      imageQuery: "historic city street",
    },
  ];

  return candidates
    .filter((item) => !existingKeys.has(`${item.category}:${item.title.toLowerCase().trim()}`))
    .map((item, index) => ({
      id: `minimum-backfill-${slugPart(cityName)}-${slugPart(date)}-${index}`,
      ...item,
    }));
}

export async function generateFeed(
  city: string,
  date: string,
  recentTopics?: string[]
): Promise<{ items: FeedItem[]; glyphs: GlyphData }> {
  const cacheKey = `v${SERVER_FEED_CACHE_VERSION}:${city.toLowerCase().trim()}:${date}:${recentTopicsCachePart(recentTopics)}`;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { items: cached.items, glyphs: cached.glyphs };
  }

  // 1. Gather structured data from all moment providers (APIs, suncalc, etc.)
  const { loc, moments, glyphs } = await gatherAllMoments(city, date);
  const momentData = formatMomentsForPrompt(moments);

  // 2. Determine which categories already have API data
  const coveredCategories = new Set(moments.map((m) => m.category));
  const llmOnlyInstructions = buildLlmOnlyInstructions(coveredCategories);

  // 3. Send to Claude — NO web search, just prose generation
  if (!process.env.ANTHROPIC_API_KEY) {
    let items = buildFallbackFeed(moments);
    if (items.length < MIN_FEED_ITEMS) {
      items = uniqueByIdAndTitle([
        ...items,
        ...buildMinimumBackfill(city, date, items),
      ]);
    }
    items = balanceFeedCategoryMix(items);
    feedCache.set(cacheKey, { items, glyphs, timestamp: Date.now() });
    return { items, glyphs };
  }

  // 3. Send to Claude — NO web search, just prose generation
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: buildFeedPrompt({
          city,
          date,
          timezone: loc.timezone,
          momentData,
          llmOnlyInstructions,
          recentTopics,
          includeFacts: true,
        }),
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

  const rawItems = parseFeedItems(text);
  let normalizedItems = normalizeFeedItems(rawItems);
  let items = filterRepeatedVarietySubjectsWithMinimum(normalizedItems, recentTopics);

  if (items.length < MIN_FEED_ITEMS) {
    const needed = MIN_FEED_ITEMS - items.length;
    const supplement = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: buildFeedSupplementPrompt({
            city,
            date,
            timezone: loc.timezone,
            momentData,
            existingItems: items,
            needed,
            recentTopics,
            includeFacts: true,
          }),
        },
      ],
    });

    let supplementText = "";
    for (const block of supplement.content) {
      if (block.type === "text") {
        supplementText = block.text;
        break;
      }
    }

    normalizedItems = uniqueByIdAndTitle([
      ...items,
      ...normalizeFeedItems(parseFeedItems(supplementText)),
    ]);
    items = filterRepeatedVarietySubjectsWithMinimum(normalizedItems, recentTopics);
  }

  if (items.length < MIN_FEED_ITEMS) {
    items = uniqueByIdAndTitle([
      ...items,
      ...buildMinimumBackfill(city, date, items),
    ]);
  }

  items = balanceFeedCategoryMix(items);
  feedCache.set(cacheKey, { items, glyphs, timestamp: Date.now() });

  return { items, glyphs };
}
