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

export async function fetchRedditMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const subreddits = getSubreddits(loc.city);

  const allPosts: RedditPost["data"][] = [];

  for (const sub of subreddits.slice(0, 2)) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/hot.json?limit=25`,
        {
          headers: {
            "User-Agent": "JustB/1.0 (by zkhowes)",
          },
        }
      );
      if (!res.ok) continue;
      const data: RedditListing = await res.json();
      const posts = data.data.children
        .map((c) => c.data)
        .filter(isRelevantPost);
      allPosts.push(...posts);
    } catch {
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
