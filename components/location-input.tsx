"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, ArrowRight, Loader2 } from "lucide-react";

type Suggestion = { display: string; city: string };

export function LocationInput({
  onSelect,
}: {
  onSelect: (city: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchPlaces = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1&countrycodes=us`,
        { headers: { "User-Agent": "JustB/1.0 (zkhowes.fun)" } }
      );
      if (!res.ok) return;
      const data = await res.json();

      const seen = new Set<string>();
      const results: Suggestion[] = [];
      for (const item of data) {
        const addr = item.address;
        const city =
          addr?.city || addr?.town || addr?.village || addr?.hamlet || "";
        const state = addr?.state || "";
        if (!city || seen.has(city + state)) continue;
        seen.add(city + state);
        results.push({
          display: state ? `${city}, ${state}` : city,
          city: state ? `${city}, ${state}` : city,
        });
      }
      setSuggestions(results);
    } catch {
      // fail silently — user can still submit freeform
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(value), 300);
  }

  function handleSubmit(city: string) {
    setShowSuggestions(false);
    onSelect(city);
  }

  return (
    <div className="relative w-full max-w-sm">
      <div className="relative">
        <MapPin
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          size={18}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (suggestions.length > 0) {
                handleSubmit(suggestions[0].city);
              } else if (query.trim()) {
                handleSubmit(query.trim());
              }
            }
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Enter your city..."
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-[var(--border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-opacity-30 transition-shadow"
        />
        {loading ? (
          <Loader2
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] animate-spin"
          />
        ) : (
          query.trim() && (
            <button
              onClick={() => {
                if (suggestions.length > 0) {
                  handleSubmit(suggestions[0].city);
                } else {
                  handleSubmit(query.trim());
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowRight size={16} />
            </button>
          )
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul
          className="absolute top-full mt-2 w-full bg-white rounded-xl border border-[var(--border)] overflow-hidden z-10"
          style={{ boxShadow: "var(--shadow-hover)" }}
        >
          {suggestions.map((s) => (
            <li key={s.city}>
              <button
                onClick={() => handleSubmit(s.city)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg)] transition-colors"
              >
                {s.display}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
