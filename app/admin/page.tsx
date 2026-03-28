"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface Stats {
  feedbackCounts: Array<{
    city: string;
    category: string;
    rating: string;
    count: number;
  }>;
  dailyFeeds: Array<{ date: string; count: number }>;
  engagement: { avg_scroll_depth: number; avg_cards_viewed: number };
  retention: { today: number; this_week: number; this_month: number };
  cities: string[];
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);

  // Check admin access once session loads
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/auth")
        .then((r) => r.json())
        .then((d) => setIsAdmin(d.authenticated))
        .catch(() => setIsAdmin(false));
    } else if (status === "unauthenticated") {
      setIsAdmin(false);
    }
  }, [status]);

  // Fetch stats once admin is confirmed
  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    const url = city
      ? `/api/preview/stats?city=${encodeURIComponent(city)}`
      : "/api/preview/stats";
    fetch(url)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin, city]);

  if (status === "loading" || isAdmin === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="font-serif text-xl font-bold">JustB Admin</h1>
          <button
            onClick={() => signIn("google")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-xl font-bold">Access Denied</h1>
          <p className="text-sm text-[var(--text-muted)]">
            You don&apos;t have permission to view this page.
          </p>
          <button
            onClick={() => signOut()}
            className="text-sm text-blue-600 hover:underline mt-2"
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (loading || !stats) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading stats...</p>
      </main>
    );
  }

  // Aggregate feedback into a table
  const feedbackTable: Record<
    string,
    Record<string, { good: number; irrelevant: number; inaccurate: number }>
  > = {};
  for (const row of stats.feedbackCounts) {
    if (!feedbackTable[row.city]) feedbackTable[row.city] = {};
    if (!feedbackTable[row.city][row.category]) {
      feedbackTable[row.city][row.category] = {
        good: 0,
        irrelevant: 0,
        inaccurate: 0,
      };
    }
    feedbackTable[row.city][row.category][
      row.rating as "good" | "irrelevant" | "inaccurate"
    ] = row.count;
  }

  const maxDailyCount = Math.max(1, ...stats.dailyFeeds.map((d) => d.count));

  return (
    <main className="min-h-screen pb-12">
      <header className="border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-bold">JustB Admin</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Quality &amp; engagement dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 bg-[var(--bg)]"
            >
              <option value="">All cities</option>
              {stats.cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={() => signOut()}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-8">
        {/* Feedback */}
        <section>
          <h2 className="font-serif text-lg font-semibold mb-3">
            Category Quality
          </h2>
          {Object.keys(feedbackTable).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No feedback yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 pr-4">City</th>
                    <th className="text-left py-2 pr-4">Category</th>
                    <th className="text-right py-2 pr-4 text-emerald-600">
                      Good
                    </th>
                    <th className="text-right py-2 pr-4 text-amber-600">
                      Irrelevant
                    </th>
                    <th className="text-right py-2 text-red-600">
                      Inaccurate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(feedbackTable).map(([fbCity, categories]) =>
                    Object.entries(categories).map(
                      ([category, counts], idx) => (
                        <tr
                          key={`${fbCity}-${category}`}
                          className="border-b border-[var(--border)]/50"
                        >
                          <td className="py-1.5 pr-4">
                            {idx === 0 ? fbCity : ""}
                          </td>
                          <td className="py-1.5 pr-4">{category}</td>
                          <td className="py-1.5 pr-4 text-right">
                            {counts.good || "-"}
                          </td>
                          <td className="py-1.5 pr-4 text-right">
                            {counts.irrelevant || "-"}
                          </td>
                          <td className="py-1.5 text-right">
                            {counts.inaccurate || "-"}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Usage */}
        <section>
          <h2 className="font-serif text-lg font-semibold mb-3">
            Usage (last 14 days)
          </h2>
          {stats.dailyFeeds.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No sessions yet.</p>
          ) : (
            <div className="space-y-1">
              {stats.dailyFeeds.map((d) => (
                <div key={d.date} className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-[var(--text-muted)] shrink-0">
                    {new Date(d.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                  <div className="flex-1 h-5 bg-[var(--border)]/30 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{
                        width: `${(d.count / maxDailyCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-[var(--text-muted)]">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Engagement */}
        <section>
          <h2 className="font-serif text-lg font-semibold mb-3">Engagement</h2>
          <div className="grid grid-cols-2 gap-4">
            <div
              className="bg-[var(--bg-card)] rounded-xl p-4"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <p className="text-2xl font-bold">
                {Math.round(
                  (stats.engagement.avg_scroll_depth ?? 0) * 100
                )}
                %
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Avg scroll depth
              </p>
            </div>
            <div
              className="bg-[var(--bg-card)] rounded-xl p-4"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <p className="text-2xl font-bold">
                {stats.engagement.avg_cards_viewed ?? 0}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Avg cards viewed
              </p>
            </div>
          </div>
        </section>

        {/* Retention */}
        <section>
          <h2 className="font-serif text-lg font-semibold mb-3">Retention</h2>
          <div className="grid grid-cols-3 gap-4">
            <div
              className="bg-[var(--bg-card)] rounded-xl p-4"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <p className="text-2xl font-bold">{stats.retention.today}</p>
              <p className="text-xs text-[var(--text-muted)]">Today</p>
            </div>
            <div
              className="bg-[var(--bg-card)] rounded-xl p-4"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <p className="text-2xl font-bold">{stats.retention.this_week}</p>
              <p className="text-xs text-[var(--text-muted)]">This week</p>
            </div>
            <div
              className="bg-[var(--bg-card)] rounded-xl p-4"
              style={{ boxShadow: "var(--shadow)" }}
            >
              <p className="text-2xl font-bold">
                {stats.retention.this_month}
              </p>
              <p className="text-xs text-[var(--text-muted)]">This month</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
