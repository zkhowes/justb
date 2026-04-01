"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Clock,
  Zap,
  Brain,
  Globe,
  Database,
} from "lucide-react";

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

// --- Debug trace types ---

interface ProviderTrace {
  name: string;
  category: string;
  source: string;
  params: Record<string, unknown>;
  rawResponse: string;
  promptData: string | null;
  contributed: boolean;
  decision: string;
  durationMs: number;
  error: string | null;
}

interface LLMTrace {
  model: string;
  promptText: string;
  responseText: string;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  llmOnlyCategories: string[];
  apiCoveredCategories: string[];
}

interface CardFeedback {
  rating: "good" | "irrelevant" | "inaccurate";
  reason: string | null;
  createdAt: string;
}

interface CardTrace {
  id: string;
  title: string;
  body: string;
  category: string;
  confidence: string;
  imageQuery?: string;
  dataSource: string;
  normalized: boolean;
  feedback: CardFeedback | null;
}

interface FeedDebugTrace {
  city: string;
  date: string;
  dateISO: string;
  timezone: string;
  lat: number;
  lng: number;
  totalDurationMs: number;
  providers: ProviderTrace[];
  llm: LLMTrace;
  cards: CardTrace[];
}

type Tab = "overview" | "debug";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  // Debug tab state
  const [debugCity, setDebugCity] = useState("Seattle, WA");
  const [debugDate, setDebugDate] = useState(
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  );
  const [debugTrace, setDebugTrace] = useState<FeedDebugTrace | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);

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

  function runDebugFeed() {
    if (!debugCity.trim()) return;
    setDebugLoading(true);
    setDebugError(null);
    setDebugTrace(null);
    const url = `/api/admin/debug-feed?city=${encodeURIComponent(debugCity)}&date=${encodeURIComponent(debugDate)}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || "Request failed"); });
        return r.json();
      })
      .then(setDebugTrace)
      .catch((e) => setDebugError(e.message))
      .finally(() => setDebugLoading(false));
  }

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
            {tab === "overview" && (
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
            )}
            <button
              onClick={() => signOut()}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 flex gap-1">
          {(["overview", "debug"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                tab === t
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {t === "overview" ? "Overview" : "Debug"}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <OverviewTab
          stats={stats}
          feedbackTable={feedbackTable}
          maxDailyCount={maxDailyCount}
        />
      ) : (
        <DebugTab
          debugCity={debugCity}
          setDebugCity={setDebugCity}
          debugDate={debugDate}
          setDebugDate={setDebugDate}
          debugTrace={debugTrace}
          debugLoading={debugLoading}
          debugError={debugError}
          onRun={runDebugFeed}
        />
      )}
    </main>
  );
}

// --- Overview Tab (extracted from original) ---

function OverviewTab({
  stats,
  feedbackTable,
  maxDailyCount,
}: {
  stats: Stats;
  feedbackTable: Record<string, Record<string, { good: number; irrelevant: number; inaccurate: number }>>;
  maxDailyCount: number;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 mt-6 space-y-8">
      {/* Feedback */}
      <section>
        <h2 className="font-serif text-lg font-semibold mb-3">
          Category Quality
        </h2>
        {Object.keys(feedbackTable).length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No feedback yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-4">City</th>
                  <th className="text-left py-2 pr-4">Category</th>
                  <th className="text-right py-2 pr-4 text-emerald-600">Good</th>
                  <th className="text-right py-2 pr-4 text-amber-600">Irrelevant</th>
                  <th className="text-right py-2 text-red-600">Inaccurate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(feedbackTable).map(([fbCity, categories]) =>
                  Object.entries(categories).map(([category, counts], idx) => (
                    <tr key={`${fbCity}-${category}`} className="border-b border-[var(--border)]/50">
                      <td className="py-1.5 pr-4">{idx === 0 ? fbCity : ""}</td>
                      <td className="py-1.5 pr-4">{category}</td>
                      <td className="py-1.5 pr-4 text-right">{counts.good || "-"}</td>
                      <td className="py-1.5 pr-4 text-right">{counts.irrelevant || "-"}</td>
                      <td className="py-1.5 text-right">{counts.inaccurate || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Usage */}
      <section>
        <h2 className="font-serif text-lg font-semibold mb-3">Usage (last 14 days)</h2>
        {stats.dailyFeeds.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No sessions yet.</p>
        ) : (
          <div className="space-y-1">
            {stats.dailyFeeds.map((d) => (
              <div key={d.date} className="flex items-center gap-3 text-sm">
                <span className="w-24 text-[var(--text-muted)] shrink-0">
                  {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex-1 h-5 bg-[var(--border)]/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded"
                    style={{ width: `${(d.count / maxDailyCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[var(--text-muted)]">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Engagement */}
      <section>
        <h2 className="font-serif text-lg font-semibold mb-3">Engagement</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl p-4" style={{ boxShadow: "var(--shadow)" }}>
            <p className="text-2xl font-bold">
              {Math.round((stats.engagement.avg_scroll_depth ?? 0) * 100)}%
            </p>
            <p className="text-xs text-[var(--text-muted)]">Avg scroll depth</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl p-4" style={{ boxShadow: "var(--shadow)" }}>
            <p className="text-2xl font-bold">{stats.engagement.avg_cards_viewed ?? 0}</p>
            <p className="text-xs text-[var(--text-muted)]">Avg cards viewed</p>
          </div>
        </div>
      </section>

      {/* Retention */}
      <section>
        <h2 className="font-serif text-lg font-semibold mb-3">Retention</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl p-4" style={{ boxShadow: "var(--shadow)" }}>
            <p className="text-2xl font-bold">{stats.retention.today}</p>
            <p className="text-xs text-[var(--text-muted)]">Today</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl p-4" style={{ boxShadow: "var(--shadow)" }}>
            <p className="text-2xl font-bold">{stats.retention.this_week}</p>
            <p className="text-xs text-[var(--text-muted)]">This week</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl p-4" style={{ boxShadow: "var(--shadow)" }}>
            <p className="text-2xl font-bold">{stats.retention.this_month}</p>
            <p className="text-xs text-[var(--text-muted)]">This month</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// --- Debug Tab ---

function DebugTab({
  debugCity,
  setDebugCity,
  debugDate,
  setDebugDate,
  debugTrace,
  debugLoading,
  debugError,
  onRun,
}: {
  debugCity: string;
  setDebugCity: (v: string) => void;
  debugDate: string;
  setDebugDate: (v: string) => void;
  debugTrace: FeedDebugTrace | null;
  debugLoading: boolean;
  debugError: string | null;
  onRun: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
      {/* Controls */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-[var(--text-muted)] mb-1">City</label>
          <input
            type="text"
            value={debugCity}
            onChange={(e) => setDebugCity(e.target.value)}
            className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg)]"
            placeholder="Seattle, WA"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-[var(--text-muted)] mb-1">Date</label>
          <input
            type="text"
            value={debugDate}
            onChange={(e) => setDebugDate(e.target.value)}
            className="w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg)]"
            placeholder="March 31, 2026"
          />
        </div>
        <button
          onClick={onRun}
          disabled={debugLoading}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {debugLoading ? "Running..." : "Run"}
        </button>
      </div>

      {debugError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {debugError}
        </div>
      )}

      {debugLoading && (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          Generating feed with full trace... this takes 15-30s
        </div>
      )}

      {debugTrace && <DebugTraceView trace={debugTrace} />}
    </div>
  );
}

// --- Trace View ---

function DebugTraceView({ trace }: { trace: FeedDebugTrace }) {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  function toggleProvider(name: string) {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleCard(id: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[var(--bg-card)] rounded-xl p-3 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <p className="text-lg font-bold">{trace.cards.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Cards</p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-3 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <p className="text-lg font-bold">{trace.providers.filter((p) => p.contributed).length}/{trace.providers.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Providers hit</p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-3 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <p className="text-lg font-bold">{(trace.totalDurationMs / 1000).toFixed(1)}s</p>
          <p className="text-xs text-[var(--text-muted)]">Total time</p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-3 text-center" style={{ boxShadow: "var(--shadow)" }}>
          <p className="text-lg font-bold">{trace.llm.tokensIn + trace.llm.tokensOut}</p>
          <p className="text-xs text-[var(--text-muted)]">Tokens used</p>
        </div>
      </div>

      {/* Location context */}
      <div className="text-xs text-[var(--text-muted)] flex gap-4 flex-wrap">
        <span><Globe className="inline w-3 h-3 mr-1" />{trace.city}</span>
        <span>{trace.lat.toFixed(4)}, {trace.lng.toFixed(4)}</span>
        <span>{trace.timezone}</span>
        <span>{trace.dateISO}</span>
      </div>

      {/* Providers */}
      <section>
        <h3 className="font-serif text-base font-semibold mb-3 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Data Providers
        </h3>
        <div className="space-y-2">
          {trace.providers.map((p) => (
            <div key={p.name} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                onClick={() => toggleProvider(p.name)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-card)] transition text-sm"
              >
                {expandedProviders.has(p.name) ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                )}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    p.error ? "bg-red-500" : p.contributed ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
                <span className="font-medium">{p.name}</span>
                <span className="text-[var(--text-muted)]">{p.category}</span>
                <span className="ml-auto text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {p.durationMs}ms
                </span>
              </button>

              {expandedProviders.has(p.name) && (
                <div className="border-t border-[var(--border)] px-3 py-3 space-y-3 text-xs bg-[var(--bg-card)]">
                  {/* Decision */}
                  <div>
                    <span className="font-semibold text-[var(--text-secondary)]">Decision: </span>
                    <span className={p.error ? "text-red-600" : p.contributed ? "text-emerald-700" : "text-amber-700"}>
                      {p.decision}
                    </span>
                  </div>

                  {/* Params */}
                  <div>
                    <span className="font-semibold text-[var(--text-secondary)]">Params:</span>
                    <pre className="mt-1 p-2 rounded bg-[var(--bg)] overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap">
                      {JSON.stringify(p.params, null, 2)}
                    </pre>
                  </div>

                  {/* Raw response */}
                  {p.rawResponse && (
                    <div>
                      <span className="font-semibold text-[var(--text-secondary)]">Response data:</span>
                      <pre className="mt-1 p-2 rounded bg-[var(--bg)] overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {p.rawResponse}
                      </pre>
                    </div>
                  )}

                  {p.error && (
                    <div className="text-red-600">
                      <span className="font-semibold">Error: </span>
                      {p.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* LLM Call */}
      <section>
        <h3 className="font-serif text-base font-semibold mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          LLM Generation
        </h3>
        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-3 py-2.5 text-sm flex items-center gap-4 flex-wrap">
            <span className="font-medium">{trace.llm.model}</span>
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Clock className="w-3 h-3" />{trace.llm.durationMs}ms
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {trace.llm.tokensIn} in / {trace.llm.tokensOut} out
            </span>
          </div>

          <div className="border-t border-[var(--border)] px-3 py-2 text-xs space-y-2">
            <div className="flex gap-4 flex-wrap">
              <div>
                <span className="font-semibold text-emerald-700">API-covered: </span>
                {trace.llm.apiCoveredCategories.join(", ") || "none"}
              </div>
              <div>
                <span className="font-semibold text-amber-700">LLM-only: </span>
                {trace.llm.llmOnlyCategories.join(", ") || "none"}
              </div>
            </div>

            {/* Prompt toggle */}
            <div>
              <button
                onClick={() => setShowPrompt((v) => !v)}
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                {showPrompt ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Full prompt ({trace.llm.promptText.length} chars)
              </button>
              {showPrompt && (
                <pre className="mt-1 p-2 rounded bg-[var(--bg)] overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {trace.llm.promptText}
                </pre>
              )}
            </div>

            {/* Response toggle */}
            <div>
              <button
                onClick={() => setShowResponse((v) => !v)}
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                {showResponse ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Full response ({trace.llm.responseText.length} chars)
              </button>
              {showResponse && (
                <pre className="mt-1 p-2 rounded bg-[var(--bg)] overflow-x-auto text-[10px] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {trace.llm.responseText}
                </pre>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section>
        <h3 className="font-serif text-base font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Generated Cards ({trace.cards.length})
        </h3>
        <div className="space-y-2">
          {trace.cards.map((card) => (
            <div key={card.id} className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCard(card.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-card)] transition text-sm"
              >
                {expandedCards.has(card.id) ? (
                  <ChevronDown className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
                )}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 shrink-0">
                  {card.category}
                </span>
                <span className="font-medium truncate">{card.title}</span>

                {/* Feedback badge */}
                {card.feedback && (
                  <span className="shrink-0 ml-auto">
                    {card.feedback.rating === "good" && <Check className="w-4 h-4 text-emerald-600" />}
                    {card.feedback.rating === "irrelevant" && <X className="w-4 h-4 text-amber-600" />}
                    {card.feedback.rating === "inaccurate" && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  </span>
                )}

                <span
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                    card.confidence === "high"
                      ? "bg-emerald-100 text-emerald-700"
                      : card.confidence === "medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {card.confidence}
                </span>
              </button>

              {expandedCards.has(card.id) && (
                <div className="border-t border-[var(--border)] px-3 py-3 space-y-2 text-xs bg-[var(--bg-card)]">
                  <p className="text-[var(--text-secondary)]">{card.body}</p>

                  <div className="flex gap-4 flex-wrap text-[var(--text-muted)]">
                    <span>
                      <span className="font-semibold">Source:</span> {card.dataSource}
                    </span>
                    <span>
                      <span className="font-semibold">ID:</span> {card.id}
                    </span>
                    {card.imageQuery && (
                      <span>
                        <span className="font-semibold">Image query:</span> {card.imageQuery}
                      </span>
                    )}
                    {!card.normalized && (
                      <span className="text-red-600 font-semibold">
                        Category failed normalization
                      </span>
                    )}
                  </div>

                  {card.feedback && (
                    <div
                      className={`mt-2 p-2 rounded border text-xs ${
                        card.feedback.rating === "good"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : card.feedback.rating === "irrelevant"
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-red-50 border-red-200 text-red-800"
                      }`}
                    >
                      <span className="font-semibold">User feedback:</span>{" "}
                      {card.feedback.rating}
                      {card.feedback.reason && ` — ${card.feedback.reason}`}
                      <span className="text-[10px] ml-2 opacity-70">
                        {new Date(card.feedback.createdAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
