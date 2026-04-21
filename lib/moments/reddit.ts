import { MomentContext, LocationContext } from "./types";

interface ArcticShiftPost {
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  created_utc: number;
  link_flair_text?: string | null;
  url: string;
  is_self: boolean;
  over_18: boolean;
}

interface ArcticShiftResponse {
  data: ArcticShiftPost[] | null;
  error?: string;
}

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

function getSubreddits(city: string): string[] {
  const key = city.split(",")[0].trim().toLowerCase();
  if (CITY_SUBREDDITS[key]) return CITY_SUBREDDITS[key];
  for (const [name, subs] of Object.entries(CITY_SUBREDDITS)) {
    if (key.includes(name) || name.includes(key)) return subs;
  }
  return [key.replace(/\s+/g, "")];
}

// Arctic Shift snapshots posts soon after creation, so scores are often low.
// Use a lenient threshold and lean on keyword/engagement signals instead.
function isRelevantPost(post: ArcticShiftPost): boolean {
  if (post.over_18) return false;
  if (post.score < 2 && post.num_comments < 3) return false;

  const text = `${post.title} ${post.selftext ?? ""}`.toLowerCase();

  const skipPatterns = [
    /\b(rant|vent|unpopular opinion)\b/,
    /\b(moving to|should i move)\b/,
    /\b(landlord|rent increase)\b/,
    /\b(meme|shitpost)\b/,
    /\[\s*removed by moderator\s*\]/,
  ];
  if (skipPatterns.some((p) => p.test(text))) return false;

  const boostPatterns = [
    /\b(today|tonight|this weekend|this morning|happening now)\b/,
    /\b(open|opening|new|pop.?up|farmers.?market)\b/,
    /\b(free|festival|fair|block party|art walk)\b/,
    /\b(recommend|best|favorite|hidden gem)\b/,
    /\b(closed|closure|avoid|heads up|psa)\b/,
    /\b(cherry blossom|bloom|tulip|season)\b/,
  ];
  const boostCount = boostPatterns.filter((p) => p.test(text)).length;

  return boostCount > 0 || post.num_comments >= 5;
}

async function fetchSubreddit(
  sub: string,
  afterTs: number
): Promise<ArcticShiftPost[]> {
  const url = `https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${encodeURIComponent(sub)}&sort=desc&limit=100&after=${afterTs}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "JustB/1.0 (https://justb.zkhowes.fun)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.warn(`[Reddit/ArcticShift] r/${sub} returned ${res.status}`);
    return [];
  }
  const body: ArcticShiftResponse = await res.json();
  if (!body.data) {
    console.warn(`[Reddit/ArcticShift] r/${sub} error: ${body.error ?? "no data"}`);
    return [];
  }
  console.log(`[Reddit/ArcticShift] r/${sub}: ${body.data.length} posts in window`);
  return body.data;
}

export async function fetchRedditMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const subreddits = getSubreddits(loc.city);
  const afterTs = Math.floor(Date.now() / 1000) - 48 * 3600;

  const results = await Promise.allSettled(
    subreddits.slice(0, 2).map((sub) => fetchSubreddit(sub, afterTs))
  );

  const allPosts: ArcticShiftPost[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allPosts.push(...r.value);
  }

  const relevant = allPosts.filter(isRelevantPost);
  console.log(
    `[Reddit/ArcticShift] ${allPosts.length} total posts, ${relevant.length} passed filter`
  );
  if (relevant.length === 0) return [];

  const now = Date.now() / 1000;
  relevant.sort((a, b) => {
    const ageA = Math.max(1, (now - a.created_utc) / 3600);
    const ageB = Math.max(1, (now - b.created_utc) / 3600);
    const engA = a.score + a.num_comments * 2;
    const engB = b.score + b.num_comments * 2;
    return engB / ageB - engA / ageA;
  });

  const top = relevant.slice(0, 5);
  const lines = top.map((p) => {
    const flair = p.link_flair_text ? `[${p.link_flair_text}] ` : "";
    const preview = p.selftext
      ? p.selftext.slice(0, 150).replace(/\n/g, " ").trim()
      : "";
    return `${flair}${p.title}${preview ? ` — ${preview}` : ""} (${p.score} upvotes, ${p.num_comments} comments)`;
  });

  return [
    {
      category: "community",
      source: "reddit",
      data: `Recent on r/${subreddits[0]} (last 48h):\n${lines.join("\n")}\n\nPick the 1-2 most interesting/useful items for someone living in ${loc.city}. Skip complaints, housing posts, and generic questions. Focus on things happening today, local discoveries, or timely PSAs. Write as a knowledgeable local friend sharing useful intel.`,
    },
  ];
}
