import { MomentContext, LocationContext } from "./types";
import { getLocalTerms, getNewsFeeds, getNonLocalPatterns } from "../city-enrichment";

interface RssItem {
  title: string;
  description: string;
  pubDate: string;
  link: string;
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

function isLocalItem(item: RssItem, loc: LocationContext): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();

  if (getNonLocalPatterns(loc.city).some((pattern) => pattern.test(text))) return false;

  const terms = getLocalTerms(loc.city);
  return terms.some((term) => text.includes(term));
}

export async function fetchLocalNewsMoments(
  loc: LocationContext
): Promise<MomentContext[]> {
  const feeds = getNewsFeeds(loc.city);
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
        .filter((item) => isLocalItem(item, loc))
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
