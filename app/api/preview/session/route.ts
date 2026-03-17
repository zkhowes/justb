import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE !== "true") {
    return NextResponse.json({ error: "Preview mode disabled" }, { status: 403 });
  }

  const body = await request.json();
  const sql = getSql();

  // Update existing session (from sendBeacon scroll tracking)
  if (body.id && body.scrollDepth !== undefined) {
    await sql`
      UPDATE sessions
      SET cards_viewed = ${body.cardsViewed}, scroll_depth = ${body.scrollDepth}
      WHERE id = ${body.id}
    `;
    return NextResponse.json({ ok: true });
  }

  // Create new session
  const { sessionId, city, feedItemCount } = body;
  if (!sessionId || !city) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const result = await sql`
    INSERT INTO sessions (session_id, city, feed_item_count)
    VALUES (${sessionId}, ${city}, ${feedItemCount || null})
    RETURNING id
  `;

  return NextResponse.json({ id: result[0]?.id });
}
