"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPin, RefreshCw } from "lucide-react";
import { FeedItem } from "@/lib/types";
import { FeedCard } from "@/components/feed-card";
import { FeedSkeleton } from "@/components/feed-skeleton";

function getTimeOfDayGradient(): { gradient: string; isNight: boolean } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 7) {
    // Dawn
    return { gradient: "from-amber-200 via-orange-100 to-transparent", isNight: false };
  } else if (hour >= 7 && hour < 12) {
    // Morning
    return { gradient: "from-sky-200 via-blue-100 to-transparent", isNight: false };
  } else if (hour >= 12 && hour < 17) {
    // Afternoon
    return { gradient: "from-sky-300 via-sky-100 to-transparent", isNight: false };
  } else if (hour >= 17 && hour < 19) {
    // Golden hour
    return { gradient: "from-amber-300 via-orange-100 to-transparent", isNight: false };
  } else if (hour >= 19 && hour < 21) {
    // Dusk
    return { gradient: "from-purple-300 via-lavender-100 via-violet-100 to-transparent", isNight: false };
  } else {
    // Night
    return { gradient: "from-indigo-900 via-indigo-800/50 to-transparent", isNight: true };
  }
}

export default function FeedPage() {
  const router = useRouter();
  const [city, setCity] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { gradient, isNight } = useMemo(() => getTimeOfDayGradient(), []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    const saved = localStorage.getItem("justb-city");
    if (!saved) {
      router.replace("/");
      return;
    }
    setCity(saved);
    fetchFeed(saved);
  }, [router]);

  async function fetchImages(feedItems: FeedItem[]) {
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
        // Persist images to cache
        if (city) {
          try {
            localStorage.setItem(getCacheKey(city), JSON.stringify(updated));
          } catch {
            // Storage full — ignore
          }
        }
        return updated;
      });
    } catch {
      // Images are optional — fail silently
    }
  }

  function getCacheKey(cityName: string) {
    const dateStr = new Date().toISOString().slice(0, 10);
    return `justb-feed:${cityName.toLowerCase().trim()}:${dateStr}`;
  }

  async function fetchFeed(cityName: string, forceRefresh = false) {
    setLoading(true);
    setError(null);

    // Check localStorage cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(getCacheKey(cityName));
        if (cached) {
          const data: FeedItem[] = JSON.parse(cached);
          setItems(data);
          setLoading(false);
          // Still fetch images if missing
          if (data.some((i) => i.imageQuery && !i.imageUrl)) {
            fetchImages(data);
          }
          return;
        }
      } catch {
        // Cache miss or parse error — continue to fetch
      }
    }

    try {
      const res = await fetch(
        `/api/feed?city=${encodeURIComponent(cityName)}`
      );
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data: FeedItem[] = await res.json();
      setItems(data);
      // Cache the feed in localStorage
      try {
        localStorage.setItem(getCacheKey(cityName), JSON.stringify(data));
      } catch {
        // Storage full — ignore
      }
      // Fire-and-forget: fetch images after cards are rendered
      fetchImages(data);
    } catch {
      setError("Something went wrong generating your feed. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  function handleChangeCity() {
    localStorage.removeItem("justb-city");
    router.push("/");
  }

  if (!city) return null;

  return (
    <main className="min-h-screen pb-12 relative">
      {/* Time-of-day ambient gradient */}
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
            onClick={() => fetchFeed(city, true)}
            disabled={loading}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              isNight ? "hover:bg-indigo-900" : "hover:bg-white"
            }`}
            title="Refresh feed"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
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

        {loading ? (
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
