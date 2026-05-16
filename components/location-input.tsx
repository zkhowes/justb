"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Suggestion = { display: string; city: string; region: string };

function PinIcon() {
  return (
    <svg
      width="14"
      height="18"
      viewBox="0 0 14 18"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17s6-5.5 6-10A6 6 0 1 0 1 7c0 4.5 6 10 6 10Z" />
      <circle cx="7" cy="7" r="2" fill="var(--accent)" stroke="var(--accent)" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="16"
      height="12"
      viewBox="0 0 16 12"
      fill="none"
      stroke="var(--text-primary)"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.6 }}
      aria-hidden
    >
      <path d="M1 6h13.5" />
      <path d="M10 1.5 14.5 6 10 10.5" />
    </svg>
  );
}

export function LocationInput({
  onSelect,
}: {
  onSelect: (city: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
          display: city,
          region: state,
          city: state ? `${city}, ${state}` : city,
        });
      }
      setSuggestions(results);
    } catch {
      // fail silently — user can still submit freeform
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

  function handleArrow() {
    if (suggestions.length > 0) handleSubmit(suggestions[0].city);
    else if (query.trim()) handleSubmit(query.trim());
  }

  return (
    <div className="w-full max-w-[340px] mx-auto">
      <p
        className="text-center font-sans uppercase mb-[10px]"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          color: "var(--text-muted)",
        }}
      >
        where are you, today
      </p>

      <div
        className="flex items-center gap-3 pb-3"
        style={{ borderBottom: "1px solid var(--rule-strong)" }}
      >
        <PinIcon />
        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleArrow();
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder=""
            className="w-full bg-transparent font-serif outline-none border-none"
            style={{
              fontSize: 20,
              color: "var(--text-primary)",
              caretColor: "var(--accent)",
            }}
          />
          {query.length === 0 && (
            <span
              className="caret pointer-events-none absolute left-0"
              aria-hidden
            />
          )}
        </div>
        <button
          onClick={handleArrow}
          className="p-1"
          aria-label="Submit"
          disabled={!query.trim() && suggestions.length === 0}
        >
          <ArrowRightIcon />
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="mt-1 list-none p-0">
          {suggestions.map((s, i) => (
            <li
              key={s.city}
              className="grid items-baseline"
              style={{
                gridTemplateColumns: "28px 1fr auto",
                gap: 12,
                padding: "10px 0",
                borderBottom:
                  i === suggestions.length - 1
                    ? "none"
                    : "1px solid var(--rule-strong)",
              }}
            >
              <span
                className="font-sans uppercase"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  color: "var(--text-muted)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <button
                onClick={() => handleSubmit(s.city)}
                className="text-left font-serif"
                style={{
                  fontSize: 17,
                  color: "var(--text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {s.display}
              </button>
              <span
                className="font-sans"
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                }}
              >
                {s.region}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
