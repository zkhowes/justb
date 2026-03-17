import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE !== "true") {
    return NextResponse.json({ error: "Preview mode disabled" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const sql = getSql();

  // Feedback counts by city/category/rating
  const feedbackCounts = city
    ? await sql`
        SELECT city, category, rating, COUNT(*)::int as count
        FROM feedback WHERE city = ${city}
        GROUP BY city, category, rating
        ORDER BY city, category, rating
      `
    : await sql`
        SELECT city, category, rating, COUNT(*)::int as count
        FROM feedback
        GROUP BY city, category, rating
        ORDER BY city, category, rating
      `;

  // Daily feed count (last 14 days)
  const dailyFeeds = city
    ? await sql`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM sessions WHERE city = ${city}
          AND created_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    : await sql`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM sessions
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;

  // Avg scroll depth + cards viewed
  const engagement = city
    ? await sql`
        SELECT
          ROUND(AVG(scroll_depth)::numeric, 2) as avg_scroll_depth,
          ROUND(AVG(cards_viewed)::numeric, 1) as avg_cards_viewed
        FROM sessions WHERE city = ${city} AND scroll_depth > 0
      `
    : await sql`
        SELECT
          ROUND(AVG(scroll_depth)::numeric, 2) as avg_scroll_depth,
          ROUND(AVG(cards_viewed)::numeric, 1) as avg_cards_viewed
        FROM sessions WHERE scroll_depth > 0
      `;

  // Unique sessions: today / this week / this month
  const retention = city
    ? await sql`
        SELECT
          COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN session_id END)::int as today,
          COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN session_id END)::int as this_week,
          COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN session_id END)::int as this_month
        FROM sessions WHERE city = ${city}
      `
    : await sql`
        SELECT
          COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN session_id END)::int as today,
          COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN session_id END)::int as this_week,
          COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN session_id END)::int as this_month
        FROM sessions
      `;

  // Distinct cities for filter dropdown
  const cities = await sql`SELECT DISTINCT city FROM sessions ORDER BY city`;

  return NextResponse.json({
    feedbackCounts,
    dailyFeeds,
    engagement: engagement[0] ?? { avg_scroll_depth: 0, avg_cards_viewed: 0 },
    retention: retention[0] ?? { today: 0, this_week: 0, this_month: 0 },
    cities: cities.map((r) => r.city),
  });
}
