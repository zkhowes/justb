import { MomentContext, LocationContext } from "./types";

interface RedditPost {
  data: {
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    created_utc: number;
    link_flair_text?: string;
    url: string;
    is_self: boolean;
    over_18: boolean;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

/**
 * Map common city names to their subreddit(s).
 * Reddit city subs don't always match the city name exactly.
 */
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
  // Direct match first
  if (CITY_SUBREDDITS[key]) return CITY_SUBREDDITS[key];
  // Partial match
  for (const [name, subs] of Object.entries(CITY_SUBREDDITS)) {
    if (key.includes(name) || name.includes(key)) return subs;
  }
  // Fallback: try the city name as a subreddit
  return [key.replace(/\s+/g, "")];
}

/** Filters for posts that signal local/timely info */
function isRelevantPost(post: RedditPost["data"]): boolean {
  if (post.over_18) return false;
  if (post.score < 5) return false;

  const text = `${post.title} ${post.selftext}`.toLowerCase();

  // Skip generic complaints, memes, photos with no info
  const skipPatterns = [
    /\b(rant|vent|unpopular opinion)\b/,
    /\b(moving to|should i move)\b/,
    /\b(landlord|rent increase)\b/,
    /\b(meme|shitpost)\b/,
  ];
  if (skipPatterns.some((p) => p.test(text))) return false;

  // Boost posts that mention timely/local signals
  const boostPatterns = [
    /\b(today|tonight|this weekend|this morning|happening now)\b/,
    /\b(open|opening|new|pop.?up|farmers.?market)\b/,
    /\b(free|festival|fair|block party|art walk)\b/,
    /\b(recommend|best|favorite|hidden gem)\b/,
    /\b(closed|closure|avoid|heads up|psa)\b/,
    /\b(cherry blossom|bloom|tulip|season)\b/,
  ];
  const boostCount = boostPatterns.filter((p) => p.test(text)).length;

  // Require at least some engagement and relevance signal
  return boostCount > 0 || post.num_comments >= 10;
}

/** Cache the OAuth token in-memory (survives across requests on Fluid Compute) */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Reuse cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "User-Agent": "JustB/1.0 (by zkhowes)",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    console.warn(`[Reddit] OAuth token request failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export async function fetchRedditMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const subreddits = getSubreddits(loc.city);
  const allPosts: RedditPost["data"][] = [];

  // Try OAuth first (works from Vercel IPs), fall back to public endpoint
  const token = await getRedditToken().catch(() => null);
  const useOAuth = !!token;
  const baseUrl = useOAuth
    ? "https://oauth.reddit.com"
    : "https://www.reddit.com";
  const headers: Record<string, string> = {
    "User-Agent": "JustB:1.0.0 (by /u/zkhowes)",
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Without OAuth, limit to 1 subreddit and fewer posts to reduce rate-limit risk
  const maxSubs = useOAuth ? 2 : 1;
  const postLimit = useOAuth ? 25 : 15;

  for (const sub of subreddits.slice(0, maxSubs)) {
    try {
      const url = useOAuth
        ? `${baseUrl}/r/${sub}/hot.json?limit=${postLimit}`
        : `${baseUrl}/r/${sub}/hot.json?limit=${postLimit}&raw_json=1`;
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 429) {
        console.warn(`[Reddit] r/${sub} rate-limited (429), skipping`);
        break; // Don't try more subs if rate-limited
      }
      if (res.status === 403) {
        console.warn(`[Reddit] r/${sub} blocked (403) — may need OAuth credentials`);
        break;
      }
      if (!res.ok) {
        console.warn(
          `[Reddit] r/${sub} returned ${res.status} ${res.statusText}`
        );
        continue;
      }

      // Verify we got JSON, not HTML (Reddit sometimes returns login pages)
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        console.warn(`[Reddit] r/${sub} returned non-JSON content-type: ${contentType}`);
        continue;
      }

      const data: RedditListing = await res.json();
      const posts = data.data.children
        .map((c) => c.data)
        .filter(isRelevantPost);
      console.log(
        `[Reddit] r/${sub}: ${data.data.children.length} posts, ${posts.length} passed filter`
      );
      allPosts.push(...posts);
    } catch (err) {
      console.error(
        `[Reddit] r/${sub} error:`,
        err instanceof Error ? err.message : err
      );
      continue;
    }
  }

  if (allPosts.length === 0) return [];

  // Sort by relevance (score * recency)
  const now = Date.now() / 1000;
  allPosts.sort((a, b) => {
    const ageA = Math.max(1, (now - a.created_utc) / 3600); // hours old
    const ageB = Math.max(1, (now - b.created_utc) / 3600);
    return b.score / ageB - a.score / ageA;
  });

  const top = allPosts.slice(0, 5);
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
      data: `Trending on r/${subreddits[0]} today:\n${lines.join("\n")}\n\nPick the 1-2 most interesting/useful items for someone living in ${loc.city}. Skip complaints, housing posts, and generic questions. Focus on things happening today, local discoveries, or timely PSAs. Write as a knowledgeable local friend sharing useful intel.`,
    },
  ];
}
