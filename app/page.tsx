"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { FeedItem, GlyphData } from "@/lib/types";
import { FeedCard } from "@/components/feed-card";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { LocationInput } from "@/components/location-input";
import { BreathingExercise } from "@/components/breathing-exercise";
import { Masthead } from "@/components/masthead";
import { useDarkMode } from "@/lib/use-dark-mode";
import { normalizeRecentTopics, recentTopicsFromItems } from "@/lib/feed-prompt";

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

type Phase = "location" | "ready" | "breathing" | "waiting" | "feed";

// v9: feed shape changed — happenings now produces 0–N full cards (one per
// event), and the new "daylight" category emits a Local pulse row.
const FEED_CACHE_VERSION = 9;

function getCacheKey(cityName: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `justb-feed-v${FEED_CACHE_VERSION}:${cityName.toLowerCase().trim()}:${dateStr}`;
}

function getRecentTopics(cityName: string): string[] {
  const topics: string[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `justb-feed-v${FEED_CACHE_VERSION}:${cityName.toLowerCase().trim()}:${d.toISOString().slice(0, 10)}`;
    try {
      const cached = localStorage.getItem(key);
      if (!cached) continue;
      const parsed = JSON.parse(cached);
      const items: FeedItem[] = Array.isArray(parsed) ? parsed : parsed.items;
      if (items) {
        topics.push(...recentTopicsFromItems(items));
      }
    } catch {
      // Skip corrupted cache entries
    }
  }
  return normalizeRecentTopics(topics, 80);
}

// Volume number = years since launch (2026) + 26; Issue = day of year.
function getIssueInfo(): { volume: number; issue: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const issue = Math.floor(diff / (1000 * 60 * 60 * 24));
  const volume = now.getFullYear() - 2000;
  return { volume, issue };
}

function buildAlmanac(glyphs: GlyphData | null, isNight: boolean): string[] {
  if (!glyphs) return [];
  const parts: string[] = [];
  if (glyphs.weather) parts.push(`${glyphs.weather.temp}°F`);
  if (isNight) {
    if (glyphs.moonPhase) parts.push(glyphs.moonPhase);
  } else {
    if (glyphs.sunset) parts.push(`sunset ${glyphs.sunset}`);
  }
  if (glyphs.tide) {
    const t = glyphs.tide;
    const next = t.state === "rising" ? t.nextHigh : t.nextLow;
    if (next) parts.push(`${t.state === "rising" ? "high" : "low"} tide ${next}`);
  }
  return parts;
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
      <span
        aria-hidden
        style={{
          width: 24,
          height: 1,
          background: "var(--accent)",
          display: "inline-block",
        }}
      />
      <span
        className="font-sans uppercase"
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          color: "var(--accent)",
        }}
      >
        {children}
      </span>
    </div>
  );
}

function SectionDivider() {
  return (
    <hr
      style={{
        border: 0,
        borderTop: "1px solid var(--rule)",
        margin: "28px 0",
      }}
    />
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("location");
  const [city, setCity] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [glyphs, setGlyphs] = useState<GlyphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const feedDataRef = useRef<{ items: FeedItem[]; glyphs: GlyphData } | null>(null);
  const feedErrorRef = useRef<string | null>(null);
  const sessionDbIdRef = useRef<number | null>(null);
  const maxCardsViewedRef = useRef(0);

  const isNight = useDarkMode();

  const now = new Date();
  const todayLong = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const todayMastheadDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const arriveDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const locateDate = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const { volume, issue } = getIssueInfo();

  // On mount, check for saved city
  useEffect(() => {
    const saved = localStorage.getItem("justb-city");
    if (saved) {
      setCity(saved);
      setPhase("ready");
    }
  }, []);

  // Session tracking + scroll observer (preview mode only)
  useEffect(() => {
    if (!isPreview || phase !== "feed" || items.length === 0 || !city) return;

    async function startSession() {
      try {
        const { trackSession } = await import("@/lib/tracking");
        const id = await trackSession(city!, items.length);
        sessionDbIdRef.current = id;
      } catch {
        // noop
      }
    }
    startSession();

    maxCardsViewedRef.current = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-card-index"));
            if (!isNaN(idx) && idx + 1 > maxCardsViewedRef.current) {
              maxCardsViewedRef.current = idx + 1;
            }
          }
        }
      },
      { threshold: 0.5 }
    );

    const cards = document.querySelectorAll("[data-card-index]");
    cards.forEach((card) => observer.observe(card));

    function handleUnload() {
      if (sessionDbIdRef.current && maxCardsViewedRef.current > 0) {
        import("@/lib/tracking").then(({ trackScrollDepth }) => {
          trackScrollDepth(
            sessionDbIdRef.current!,
            maxCardsViewedRef.current,
            items.length
          );
        });
      }
    }
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      observer.disconnect();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [phase, items.length, city]);

  // --- Feed fetching ---

  const fetchImages = useCallback(
    async (
      feedItems: FeedItem[],
      cityName: string,
      feedGlyphs: GlyphData | null
    ) => {
      const withQueries = feedItems.filter((i) => i.imageQuery);
      if (!withQueries.length) return;

      try {
        const res = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withQueries),
        });
        if (!res.ok) return;
        const imageMap: Record<string, string> = await res.json();
        if (Object.keys(imageMap).length === 0) return;

        setItems((prev) => {
          const updated = prev.map((item) =>
            imageMap[item.id] ? { ...item, imageUrl: imageMap[item.id] } : item
          );
          try {
            localStorage.setItem(
              getCacheKey(cityName),
              JSON.stringify({ items: updated, glyphs: feedGlyphs })
            );
          } catch {
            // Storage full
          }
          return updated;
        });
      } catch {
        // Images are optional
      }
    },
    []
  );

  const fetchFeedToRef = useCallback(async (cityName: string) => {
    feedDataRef.current = null;
    feedErrorRef.current = null;

    try {
      const cached = localStorage.getItem(getCacheKey(cityName));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          feedDataRef.current = {
            items: parsed,
            glyphs: null as unknown as GlyphData,
          };
        } else {
          feedDataRef.current = parsed;
        }
        return;
      }
    } catch {
      // Cache miss
    }

    try {
      const recentTopics = getRecentTopics(cityName);
      const localDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const params = new URLSearchParams({ city: cityName, date: localDate });
      if (recentTopics.length > 0) {
        recentTopics.forEach((topic) => params.append("recentTopics", topic));
      }
      const res = await fetch(`/api/feed?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data: { items: FeedItem[]; glyphs: GlyphData } = await res.json();
      try {
        localStorage.setItem(getCacheKey(cityName), JSON.stringify(data));
      } catch {
        // Storage full
      }
      feedDataRef.current = data;
    } catch {
      feedErrorRef.current =
        "Something went wrong generating your feed. Try refreshing.";
    }
  }, []);

  async function fetchFeedDirect(cityName: string) {
    setRefreshing(true);
    setError(null);

    try {
      const recentTopics = getRecentTopics(cityName);
      const localDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const params = new URLSearchParams({ city: cityName, date: localDate });
      if (recentTopics.length > 0) {
        recentTopics.forEach((topic) => params.append("recentTopics", topic));
      }
      const res = await fetch(`/api/feed?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data: { items: FeedItem[]; glyphs: GlyphData } = await res.json();
      setItems(data.items);
      setGlyphs(data.glyphs);
      try {
        localStorage.setItem(getCacheKey(cityName), JSON.stringify(data));
      } catch {
        // Storage full
      }
      fetchImages(data.items, cityName, data.glyphs);
    } catch {
      setError("Something went wrong generating your feed. Try refreshing.");
    } finally {
      setRefreshing(false);
    }
  }

  // --- Phase handlers ---

  function handleCitySelect(selectedCity: string) {
    localStorage.setItem("justb-city", selectedCity);
    setCity(selectedCity);
    setPhase("ready");
  }

  const handleBreathingStart = useCallback(() => {
    setPhase("breathing");
    if (city) fetchFeedToRef(city);
  }, [city, fetchFeedToRef]);

  const applyFeedData = useCallback(
    (feed: { items: FeedItem[]; glyphs: GlyphData }) => {
      setItems(feed.items);
      setGlyphs(feed.glyphs);
      setPhase("feed");
      if (city && feed.items.some((i) => i.imageQuery && !i.imageUrl)) {
        fetchImages(feed.items, city, feed.glyphs);
      }
    },
    [city, fetchImages]
  );

  const handleBreathingComplete = useCallback(() => {
    if (feedDataRef.current) {
      applyFeedData(feedDataRef.current);
    } else if (feedErrorRef.current) {
      setError(feedErrorRef.current);
      setPhase("feed");
    } else {
      setPhase("waiting");
      const interval = setInterval(() => {
        if (feedDataRef.current) {
          clearInterval(interval);
          applyFeedData(feedDataRef.current);
        } else if (feedErrorRef.current) {
          clearInterval(interval);
          setError(feedErrorRef.current);
          setPhase("feed");
        }
      }, 500);
    }
  }, [applyFeedData]);

  function handleChangeCity() {
    localStorage.removeItem("justb-city");
    setCity(null);
    setItems([]);
    setGlyphs(null);
    setError(null);
    feedDataRef.current = null;
    feedErrorRef.current = null;
    setPhase("location");
  }

  // --- Render ---

  // Location selection
  if (phase === "location") {
    return (
      <main
        className="min-h-screen flex flex-col"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="text-center font-sans uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.28em",
            color: "var(--text-muted)",
            paddingTop: 28,
          }}
        >
          Vol. {volume}
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "var(--text-muted)",
              margin: "0 8px",
              verticalAlign: "middle",
            }}
          />
          {locateDate}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-7">
          <h1
            className="font-display"
            style={{
              fontSize: 96,
              fontWeight: 400,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              textAlign: "center",
            }}
          >
            JustB
          </h1>
          <p
            className="font-serif italic text-center"
            style={{
              fontSize: 19,
              fontWeight: 300,
              color: "var(--text-secondary)",
              maxWidth: 280,
              lineHeight: 1.45,
              marginTop: 18,
            }}
          >
            just be here.
            <br />
            just be now.
          </p>
          <div
            className="flex items-center gap-[10px]"
            style={{ marginTop: 28 }}
          >
            <span
              aria-hidden
              style={{
                width: 24,
                height: 1,
                background: "var(--rule-strong)",
                display: "inline-block",
              }}
            />
            <span
              aria-hidden
              style={{
                width: 4,
                height: 4,
                background: "var(--accent)",
                transform: "rotate(45deg)",
                display: "inline-block",
              }}
            />
            <span
              aria-hidden
              style={{
                width: 24,
                height: 1,
                background: "var(--rule-strong)",
                display: "inline-block",
              }}
            />
          </div>
        </div>

        <div style={{ padding: "0 28px 40px" }}>
          <LocationInput onSelect={handleCitySelect} />
        </div>
      </main>
    );
  }

  // Breathing exercise (Arrive + Breathe)
  if (phase === "ready" || phase === "breathing") {
    return (
      <main
        className="min-h-screen relative"
        style={{ background: "var(--bg)" }}
      >
        <BreathingExercise
          onStart={handleBreathingStart}
          onComplete={handleBreathingComplete}
          city={city?.split(",")[0]}
          dateLabel={arriveDate}
          almanac={buildAlmanac(glyphs, isNight)}
          isNight={isNight}
        />
      </main>
    );
  }

  // Waiting for feed after breathing
  if (phase === "waiting") {
    return (
      <main
        className="min-h-screen relative"
        style={{ background: "var(--bg)" }}
      >
        <div className="min-h-screen flex items-center justify-center">
          <motion.p
            className="font-serif italic"
            style={{
              fontSize: 18,
              fontWeight: 300,
              color: "var(--text-secondary)",
            }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Preparing your moments…
          </motion.p>
        </div>
      </main>
    );
  }

  // Feed
  // Happenings are their own dedicated section now — slice them out first so
  // they don't compete for the lead/quote/pulse/field-note slots.
  const happeningsItems = items.filter((item) => item.category === "happenings");
  const happeningIds = new Set(happeningsItems.map((item) => item.id));

  const leadItem =
    items.find((item) => item.imageUrl && !happeningIds.has(item.id)) ??
    items.find((item) => !happeningIds.has(item.id));
  const leadId = leadItem?.id;
  const pulseItems = items
    .filter(
      (item) =>
        item.id !== leadId &&
        !happeningIds.has(item.id) &&
        ["daylight", "water", "air", "civic", "community"].includes(
          item.category
        )
    )
    .slice(0, 4);
  const pulseIds = new Set(pulseItems.map((item) => item.id));
  const quoteItem = items.find(
    (item) =>
      item.id !== leadId &&
      !happeningIds.has(item.id) &&
      !pulseIds.has(item.id) &&
      (item.category === "history" || item.category === "culture")
  );
  const quoteId = quoteItem?.id;
  const remainingItems = items.filter(
    (item) =>
      item.id !== leadId &&
      !happeningIds.has(item.id) &&
      !pulseIds.has(item.id) &&
      item.id !== quoteId
  );

  return (
    <main
      className="min-h-screen relative"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-lg mx-auto">
        {city && (
          <Masthead
            city={`${city}`}
            dateLabel={`${todayMastheadDate} · ${now.getFullYear()}`}
            volume={volume}
            issue={issue}
            glyphs={glyphs}
            onChangeCity={handleChangeCity}
          />
        )}

        <div style={{ padding: "0 22px 80px" }}>
          {city && (
            <section style={{ marginTop: 8, marginBottom: 16 }}>
              <SectionEyebrow>Today in {city.split(",")[0]}</SectionEyebrow>
              <p
                className="font-serif italic"
                style={{
                  fontSize: 15,
                  fontWeight: 300,
                  color: "var(--text-secondary)",
                  lineHeight: 1.45,
                }}
              >
                {todayLong} — a few grounded signals, a few reasons to look
                around, and the local texture worth noticing.
              </p>
            </section>
          )}

          {error && (
            <p
              className="font-serif italic text-center"
              style={{
                padding: "32px 0",
                fontSize: 14,
                color: "var(--text-secondary)",
              }}
            >
              {error}
            </p>
          )}

          {refreshing ? (
            <FeedSkeleton />
          ) : (
            <>
              {leadItem && (
                <div data-card-index={0}>
                  <FeedCard
                    item={leadItem}
                    index={0}
                    city={city || undefined}
                    layoutHint="hero"
                  />
                </div>
              )}

              {leadItem && <SectionDivider />}

              {quoteItem && (
                <div data-card-index={1}>
                  <FeedCard
                    item={quoteItem}
                    index={1}
                    city={city || undefined}
                    layoutHint="quote"
                  />
                </div>
              )}

              {happeningsItems.length > 0 && (
                <section style={{ marginTop: 32 }}>
                  <div
                    className="flex items-end justify-between"
                    style={{ marginBottom: 16 }}
                  >
                    <h3
                      className="font-display"
                      style={{
                        fontSize: 18,
                        letterSpacing: "-0.005em",
                        color: "var(--text-primary)",
                      }}
                    >
                      Happenings
                    </h3>
                    <span
                      className="font-sans uppercase"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.22em",
                        color: "var(--text-muted)",
                      }}
                    >
                      this week
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {happeningsItems.map((item, i) => (
                      <div
                        key={item.id}
                        data-card-index={i + 2}
                        style={{
                          paddingBottom: i < happeningsItems.length - 1 ? 24 : 0,
                          borderBottom:
                            i < happeningsItems.length - 1
                              ? "1px solid var(--rule)"
                              : "none",
                        }}
                      >
                        <FeedCard
                          item={item}
                          index={i + 2}
                          city={city || undefined}
                          layoutHint="happening"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {pulseItems.length > 0 && (
                <section style={{ marginTop: 32 }}>
                  <div
                    className="flex items-end justify-between"
                    style={{ marginBottom: 8 }}
                  >
                    <h3
                      className="font-display"
                      style={{
                        fontSize: 18,
                        letterSpacing: "-0.005em",
                        color: "var(--text-primary)",
                      }}
                    >
                      Local pulse
                    </h3>
                    <span
                      className="font-sans uppercase"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.22em",
                        color: "var(--text-muted)",
                      }}
                    >
                      live signals
                    </span>
                  </div>
                  <div>
                    {pulseItems.map((item, i) => (
                      <div
                        key={item.id}
                        data-card-index={i + 2 + happeningsItems.length}
                        style={{
                          borderTop: i === 0 ? "1px solid var(--rule)" : "none",
                          borderBottom: "1px solid var(--rule)",
                        }}
                      >
                        <FeedCard
                          item={item}
                          index={i + 2 + happeningsItems.length}
                          city={city || undefined}
                          layoutHint="pulse"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {remainingItems.length > 0 && (
                <section style={{ marginTop: 32 }}>
                  <div
                    className="flex items-end justify-between"
                    style={{ marginBottom: 16 }}
                  >
                    <h3
                      className="font-display"
                      style={{
                        fontSize: 18,
                        letterSpacing: "-0.005em",
                        color: "var(--text-primary)",
                      }}
                    >
                      Field notes
                    </h3>
                    <span
                      className="font-sans uppercase"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.22em",
                        color: "var(--text-muted)",
                      }}
                    >
                      almanac
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                    {remainingItems.map((item, i) => (
                      <div
                        key={item.id}
                        data-card-index={
                          i + 2 + happeningsItems.length + pulseItems.length
                        }
                      >
                        <FeedCard
                          item={item}
                          index={
                            i + 2 + happeningsItems.length + pulseItems.length
                          }
                          city={city || undefined}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Footer mark */}
              <div
                className="text-center"
                style={{
                  marginTop: 56,
                  paddingTop: 22,
                  borderTop: "1px solid var(--rule)",
                }}
              >
                <p
                  className="font-display"
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    opacity: 0.85,
                  }}
                >
                  · JustB ·
                </p>
                <p
                  className="font-sans uppercase"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.28em",
                    color: "var(--text-muted)",
                    opacity: 0.7,
                    marginTop: 6,
                  }}
                >
                  just be here. just be now.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Floating refresh button — replaces the sticky header refresh */}
        {city && phase === "feed" && (
          <button
            onClick={() => city && fetchFeedDirect(city)}
            disabled={refreshing}
            className="fixed flex items-center justify-center"
            style={{
              right: 20,
              bottom: 24,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--bg-card)",
              border: "1px solid var(--rule)",
              boxShadow: "0 4px 14px rgba(28,26,22,0.08)",
              opacity: refreshing ? 0.5 : 1,
              zIndex: 20,
            }}
            title="Refresh feed"
            aria-label="Refresh feed"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
              style={{ color: "var(--text-secondary)" }}
            />
          </button>
        )}
      </div>
    </main>
  );
}
