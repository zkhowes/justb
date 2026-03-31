import { NextRequest, NextResponse } from "next/server";
import { buildBackgroundQuery, buildFallbackQuery } from "@/lib/background";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

async function searchPexelsBackground(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY) return null;

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const photos = data.photos;
    if (!photos?.length) return null;

    const pick = photos[Math.floor(Math.random() * photos.length)];
    return pick?.src?.large ?? pick?.src?.medium ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const isNight = searchParams.get("night") === "true";

  if (!city) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const query = buildBackgroundQuery(city, month, isNight);
  let url = await searchPexelsBackground(query);

  if (!url) {
    const fallback = buildFallbackQuery(month);
    url = await searchPexelsBackground(fallback);
  }

  return NextResponse.json(
    { url },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    }
  );
}
