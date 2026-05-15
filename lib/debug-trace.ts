import { anthropic } from "./anthropic";
import { geocodeCity } from "./geocode";
import { getAstroData } from "./astro";
import { fetchWeather } from "./moments/weather";
import { fetchTides } from "./moments/tides";
import { fetchSkyMoments } from "./moments/sky";
import { fetchSportsMoments } from "./moments/sports";
import { fetchEventMoments } from "./moments/events";
import { fetchHistoryMoments } from "./moments/history";
import { fetchRedditMoments } from "./moments/reddit";
import { fetchLocalNewsMoments } from "./moments/local-news";
import { fetchCommunityEventMoments } from "./moments/community-events";
import { MomentContext, LocationContext } from "./moments/types";
import { FeedItem, GlyphData, Category } from "./types";

// --- Trace types ---

export interface ProviderTrace {
  name: string;
  category: string;
  source: string;
  params: Record<string, unknown>;
  /** Raw API response summary (truncated for readability) */
  rawResponse: string;
  /** The MomentContext.data passed to the LLM prompt */
  promptData: string | null;
  /** Whether this provider contributed a moment to the feed */
  contributed: boolean;
  /** Why it was included or excluded */
  decision: string;
  durationMs: number;
  error: string | null;
}

export interface LLMTrace {
  model: string;
  promptText: string;
  responseText: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  /** Categories the LLM was asked to generate from knowledge */
  llmOnlyCategories: string[];
  /** Categories covered by API data */
  apiCoveredCategories: string[];
}

export interface CardTrace {
  id: string;
  title: string;
  body: string;
  category: Category;
  confidence: string;
  imageQuery?: string;
  /** Which provider sourced the data for this card */
  dataSource: string;
  /** Whether the card survived normalization */
  normalized: boolean;
  /** User feedback if any */
  feedback: CardFeedback | null;
}

export interface CardFeedback {
  rating: "good" | "irrelevant" | "inaccurate";
  reason: string | null;
  createdAt: string;
}

export interface FeedDebugTrace {
  city: string;
  date: string;
  dateISO: string;
  timezone: string;
  lat: number;
  lng: number;
  totalDurationMs: number;
  providers: ProviderTrace[];
  llm: LLMTrace;
  cards: CardTrace[];
  glyphs: GlyphData;
}

// --- Valid categories (duplicated from generate-feed to avoid circular) ---

const VALID_CATEGORIES: Set<string> = new Set([
  "sky-space", "sky", "space", "nature", "local-scene", "sports", "events",
  "earth-garden", "history", "culture", "food", "community",
]);

function normalizeCategory(raw: string): Category | null {
  const s = raw.toLowerCase().trim().replace(/_/g, "-");
  if (VALID_CATEGORIES.has(s)) return s as Category;
  if (s === "sky-space") return "sky";
  if (s === "garden" || s === "earth") return "earth-garden";
  if (s === "local" || s === "scene") return "local-scene";
  if (s === "event" || s === "music") return "events";
  return null;
}

// --- Traced provider wrapper ---

async function traceProvider(
  name: string,
  category: string,
  params: Record<string, unknown>,
  fn: () => Promise<MomentContext[]>
): Promise<{ moments: MomentContext[]; trace: ProviderTrace }> {
  const start = Date.now();
  try {
    const moments = await fn();
    const durationMs = Date.now() - start;
    const contributed = moments.length > 0;
    return {
      moments,
      trace: {
        name,
        category,
        source: moments[0]?.source ?? name,
        params,
        rawResponse: moments.map((m) => m.data).join("\n---\n"),
        promptData: contributed ? moments.map((m) => m.data).join("\n---\n") : null,
        contributed,
        decision: contributed
          ? `Returned ${moments.length} moment(s) for: ${moments.map((m) => m.category).join(", ")}`
          : `No data — will fall back to LLM knowledge for ${category}`,
        durationMs,
        error: null,
      },
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      moments: [],
      trace: {
        name,
        category,
        source: name,
        params,
        rawResponse: "",
        promptData: null,
        contributed: false,
        decision: `Error: ${err instanceof Error ? err.message : String(err)}`,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// --- Main debug feed generator ---

export async function generateFeedWithTrace(
  city: string,
  date: string,
  recentTopics?: string[]
): Promise<FeedDebugTrace> {
  const totalStart = Date.now();

  // 1. Geocode
  const { lat, lng, timezone } = await geocodeCity(city);
  const parsed = new Date(date);
  const dateISO = isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
  const loc: LocationContext = { city, lat, lng, timezone, date, dateISO };

  // 2. Weather (needed by sky)
  const weatherStart = Date.now();
  const weatherResult = await fetchWeather(lat, lng);
  const weatherDuration = Date.now() - weatherStart;

  const weatherTrace: ProviderTrace = {
    name: "weather",
    category: "sky (dependency)",
    source: "open-meteo",
    params: { lat, lng, url: `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=cloud_cover,precipitation_probability&temperature_unit=fahrenheit&forecast_days=1` },
    rawResponse: weatherResult
      ? `temp=${weatherResult.temp}F, code=${weatherResult.code}, cloudCover=[${weatherResult.hourlyCloudCover?.slice(0, 6).join(",")}...], precipProb=[${weatherResult.hourlyPrecipProb?.slice(0, 6).join(",")}...]`
      : "null (API failed)",
    promptData: null,
    contributed: weatherResult !== null,
    decision: weatherResult ? "Weather data available for sky provider" : "Weather unavailable — sky sunset quality will be skipped",
    durationMs: weatherDuration,
    error: weatherResult === null ? "API returned null" : null,
  };

  // 3. All providers in parallel with tracing
  const tideStart = Date.now();
  const [skyResult, sportsResult, eventsResult, historyResult, redditResult, localNewsResult, communityEventsResult, tideRes] = await Promise.all([
    traceProvider("sky", "sky, space", { lat, lng, timezone, hasWeather: !!weatherResult }, () => fetchSkyMoments(loc, weatherResult)),
    traceProvider("sports", "sports", { city, dateISO, espnUrl: `https://site.api.espn.com/apis/site/v2/sports/{league}/scoreboard?dates=${dateISO.replace(/-/g, "")}`, leagues: ["NBA", "NFL", "MLB", "NHL", "MLS"] }, () => fetchSportsMoments(loc)),
    traceProvider("events", "events, culture", { city, lat, lng, dateISO, hasTicketmaster: !!process.env.TICKETMASTER_API_KEY, hasSeatGeek: !!process.env.SEATGEEK_CLIENT_ID }, () => fetchEventMoments(loc)),
    traceProvider("history", "history", { city, dateISO, wikimediaUrl: `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${String(parsed.getUTCDate()).padStart(2, "0")}`, wikiUrl: `https://en.wikipedia.org/w/api.php?action=query&titles=History of ${city.split(",")[0].trim()}` }, () => fetchHistoryMoments(loc)),
    traceProvider("reddit", "community", { city, subreddits: getSubredditsForDebug(city), source: "arctic-shift", strategy: "comment-volume (scores never update upstream)", commentsUrl: `https://arctic-shift.photon-reddit.com/api/comments/search?subreddit={subreddit}&sort=desc&limit=100&after=<48h ago>&before=<cursor>`, paging: "up to 5 pages × 100 comments per subreddit", postsUrl: `https://arctic-shift.photon-reddit.com/api/posts/ids?ids=<top-25-by-recent-comment-count>` }, () => fetchRedditMoments(loc)),
    traceProvider("local-news", "community", { city, feeds: getNewsFeedsForDebug(city) }, () => fetchLocalNewsMoments(loc)),
    traceProvider("community-events", "community", { city, source: "socrata-soda", endpoint: getCommunityEventEndpointForDebug(city), window: "today through +7d" }, () => fetchCommunityEventMoments(loc)),
    fetchTides(lat, lng, timezone),
  ]);

  // Synthesize a tide provider trace from the raw result (tides are glyph-only,
  // they don't feed the LLM prompt, but they should still be visible in debug)
  const tideDuration = Date.now() - tideStart;
  const tideTrace: ProviderTrace = {
    name: "tides",
    category: "glyphs (tide chip)",
    source: "NOAA CO-OPS",
    params: { lat, lng, timezone },
    rawResponse: tideRes.ok
      ? tideRes.data
        ? `state=${tideRes.data.state}, nextHigh=${tideRes.data.nextHigh ?? "—"}, nextLow=${tideRes.data.nextLow ?? "—"}`
        : `no nearby station (${tideRes.reason ?? "unknown"})`
      : `error: ${tideRes.error}`,
    promptData: null,
    contributed: tideRes.ok && !!tideRes.data,
    decision: tideRes.ok
      ? tideRes.data
        ? "Tide data available for glyph bar"
        : `Skipped: ${tideRes.reason ?? "no nearby station"}`
      : `Error: ${tideRes.error}`,
    durationMs: tideDuration,
    error: tideRes.ok ? null : tideRes.error,
  };

  const providerTraces = [
    weatherTrace,
    skyResult.trace,
    sportsResult.trace,
    eventsResult.trace,
    historyResult.trace,
    redditResult.trace,
    localNewsResult.trace,
    communityEventsResult.trace,
    tideTrace,
  ];

  // 4. Gather moments — tides are glyph-only, don't include in LLM prompt moments
  const moments: MomentContext[] = [
    ...skyResult.moments,
    ...sportsResult.moments,
    ...eventsResult.moments,
    ...historyResult.moments,
    ...redditResult.moments,
    ...localNewsResult.moments,
    ...communityEventsResult.moments,
  ];

  // 5. Determine LLM-only categories
  const coveredCategories = new Set(moments.map((m) => m.category));
  const llmOnlyCategories: string[] = [];
  if (!coveredCategories.has("nature")) llmOnlyCategories.push("nature");
  if (!coveredCategories.has("local-scene")) llmOnlyCategories.push("local-scene");
  if (!coveredCategories.has("earth-garden")) llmOnlyCategories.push("earth-garden");
  if (!coveredCategories.has("food")) llmOnlyCategories.push("food");

  // 6. Build prompt (same as generate-feed.ts)
  const momentData = moments
    .map((m) => `[${m.category}] (source: ${m.source})\n${m.data}`)
    .join("\n\n");

  const llmOnlyInstructions: string[] = [];
  if (!coveredCategories.has("nature")) llmOnlyInstructions.push("nature(3): what's happening in nature RIGHT NOW — migrating/arriving birds, flowers blooming (daffodils, cherry blossoms, crocuses), trees budding or leafing out, seasonal fungi, tidal patterns. Be phenologically specific to this week and region. Skip if nothing specific to this week/season/place.");
  if (!coveredCategories.has("local-scene")) llmOnlyInstructions.push("local-scene(1): a specific real neighborhood, park, street, or local institution (e.g. a beloved independent radio station, bookstore, coffee roaster) — NOT the city's most famous tourist landmark. Rotate through a variety of neighborhoods, parks, and local institutions — only feature the city's most famous landmark if something specific and timely is happening there. Skip if nothing specific to this week/season/place.");
  if (!coveredCategories.has("earth-garden")) llmOnlyInstructions.push("earth-garden(1): pick whichever is more fascinating today — local geology (volcanic history, glacial features, fault lines, soil composition, notable rock formations) OR a timely gardening tip for the region. Vary between the two across days. Skip if nothing specific to this week/season/place.");
  if (!coveredCategories.has("food")) llmOnlyInstructions.push("food/community(1): seasonal ingredient, local dish, or community tradition. Skip if nothing specific to this week/season/place.");

  const promptText = `Write a daily feed for ${city} on ${date} (timezone: ${loc.timezone}). Return ONLY a JSON array, no markdown.

## Structured data from APIs (use this verbatim for these categories):
${momentData}

## Categories you must generate from your knowledge:
${llmOnlyInstructions.join("\n")}

## Rules
- For categories with API data above, write compelling prose BASED ON that data. Don't invent different events/games.
- "sky" gets 1 item about golden hour, sunset quality, and daylight milestones. Do NOT repeat sunrise/sunset times or moon phase (shown separately in the UI glyphs).
- "space" gets 1 item about visible planets, constellations, and notable celestial objects tonight. Be specific about where to look (compass direction) and when. Do NOT repeat moon phase (shown in glyphs).
- sports gets 1 item: consolidate the game data into one engaging summary. If no sports data was provided, skip this category entirely.
- events gets 1 item: pick the 2-3 best events and highlight them. If no events data was provided, skip this category entirely.
- history gets 1 item: STRONGLY prefer an on-this-day fact with a direct connection to ${city} or its region (state, Pacific NW, etc). If none connect, use your own knowledge ONLY if you are highly confident about the specific date. If you cannot confidently tie a specific event to this exact date, write about a seasonal historical pattern for the region instead (e.g. "This time of year in the 1850s, settlers were..." or "Late March historically marked..."). NEVER fabricate or guess specific dates — getting a date wrong is worse than being general. Include indigenous history when relevant.
- If community/reddit data was provided, write 1 community item highlighting the most interesting local intel. Focus on actionable tips, timely discoveries, or useful PSAs — not complaints or generic chatter.
- If culture data was provided, use it for the culture item. Otherwise pick 1 from culture/food/community.
- Aim for 10 items, but only include what's genuinely relevant — fewer is fine. Do not pad with generic filler.
${recentTopics && recentTopics.length > 0 ? `\n## Recently covered topics (vary your coverage, avoid repeating these):\n${recentTopics.join(", ")}` : ""}

Each object: {"id":"slug","title":"5-10 words","body":"2-3 sentences plain text","category":"...","confidence":"high|medium|low","imageQuery":"specific 2-4 word Pexels search for the SINGLE most visual subject in your body text. If the body mentions multiple things (e.g. cherry blossoms AND returning swallows), pick the ONE most visually striking for the image — do NOT try to summarize everything. Examples: 'cherry blossoms branch closeup' not 'spring nature seattle', 'barn swallow flight' not 'birds flowers'. NEVER use a famous landmark unless the body is actually about that landmark. For sky-space: use the specific constellation or planet name (e.g. 'orion constellation stars' not 'night sky')."}

Tone: knowledgeable local friend. No HTML tags.`;

  // 7. Call Claude
  const llmStart = Date.now();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: promptText }],
  });
  const llmDuration = Date.now() - llmStart;

  let responseText = "";
  for (const block of message.content) {
    if (block.type === "text") {
      responseText = block.text;
      break;
    }
  }

  const llmTrace: LLMTrace = {
    model: "claude-haiku-4-5-20251001",
    promptText,
    responseText,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
    durationMs: llmDuration,
    llmOnlyCategories,
    apiCoveredCategories: Array.from(coveredCategories),
  };

  // 8. Parse and normalize cards
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  let rawItems: FeedItem[] = [];
  if (jsonMatch) {
    try {
      rawItems = JSON.parse(jsonMatch[0]);
    } catch {
      rawItems = [];
    }
  }

  // Map each card to its data source
  const sourceByCategory: Record<string, string> = {};
  for (const m of moments) {
    sourceByCategory[m.category] = m.source;
  }

  const cards: CardTrace[] = rawItems.map((item) => {
    const cat = normalizeCategory(item.category);
    return {
      id: item.id,
      title: item.title,
      body: item.body,
      category: (cat ?? item.category) as Category,
      confidence: item.confidence,
      imageQuery: item.imageQuery,
      dataSource: sourceByCategory[cat ?? item.category] ?? "llm-knowledge",
      normalized: cat !== null,
      feedback: null, // populated later from DB
    };
  });

  // 9. Glyphs
  const glyphErrors: GlyphData["errors"] = {};
  const glyphNotes: GlyphData["notes"] = {};
  let astro: ReturnType<typeof getAstroData> | null = null;
  try {
    astro = getAstroData(lat, lng, new Date(), timezone);
  } catch (e) {
    glyphErrors.astro = e instanceof Error ? e.message : String(e);
  }
  if (!weatherResult) glyphErrors.weather = "open-meteo returned no data";

  let tide: GlyphData["tide"] = null;
  if (tideRes.ok) {
    if (tideRes.data) {
      tide = { state: tideRes.data.state, nextHigh: tideRes.data.nextHigh, nextLow: tideRes.data.nextLow };
    } else if (tideRes.reason) {
      glyphNotes.tide = tideRes.reason;
    }
  } else {
    glyphErrors.tide = tideRes.error;
  }

  const glyphs: GlyphData = {
    weather: weatherResult ? { temp: weatherResult.temp, code: weatherResult.code } : null,
    sunrise: astro?.sunrise ?? "",
    sunset: astro?.sunset ?? "",
    moonPhase: astro?.moonPhase ?? "",
    moonIllumination: astro?.moonIllumination ?? 0,
    tide,
    errors: glyphErrors,
    notes: glyphNotes,
  };

  return {
    city,
    date,
    dateISO,
    timezone,
    lat,
    lng,
    totalDurationMs: Date.now() - totalStart,
    providers: providerTraces,
    llm: llmTrace,
    cards,
    glyphs,
  };
}

// Helper to show subreddit mapping in debug output
function getSubredditsForDebug(city: string): string[] {
  const CITY_SUBREDDITS: Record<string, string[]> = {
    seattle: ["Seattle", "seattlewa"],
    portland: ["Portland"],
    "san francisco": ["sanfrancisco", "bayarea"],
    "los angeles": ["LosAngeles"],
    "new york": ["nyc"],
    chicago: ["chicago"],
    austin: ["Austin"],
    denver: ["Denver"],
    boston: ["boston"],
    minneapolis: ["TwinCities"],
    "st. paul": ["TwinCities"],
    philadelphia: ["philadelphia"],
    nashville: ["nashville"],
    "washington dc": ["washingtondc"],
    atlanta: ["Atlanta"],
    miami: ["Miami"],
    detroit: ["Detroit"],
    pittsburgh: ["pittsburgh"],
    "salt lake city": ["SaltLakeCity"],
    "san diego": ["sandiego"],
    houston: ["houston"],
    dallas: ["Dallas"],
  };
  const key = city.split(",")[0].trim().toLowerCase();
  if (CITY_SUBREDDITS[key]) return CITY_SUBREDDITS[key];
  for (const [name, subs] of Object.entries(CITY_SUBREDDITS)) {
    if (key.includes(name) || name.includes(key)) return subs;
  }
  return [key.replace(/\s+/g, "")];
}

// Mirrors the feed list in lib/moments/local-news.ts so debug shows which RSS feeds were tried
function getNewsFeedsForDebug(city: string): { name: string; url: string }[] {
  const FEEDS: Record<string, { name: string; url: string }[]> = {
    seattle: [
      { name: "The Stranger", url: "https://www.thestranger.com/rss/news" },
      { name: "Seattle Times", url: "https://www.seattletimes.com/feed/" },
    ],
    portland: [
      { name: "OregonLive", url: "https://www.oregonlive.com/arc/outboundfeeds/rss/?outputType=xml" },
      { name: "Willamette Week", url: "https://www.wweek.com/feed/" },
    ],
    "san francisco": [
      { name: "SFGate", url: "https://www.sfgate.com/feed/sfgate/rss.xml" },
      { name: "SF Chronicle", url: "https://www.sfchronicle.com/feed/sfgate/rss.xml" },
    ],
    "los angeles": [
      { name: "LAist", url: "https://laist.com/feed" },
      { name: "LA Times", url: "https://www.latimes.com/local/rss2.0.xml" },
    ],
    "new york": [
      { name: "Gothamist", url: "https://gothamist.com/feed" },
      { name: "amNY", url: "https://www.amny.com/feed/" },
    ],
    chicago: [
      { name: "Block Club Chicago", url: "https://blockclubchicago.org/feed/" },
      { name: "Chicago Sun-Times", url: "https://chicago.suntimes.com/rss/index.xml" },
    ],
    austin: [{ name: "Austin Chronicle", url: "https://www.austinchronicle.com/gyrobase/feed" }],
    denver: [
      { name: "Westword", url: "https://www.westword.com/denver/Rss.xml" },
      { name: "Denver Post", url: "https://www.denverpost.com/feed/" },
    ],
    boston: [{ name: "Boston Globe", url: "https://www.bostonglobe.com/arc/outboundfeeds/rss/?outputType=xml" }],
    nashville: [{ name: "Nashville Scene", url: "https://www.nashvillescene.com/nashville/Rss.xml" }],
    "washington dc": [
      { name: "DCist", url: "https://dcist.com/feed" },
      { name: "Washington City Paper", url: "https://washingtoncitypaper.com/feed/" },
    ],
    atlanta: [{ name: "Atlanta Journal-Constitution", url: "https://www.ajc.com/arc/outboundfeeds/rss/?outputType=xml" }],
    miami: [{ name: "Miami New Times", url: "https://www.miaminewtimes.com/miami/Rss.xml" }],
    minneapolis: [
      { name: "City Pages / Racket", url: "https://racketmn.com/feed/" },
      { name: "Star Tribune", url: "https://www.startribune.com/local/feed/" },
    ],
    philadelphia: [{ name: "Billy Penn", url: "https://billypenn.com/feed/" }],
    pittsburgh: [{ name: "Pittsburgh Post-Gazette", url: "https://www.post-gazette.com/rss/local" }],
    "salt lake city": [{ name: "Salt Lake Tribune", url: "https://www.sltrib.com/feed/" }],
    "san diego": [{ name: "San Diego Union-Tribune", url: "https://www.sandiegouniontribune.com/feed/" }],
    houston: [{ name: "Houston Chronicle", url: "https://www.houstonchronicle.com/feed/sfgate/rss.xml" }],
    dallas: [{ name: "Dallas Observer", url: "https://www.dallasobserver.com/dallas/Rss.xml" }],
  };
  const key = city.split(",")[0].trim().toLowerCase();
  if (FEEDS[key]) return FEEDS[key];
  for (const [name, feeds] of Object.entries(FEEDS)) {
    if (key.includes(name) || name.includes(key)) return feeds;
  }
  return [];
}

// Mirrors the source map in lib/moments/community-events.ts so debug shows which Socrata endpoint was hit
function getCommunityEventEndpointForDebug(city: string): string {
  const ENDPOINTS: Record<string, string> = {
    "new york": "https://data.cityofnewyork.us/resource/tvpp-9vvx.json",
    chicago: "https://data.cityofchicago.org/resource/xgse-8eg7.json",
    "los angeles": "https://data.lacity.org/resource/8spw-3fhx.json",
    seattle: "https://data.seattle.gov/resource/dm95-f8w5.json",
  };
  const key = city.split(",")[0].trim().toLowerCase();
  if (ENDPOINTS[key]) return ENDPOINTS[key];
  for (const [name, ep] of Object.entries(ENDPOINTS)) {
    if (key.includes(name) || name.includes(key)) return ep;
  }
  return "(no Socrata endpoint for this city — provider will return [])";
}
