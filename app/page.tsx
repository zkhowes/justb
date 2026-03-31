"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { FeedItem, GlyphData } from "@/lib/types";
import { FeedCard } from "@/components/feed-card";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { LocationInput } from "@/components/location-input";
import { BreathingExercise } from "@/components/breathing-exercise";
import { Glyphs } from "@/components/glyphs";
import { getSeasonForMonth } from "@/lib/background";

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

type Phase = "location" | "ready" | "breathing" | "waiting" | "feed";

function getTimeOfDayGradient(): { gradient: string; isNight: boolean } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 7) {
    return { gradient: "from-amber-200 via-orange-100 to-transparent", isNight: false };
  } else if (hour >= 7 && hour < 12) {
    return { gradient: "from-sky-200 via-blue-100 to-transparent", isNight: false };
  } else if (hour >= 12 && hour < 17) {
    return { gradient: "from-sky-300 via-sky-100 to-transparent", isNight: false };
  } else if (hour >= 17 && hour < 19) {
    return { gradient: "from-amber-300 via-orange-100 to-transparent", isNight: false };
  } else if (hour >= 19 && hour < 21) {
    return { gradient: "from-purple-300 via-lavender-100 via-violet-100 to-transparent", isNight: false };
  } else {
    return { gradient: "from-indigo-900 via-indigo-800/50 to-transparent", isNight: true };
  }
}

function getCacheKey(cityName: string) {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `justb-feed:${cityName.toLowerCase().trim()}:${dateStr}`;
}

function getRecentTopics(cityName: string): string[] {
  const topics: string[] = [];
  const today = new Date();
  for (let i = 1; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `justb-feed:${cityName.toLowerCase().trim()}:${d.toISOString().slice(0, 10)}`;
    try {
      const cached = localStorage.getItem(key);
      if (!cached) continue;
      const parsed = JSON.parse(cached);
      const items: FeedItem[] = Array.isArray(parsed) ? parsed : parsed.items;
      if (items) {
        for (const item of items) {
          if (item.title) topics.push(item.title);
        }
      }
    } catch {
      // Skip corrupted cache entries
    }
  }
  return topics;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("location");
  const [city, setCity] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [glyphs, setGlyphs] = useState<GlyphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  const feedDataRef = useRef<{ items: FeedItem[]; glyphs: GlyphData } | null>(null);
  const feedErrorRef = useRef<string | null>(null);
  const sessionDbIdRef = useRef<number | null>(null);
  const maxCardsViewedRef = useRef(0);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { gradient, isNight } = useMemo(() => getTimeOfDayGradient(), []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // On mount, check for saved city
  useEffect(() => {
    const saved = localStorage.getItem("justb-city");
    if (saved) {
      setCity(saved);
      setPhase("ready");
    }
  }, []);

  // Fetch nature background image based on city + season
  useEffect(() => {
    if (!city) return;
    const month = new Date().getMonth() + 1;
    const season = getSeasonForMonth(month);
    const cacheKey = `justb-bg:${city.toLowerCase().trim()}:${season}:${isNight}`;

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setBgUrl(cached);
      return;
    }

    const params = new URLSearchParams({
      city,
      month: String(month),
      night: String(isNight),
    });

    fetch(`/api/background?${params}`)
      .then((res) => res.json())
      .then((data: { url: string | null }) => {
        if (data.url) {
          const img = new Image();
          img.onload = () => {
            setBgUrl(data.url);
            try { localStorage.setItem(cacheKey, data.url!); } catch {}
          };
          img.src = data.url;
        }
      })
      .catch(() => {});
  }, [city, isNight]);

  // Session tracking + scroll observer (preview mode only)
  useEffect(() => {
    if (!isPreview || phase !== "feed" || items.length === 0 || !city) return;

    // Track session
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

    // IntersectionObserver for scroll depth
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

    // Observe all card elements
    const cards = document.querySelectorAll("[data-card-index]");
    cards.forEach((card) => observer.observe(card));

    // Send scroll depth on unload
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

  const fetchImages = useCallback(async (feedItems: FeedItem[], cityName: string) => {
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
          localStorage.setItem(getCacheKey(cityName), JSON.stringify(updated));
        } catch {
          // Storage full
        }
        return updated;
      });
    } catch {
      // Images are optional
    }
  }, []);

  // Fetch feed into refs (used during breathing — no state updates until breathing completes)
  const fetchFeedToRef = useCallback(async (cityName: string) => {
    feedDataRef.current = null;
    feedErrorRef.current = null;

    // Check localStorage cache
    try {
      const cached = localStorage.getItem(getCacheKey(cityName));
      if (cached) {
        const parsed = JSON.parse(cached);
        // Support new { items, glyphs } shape and legacy array shape
        if (Array.isArray(parsed)) {
          feedDataRef.current = { items: parsed, glyphs: null as unknown as GlyphData };
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
      const localDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const params = new URLSearchParams({ city: cityName, date: localDate });
      if (recentTopics.length > 0) {
        params.set("recentTopics", recentTopics.join(","));
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
      feedErrorRef.current = "Something went wrong generating your feed. Try refreshing.";
    }
  }, []);

  // Direct fetch for refresh (updates state immediately, no breathing)
  async function fetchFeedDirect(cityName: string) {
    setRefreshing(true);
    setError(null);

    try {
      const recentTopics = getRecentTopics(cityName);
      const localDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const params = new URLSearchParams({ city: cityName, date: localDate });
      if (recentTopics.length > 0) {
        params.set("recentTopics", recentTopics.join(","));
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
      fetchImages(data.items, cityName);
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
        fetchImages(feed.items, city);
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
      // Feed still loading — poll
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

  const backgroundLayers = (
    <>
      {bgUrl && (
        <div
          className="fixed inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage: `url(${bgUrl})`,
            filter: "brightness(0.9)",
          }}
        />
      )}
      <div
        className={`fixed inset-0 -z-10 ${
          isNight ? "bg-indigo-950/40" : "bg-white/30"
        }`}
      />
    </>
  );

  // Location selection
  if (phase === "location") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        {backgroundLayers}
        <div className="text-center mb-10">
          <h1 className="font-serif text-5xl font-bold tracking-tight mb-3">
            JustB
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            just be here. just be now.
          </p>
        </div>
        <LocationInput onSelect={handleCitySelect} />
      </main>
    );
  }

  // Breathing exercise — clean, minimal screen (no background image)
  if (phase === "ready" || phase === "breathing") {
    return (
      <main className={`min-h-screen relative ${isNight ? "bg-indigo-950" : "bg-[var(--bg)]"}`}>
        <div
          className={`absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b ${gradient} pointer-events-none`}
        />
        <BreathingExercise
          onStart={handleBreathingStart}
          onComplete={handleBreathingComplete}
          isNight={isNight}
        />
      </main>
    );
  }

  // Waiting for feed after breathing
  if (phase === "waiting") {
    return (
      <main className="min-h-screen relative">
        {backgroundLayers}
        <div
          className={`absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b ${gradient} pointer-events-none`}
        />
        <div className="min-h-screen flex items-center justify-center">
          <motion.p
            className={`font-serif text-xl ${isNight ? "text-indigo-200" : "text-[var(--text-secondary)]"}`}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Preparing your moments...
          </motion.p>
        </div>
      </main>
    );
  }

  // Feed
  return (
    <main className="min-h-screen pb-12 relative">
      {backgroundLayers}
      <div
        className={`absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b ${gradient} pointer-events-none`}
      />

      <header
        className={`sticky top-0 z-10 border-b px-4 py-4 backdrop-blur-xl ${
          isNight
            ? "bg-indigo-950/60 border-white/10"
            : "bg-white/60 border-white/20"
        }`}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1
              className={`font-serif text-xl font-bold ${
                isNight ? "text-white" : ""
              }`}
            >
              JustB
            </h1>
            <div
              className={`flex items-center gap-1.5 text-xs ${
                isNight ? "text-indigo-300" : "text-[var(--text-muted)]"
              }`}
            >
              <MapPin size={12} />
              <button
                onClick={handleChangeCity}
                className={`transition-colors underline underline-offset-2 ${
                  isNight
                    ? "hover:text-indigo-200"
                    : "hover:text-[var(--text-secondary)]"
                }`}
              >
                {city}
              </button>
            </div>
          </div>
          <button
            onClick={() => city && fetchFeedDirect(city)}
            disabled={refreshing}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              isNight ? "hover:bg-indigo-900" : "hover:bg-white"
            }`}
            title="Refresh feed"
          >
            <RefreshCw
              size={18}
              className={refreshing ? "animate-spin" : ""}
              style={{
                color: isNight ? "#a5b4fc" : "var(--text-muted)",
              }}
            />
          </button>
        </div>
      </header>

      {glyphs && (
        <div
          className={`sticky top-[61px] z-10 border-b backdrop-blur-xl ${
            isNight
              ? "bg-indigo-950/60 border-white/10"
              : "bg-white/60 border-white/20"
          }`}
        >
          <div className="max-w-lg mx-auto">
            <Glyphs data={glyphs} isNight={isNight} />
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 mt-6 relative">
        <p
          className={`text-sm mb-6 ${
            isNight ? "text-indigo-300" : "text-[var(--text-muted)]"
          }`}
        >
          {today}
        </p>

        {error && (
          <div className="text-center py-12 text-sm text-[var(--text-secondary)]">
            {error}
          </div>
        )}

        {refreshing ? (
          <FeedSkeleton isNight={isNight} />
        ) : (
          <div className="space-y-6">
            {items.map((item, i) => (
              <div key={item.id} data-card-index={i}>
                <FeedCard item={item} index={i} city={city || undefined} isNight={isNight} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
