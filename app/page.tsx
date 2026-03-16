"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { FeedItem } from "@/lib/types";
import { FeedCard } from "@/components/feed-card";
import { FeedSkeleton } from "@/components/feed-skeleton";
import { LocationInput } from "@/components/location-input";
import { BreathingExercise } from "@/components/breathing-exercise";

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

export default function Home() {
  const [phase, setPhase] = useState<Phase>("location");
  const [city, setCity] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const feedDataRef = useRef<FeedItem[] | null>(null);
  const feedErrorRef = useRef<string | null>(null);

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
        feedDataRef.current = JSON.parse(cached);
        return;
      }
    } catch {
      // Cache miss
    }

    try {
      const res = await fetch(`/api/feed?city=${encodeURIComponent(cityName)}`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data: FeedItem[] = await res.json();
      // Cache it
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
      const res = await fetch(`/api/feed?city=${encodeURIComponent(cityName)}`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data: FeedItem[] = await res.json();
      setItems(data);
      try {
        localStorage.setItem(getCacheKey(cityName), JSON.stringify(data));
      } catch {
        // Storage full
      }
      fetchImages(data, cityName);
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

  const handleBreathingComplete = useCallback(() => {
    if (feedDataRef.current) {
      const data = feedDataRef.current;
      setItems(data);
      setPhase("feed");
      if (city && data.some((i) => i.imageQuery && !i.imageUrl)) {
        fetchImages(data, city);
      }
    } else if (feedErrorRef.current) {
      setError(feedErrorRef.current);
      setPhase("feed");
    } else {
      // Feed still loading — poll
      setPhase("waiting");
      const interval = setInterval(() => {
        if (feedDataRef.current) {
          clearInterval(interval);
          const data = feedDataRef.current;
          setItems(data);
          setPhase("feed");
          if (city && data.some((i) => i.imageQuery && !i.imageUrl)) {
            fetchImages(data, city);
          }
        } else if (feedErrorRef.current) {
          clearInterval(interval);
          setError(feedErrorRef.current);
          setPhase("feed");
        }
      }, 500);
    }
  }, [city, fetchImages]);

  function handleChangeCity() {
    localStorage.removeItem("justb-city");
    setCity(null);
    setItems([]);
    setError(null);
    feedDataRef.current = null;
    feedErrorRef.current = null;
    setPhase("location");
  }

  // --- Render ---

  // Location selection
  if (phase === "location") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6">
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

  // Breathing exercise
  if (phase === "ready" || phase === "breathing") {
    return (
      <main className="min-h-screen relative">
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
      <div
        className={`absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b ${gradient} pointer-events-none`}
      />

      <header
        className={`sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 ${
          isNight
            ? "bg-indigo-950/95 backdrop-blur-sm"
            : "bg-[var(--bg)]/95 backdrop-blur-sm"
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
          <FeedSkeleton />
        ) : (
          <div className="space-y-6">
            {items.map((item, i) => (
              <FeedCard key={item.id} item={item} index={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
