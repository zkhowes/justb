"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";

const CITIES = [
  "Seattle, WA",
  "Portland, OR",
  "San Francisco, CA",
  "Los Angeles, CA",
  "San Diego, CA",
  "Denver, CO",
  "Austin, TX",
  "Chicago, IL",
  "New York, NY",
  "Boston, MA",
  "Nashville, TN",
  "Miami, FL",
  "Atlanta, GA",
  "Washington, DC",
  "Philadelphia, PA",
  "Minneapolis, MN",
  "Detroit, MI",
  "New Orleans, LA",
  "Salt Lake City, UT",
  "Phoenix, AZ",
  "Las Vegas, NV",
  "Honolulu, HI",
  "Anchorage, AK",
  "Savannah, GA",
  "Charleston, SC",
];

export function LocationInput({
  onSelect,
}: {
  onSelect: (city: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.length > 0
    ? CITIES.filter((c) =>
        c.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(city: string) {
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
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered.length > 0) {
              handleSubmit(filtered[0]);
            }
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Enter your city..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--text-muted)] focus:ring-opacity-30 transition-shadow"
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <ul className="absolute top-full mt-2 w-full bg-white rounded-xl border border-[var(--border)] overflow-hidden z-10" style={{ boxShadow: "var(--shadow-hover)" }}>
          {filtered.map((city) => (
            <li key={city}>
              <button
                onClick={() => handleSubmit(city)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg)] transition-colors"
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
