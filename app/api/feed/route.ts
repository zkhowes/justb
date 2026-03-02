import { NextRequest, NextResponse } from "next/server";
import { generateFeed } from "@/lib/generate-feed";

export const maxDuration = 30;

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
    return NextResponse.json(items);
  } catch (error) {
    console.error("Feed generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate feed" },
      { status: 500 }
    );
  }
}
