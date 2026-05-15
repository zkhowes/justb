import { MomentContext, LocationContext } from "./types";

interface ArcticShiftPost {
  id: string;
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

// Arctic Shift snapshots posts at creation and never updates score/num_comments — the
// post-level fields are stuck at 1/0 forever. Engagement is reconstructed from the comments
// endpoint upstream; this filter assumes num_comments has already been replaced with the
// recent-comment count, and only gates on keyword/content signals.
function isRelevantPost(post: ArcticShiftPost): boolean {
  if (post.over_18) return false;
  if (post.num_comments < 2) return false;

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

interface ArcticShiftComment {
  link_id: string; // "t3_xxxxx" — parent post id
  created_utc: number;
}

// Arctic Shift snapshots posts soon after creation and never updates their score/comment
// count — every post comes back with score=1, num_comments=0 regardless of real engagement.
// Comments are indexed separately and DO accumulate, so we use comment volume in the recent
// window as the engagement signal: count comments by parent post, fetch those parents by id.
// The comments endpoint caps limit at 100, so we paginate with `before` cursors to collect
// a fuller picture of recent activity.
const COMMENT_PAGE_LIMIT = 100;
const COMMENT_MAX_PAGES = 5; // up to 500 comments / sub

async function fetchRecentEngagedPostIds(
  sub: string,
  afterTs: number
): Promise<Map<string, { commentCount: number; lastCommentTs: number }>> {
  const byPost = new Map<string, { commentCount: number; lastCommentTs: number }>();
  let before: number | undefined = undefined;
  let totalFetched = 0;

  for (let page = 0; page < COMMENT_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      subreddit: sub,
      sort: "desc",
      limit: String(COMMENT_PAGE_LIMIT),
      after: String(afterTs),
    });
    if (before !== undefined) params.set("before", String(before));

    const url = `https://arctic-shift.photon-reddit.com/api/comments/search?${params}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "JustB/1.0 (https://justb.zkhowes.fun)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`[Reddit/ArcticShift] comments r/${sub} returned ${res.status}`);
      break;
    }
    const body: { data: ArcticShiftComment[] | null; error?: string } = await res.json();
    if (!body.data || body.data.length === 0) {
      if (body.error) console.warn(`[Reddit/ArcticShift] comments r/${sub} error: ${body.error}`);
      break;
    }

    let oldestTs = Infinity;
    for (const c of body.data) {
      const pid = c.link_id?.replace(/^t3_/, "");
      if (!pid) continue;
      const entry = byPost.get(pid) ?? { commentCount: 0, lastCommentTs: 0 };
      entry.commentCount += 1;
      if (c.created_utc > entry.lastCommentTs) entry.lastCommentTs = c.created_utc;
      byPost.set(pid, entry);
      if (c.created_utc < oldestTs) oldestTs = c.created_utc;
    }
    totalFetched += body.data.length;

    // If we got fewer than a full page, or the oldest comment is before our window, stop.
    if (body.data.length < COMMENT_PAGE_LIMIT || oldestTs <= afterTs) break;
    before = oldestTs;
  }

  console.log(
    `[Reddit/ArcticShift] r/${sub}: ${totalFetched} comments across ${byPost.size} posts`
  );
  return byPost;
}

async function fetchPostsByIds(ids: string[]): Promise<ArcticShiftPost[]> {
  if (ids.length === 0) return [];
  const url = `https://arctic-shift.photon-reddit.com/api/posts/ids?ids=${ids.join(",")}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "JustB/1.0 (https://justb.zkhowes.fun)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.warn(`[Reddit/ArcticShift] posts/ids returned ${res.status}`);
    return [];
  }
  const body: ArcticShiftResponse = await res.json();
  return body.data ?? [];
}

export async function fetchRedditMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const subreddits = getSubreddits(loc.city);
  // 48h window keeps the feed grounded in "now" — posts older than that may still surface
  // if they're still attracting comments today (their lastCommentTs falls inside the window).
  const afterTs = Math.floor(Date.now() / 1000) - 48 * 3600;

  const commentMaps = await Promise.allSettled(
    subreddits.slice(0, 2).map((sub) => fetchRecentEngagedPostIds(sub, afterTs))
  );

  const merged = new Map<string, { commentCount: number; lastCommentTs: number }>();
  for (const r of commentMaps) {
    if (r.status !== "fulfilled") continue;
    r.value.forEach((v, pid) => {
      const cur = merged.get(pid);
      if (!cur) merged.set(pid, v);
      else
        merged.set(pid, {
          commentCount: cur.commentCount + v.commentCount,
          lastCommentTs: Math.max(cur.lastCommentTs, v.lastCommentTs),
        });
    });
  }

  if (merged.size === 0) return [];

  // Top 25 parent posts by recent comment volume — fetch all in one batch
  const topIds = Array.from(merged.entries())
    .sort((a, b) => b[1].commentCount - a[1].commentCount)
    .slice(0, 25)
    .map(([id]) => id);

  const posts = await fetchPostsByIds(topIds);
  if (posts.length === 0) return [];

  // Annotate posts with the engagement signal from comments (overrides the stale num_comments)
  const annotated = posts.map((p) => {
    const eng = merged.get(p.id);
    return {
      ...p,
      num_comments: eng?.commentCount ?? p.num_comments,
      lastCommentTs: eng?.lastCommentTs ?? p.created_utc,
    };
  });

  const relevant = annotated.filter(isRelevantPost);
  console.log(
    `[Reddit/ArcticShift] ${annotated.length} engaged posts, ${relevant.length} passed filter`
  );
  if (relevant.length === 0) return [];

  // Rank by recent-comment momentum: more recent activity + more comments wins.
  // Using lastCommentTs (not created_utc) keeps the focus on what people are talking about
  // right now, even if the underlying post is older.
  const now = Date.now() / 1000;
  relevant.sort((a, b) => {
    const ageA = Math.max(1, (now - a.lastCommentTs) / 3600);
    const ageB = Math.max(1, (now - b.lastCommentTs) / 3600);
    return b.num_comments / ageB - a.num_comments / ageA;
  });

  const top = relevant.slice(0, 5);
  const lines = top.map((p) => {
    const flair = p.link_flair_text ? `[${p.link_flair_text}] ` : "";
    const preview = p.selftext
      ? p.selftext.slice(0, 150).replace(/\n/g, " ").trim()
      : "";
    const ageH = ((now - p.created_utc) / 3600).toFixed(0);
    return `${flair}${p.title}${preview ? ` — ${preview}` : ""} (${p.num_comments} recent comments, posted ${ageH}h ago)`;
  });

  return [
    {
      category: "community",
      source: "reddit",
      data: `Active discussions on r/${subreddits[0]} (last 48h, ranked by recent comment activity):\n${lines.join("\n")}\n\nPick the 1-2 most interesting/useful items for someone living in ${loc.city}. Skip complaints, housing posts, and generic questions. Focus on things happening today, local discoveries, or timely PSAs. Write as a knowledgeable local friend sharing useful intel.`,
    },
  ];
}
