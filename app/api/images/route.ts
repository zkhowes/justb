import { NextRequest, NextResponse } from "next/server";
import { enrichWithImages } from "@/lib/images";
import { FeedItem } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const items: FeedItem[] = await request.json();
    const enriched = await enrichWithImages(items);

    // Return just the id -> imageUrl mapping
    const imageMap: Record<string, string> = {};
    for (const item of enriched) {
      if (item.imageUrl) {
        imageMap[item.id] = item.imageUrl;
      }
    }

    return NextResponse.json(imageMap);
  } catch (error) {
    console.error("Image enrichment error:", error);
    return NextResponse.json({});
  }
}
