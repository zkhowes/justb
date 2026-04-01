import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { generateFeedWithTrace, CardFeedback } from "@/lib/debug-trace";
import { getSql } from "@/lib/db";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const trace = await generateFeedWithTrace(city, date);

    // Fetch any existing feedback for these cards
    try {
      const sql = getSql();
      const feedback = await sql`
        SELECT item_id, rating, reason, created_at
        FROM feedback
        WHERE city = ${city}
        ORDER BY created_at DESC
      `;

      // Match feedback to cards by item_id
      const feedbackByItem = new Map<string, CardFeedback>();
      for (const row of feedback) {
        if (!feedbackByItem.has(row.item_id)) {
          feedbackByItem.set(row.item_id, {
            rating: row.rating as CardFeedback["rating"],
            reason: row.reason,
            createdAt: row.created_at,
          });
        }
      }

      for (const card of trace.cards) {
        card.feedback = feedbackByItem.get(card.id) ?? null;
      }
    } catch {
      // DB not configured — feedback will be null
    }

    return NextResponse.json(trace);
  } catch (error) {
    console.error("Debug feed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate debug feed" },
      { status: 500 }
    );
  }
}
