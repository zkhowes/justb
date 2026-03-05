import { NextRequest, NextResponse } from "next/server";
import { generateFeed } from "@/lib/generate-feed";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const date =
    searchParams.get("date") ||
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  if (!city) {
    return NextResponse.json(
      { error: "city parameter is required" },
      { status: 400 }
    );
  }

  try {
    const items = await generateFeed(city, date);
    return NextResponse.json(items, {
      headers: {
        // Cache on CDN for 4 hours, stale-while-revalidate for 8
        "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=28800",
      },
    });
  } catch (error) {
    console.error("Feed generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate feed" },
      { status: 500 }
    );
  }
}
