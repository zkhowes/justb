import { FeedItem } from "./types";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

async function searchPexels(
  query: string
): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data.photos?.[0]?.src?.medium ?? null;
  } catch {
    return null;
  }
}

export async function enrichWithImages(
  items: FeedItem[]
): Promise<FeedItem[]> {
  if (!PEXELS_API_KEY) return items;

  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (!item.imageQuery) return item;
      const imageUrl = await searchPexels(item.imageQuery);
      return imageUrl ? { ...item, imageUrl } : item;
    })
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : items[i]
  );
}
