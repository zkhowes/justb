import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE !== "true") {
    return NextResponse.json({ error: "Preview mode disabled" }, { status: 403 });
  }

  const { city, category, itemId, title, body, rating, reason } = await request.json();

  if (!city || !category || !itemId || !title || !rating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["good", "irrelevant", "inaccurate"].includes(rating)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO feedback (city, category, item_id, title, body, rating, reason)
    VALUES (${city}, ${category}, ${itemId}, ${title}, ${body || null}, ${rating}, ${reason || null})
  `;

  return NextResponse.json({ ok: true });
}
