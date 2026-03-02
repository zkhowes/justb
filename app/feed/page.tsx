"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, RefreshCw } from "lucide-react";
import { FeedItem } from "@/lib/types";
import { FeedCard } from "@/components/feed-card";
import { FeedSkeleton } from "@/components/feed-skeleton";

export default function FeedPage() {
  const router = useRouter();
  const [city, setCity] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function fetchFeed(cityName: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/feed?city=${encodeURIComponent(cityName)}`
      );
      if (!res.ok) throw new Error("Failed to fetch feed");
      const data = await res.json();
      setItems(data);
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
    <main className="min-h-screen pb-12">
      <header className="sticky top-0 z-10 bg-[var(--bg)] border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-bold">JustB</h1>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <MapPin size={12} />
              <button
                onClick={handleChangeCity}
                className="hover:text-[var(--text-secondary)] transition-colors underline underline-offset-2"
              >
                {city}
              </button>
            </div>
          </div>
          <button
            onClick={() => fetchFeed(city)}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
            title="Refresh feed"
          >
            <RefreshCw
              size={18}
              className={loading ? "animate-spin" : ""}
              style={{ color: "var(--text-muted)" }}
            />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 mt-6">
        <p className="text-sm text-[var(--text-muted)] mb-6">{today}</p>

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
