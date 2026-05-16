"use client";

import { GlyphData } from "@/lib/types";
import { Glyphs } from "./glyphs";

function PinIcon() {
  return (
    <svg
      width="9"
      height="11"
      viewBox="0 0 9 11"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }}
    >
      <path d="M4.5 10.5s4-3.5 4-6.5a4 4 0 1 0-8 0c0 3 4 6.5 4 6.5Z" />
      <circle cx="4.5" cy="4" r="1.1" fill="var(--accent)" stroke="var(--accent)" />
    </svg>
  );
}

export function Masthead({
  city,
  dateLabel,
  volume,
  issue,
  glyphs,
  onChangeCity,
}: {
  city: string;
  dateLabel: string;
  volume: number;
  issue: number;
  glyphs: GlyphData | null;
  onChangeCity: () => void;
}) {
  return (
    <header
      style={{
        padding: "52px 22px 28px",
      }}
    >
      {/* Row 1 — wordmark + volume/issue */}
      <div className="flex items-baseline justify-between">
        <span
          className="font-display"
          style={{
            fontSize: 28,
            lineHeight: 1,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          JustB
        </span>
        <span
          className="font-sans uppercase"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.22em",
            color: "var(--text-secondary)",
          }}
        >
          Vol. {volume} · No. {issue}
        </span>
      </div>

      {/* Row 2 — city + date */}
      <div
        className="font-sans"
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          marginTop: 8,
        }}
      >
        <PinIcon />
        <button
          onClick={onChangeCity}
          style={{
            color: "var(--text-secondary)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            textDecorationColor: "var(--text-muted)",
          }}
        >
          {city}
        </button>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: "var(--text-muted)",
            margin: "0 8px",
            verticalAlign: "middle",
          }}
        />
        <span>{dateLabel}</span>
      </div>

      {/* Row 3 — almanac strip */}
      {glyphs && (
        <div style={{ marginTop: 14 }}>
          <Glyphs data={glyphs} />
        </div>
      )}
    </header>
  );
}
