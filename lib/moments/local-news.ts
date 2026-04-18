import { MomentContext, LocationContext } from "./types";

interface RssItem {
  title: string;
  description: string;
  pubDate: string;
  link: string;
}

/**
 * Map cities to local news RSS feeds.
 * These are real, stable RSS feeds from major local outlets.
 */
const CITY_NEWS_FEEDS: Record<string, { name: string; url: string }[]> = {
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
  austin: [
    { name: "Austin Chronicle", url: "https://www.austinchronicle.com/gyrobase/feed" },
  ],
  denver: [
    { name: "Westword", url: "https://www.westword.com/denver/Rss.xml" },
    { name: "Denver Post", url: "https://www.denverpost.com/feed/" },
  ],
  boston: [
    { name: "Boston Globe", url: "https://www.bostonglobe.com/arc/outboundfeeds/rss/?outputType=xml" },
  ],
  nashville: [
    { name: "Nashville Scene", url: "https://www.nashvillescene.com/nashville/Rss.xml" },
  ],
  "washington dc": [
    { name: "DCist", url: "https://dcist.com/feed" },
    { name: "Washington City Paper", url: "https://washingtoncitypaper.com/feed/" },
  ],
  atlanta: [
    { name: "Atlanta Journal-Constitution", url: "https://www.ajc.com/arc/outboundfeeds/rss/?outputType=xml" },
  ],
  miami: [
    { name: "Miami New Times", url: "https://www.miaminewtimes.com/miami/Rss.xml" },
  ],
  minneapolis: [
    { name: "City Pages / Racket", url: "https://racketmn.com/feed/" },
    { name: "Star Tribune", url: "https://www.startribune.com/local/feed/" },
  ],
  philadelphia: [
    { name: "Billy Penn", url: "https://billypenn.com/feed/" },
  ],
  pittsburgh: [
    { name: "Pittsburgh Post-Gazette", url: "https://www.post-gazette.com/rss/local" },
  ],
  "salt lake city": [
    { name: "Salt Lake Tribune", url: "https://www.sltrib.com/feed/" },
  ],
  "san diego": [
    { name: "San Diego Union-Tribune", url: "https://www.sandiegouniontribune.com/feed/" },
  ],
  houston: [
    { name: "Houston Chronicle", url: "https://www.houstonchronicle.com/feed/sfgate/rss.xml" },
  ],
  dallas: [
    { name: "Dallas Observer", url: "https://www.dallasobserver.com/dallas/Rss.xml" },
  ],
};

function getCityFeeds(city: string): { name: string; url: string }[] {
  const key = city.split(",")[0].trim().toLowerCase();
  if (CITY_NEWS_FEEDS[key]) return CITY_NEWS_FEEDS[key];
  for (const [name, feeds] of Object.entries(CITY_NEWS_FEEDS)) {
    if (key.includes(name) || name.includes(key)) return feeds;
  }
  return [];
}

/** Minimal RSS XML parser — extracts <item> elements without a dependency */
function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      block.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
    const description =
      block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
      block.match(/<description>(.*?)<\/description>/)?.[1] ?? "";
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
    if (title) {
      items.push({
        title: title.replace(/<[^>]*>/g, "").trim(),
        description: description.replace(/<[^>]*>/g, "").slice(0, 200).trim(),
        pubDate,
        link,
      });
    }
  }
  return items;
}

/** Check if an RSS item was published today */
function isFromToday(pubDate: string, dateISO: string): boolean {
  if (!pubDate) return true; // If no date, include it (benefit of the doubt)
  try {
    const pub = new Date(pubDate).toISOString().slice(0, 10);
    return pub === dateISO;
  } catch {
    return true;
  }
}

export async function fetchLocalNewsMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const feeds = getCityFeeds(loc.city);
  if (feeds.length === 0) return [];

  const allItems: { source: string; item: RssItem }[] = [];

  const results = await Promise.allSettled(
    feeds.slice(0, 2).map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "JustB/1.0 (local news aggregator)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[News] ${feed.name} returned ${res.status}`);
        return [];
      }
      const xml = await res.text();
      const items = parseRssItems(xml);
      return items
        .filter((item) => isFromToday(item.pubDate, loc.dateISO))
        .slice(0, 8)
        .map((item) => ({ source: feed.name, item }));
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  if (allItems.length === 0) return [];

  const top = allItems.slice(0, 8);
  const lines = top.map(
    ({ source, item }) =>
      `[${source}] ${item.title}${item.description ? ` — ${item.description}` : ""}`
  );

  console.log(`[News] ${loc.city}: ${allItems.length} items from ${feeds.map((f) => f.name).join(", ")}`);

  return [
    {
      category: "community",
      source: "local-news",
      data: `Local news headlines for ${loc.city} today:\n${lines.join("\n")}\n\nPick the 1-2 most interesting or surprising local stories. Skip national news, crime blotters, and generic politics. Focus on things that make someone say "oh cool" or "good to know" — local discoveries, neighborhood happenings, cultural moments, useful PSAs. Write as a knowledgeable local friend.`,
    },
  ];
}
