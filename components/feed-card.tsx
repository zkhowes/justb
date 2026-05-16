"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, X, AlertTriangle } from "lucide-react";
import { FeedItem } from "@/lib/types";
import { CatMark, categoryConfig } from "./category-pill";

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

type Rating = "good" | "irrelevant" | "inaccurate";
type Variant = "hero" | "quote" | "stat" | "pulse" | "field" | "standard";

const INACCURACY_REASONS = [
  "Wrong time/date",
  "Wrong facts",
  "Not my city",
  "Other",
] as const;

function pickVariant(item: FeedItem, index: number, layoutHint?: Variant): Variant {
  if (layoutHint) return layoutHint;
  if (index === 0 && item.imageUrl) return "hero";
  if (item.category === "history" || item.category === "culture") return "quote";
  if (
    item.category === "sky" ||
    item.category === "space" ||
    item.category === "sports"
  )
    return "stat";
  if (
    item.category === "happenings" ||
    item.category === "water" ||
    item.category === "air" ||
    item.category === "civic" ||
    item.category === "community"
  )
    return "pulse";
  return item.imageUrl ? "standard" : "field";
}

// ──────────────────────────────────────────────────────────────────────
// Fact strip — replaces the old colored chip row.
// Renders as inline meta: "7:56–8:40 PM | 45 min window | longest-day"
// Numbers in primary, labels in secondary, pipes in rule color.

function FactStrip({ facts }: { facts: string[] }) {
  if (!facts || facts.length === 0) return null;
  return (
    <div
      className="font-sans"
      style={{
        fontSize: 10.5,
        letterSpacing: "0.06em",
        color: "var(--text-secondary)",
        marginTop: 6,
      }}
    >
      {facts.map((f, i) => (
        <span key={i}>
          {i > 0 && (
            <span
              aria-hidden
              style={{ color: "var(--rule-strong)", margin: "0 8px" }}
            >
              |
            </span>
          )}
          <span style={{ color: "var(--text-primary)" }}>{f}</span>
        </span>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Feedback row (preview-only). Magazine treatment: tiny icon buttons with
// accent-colored underline on the active selection — no colored hover bg.

function FeedbackRow({ item, city }: { item: FeedItem; city: string }) {
  const [selected, setSelected] = useState<Rating | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [reasonPicked, setReasonPicked] = useState(false);

  async function sendFeedback(rating: Rating, reason?: string) {
    try {
      await fetch("/api/preview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          category: item.category,
          itemId: item.id,
          title: item.title,
          body: item.body,
          rating,
          reason,
        }),
      });
    } catch {
      // Best effort
    }
  }

  function handleRate(rating: Rating) {
    if (selected) return;
    if (rating === "inaccurate") {
      setSelected(rating);
      setShowReasons(true);
      return;
    }
    setSelected(rating);
    sendFeedback(rating);
  }

  function handleReason(reason: string) {
    if (reasonPicked) return;
    setReasonPicked(true);
    sendFeedback("inaccurate", reason);
  }

  const buttons: { rating: Rating; icon: typeof Check }[] = [
    { rating: "good", icon: Check },
    { rating: "irrelevant", icon: X },
    { rating: "inaccurate", icon: AlertTriangle },
  ];

  return (
    <div
      style={{
        paddingTop: 10,
        marginTop: 14,
        borderTop: "1px solid var(--rule)",
      }}
    >
      <div className="flex items-center gap-3">
        {buttons.map(({ rating, icon: Icon }) => {
          const isActive = selected === rating;
          const isDim = !!selected && !isActive;
          return (
            <button
              key={rating}
              onClick={() => handleRate(rating)}
              className="p-1"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                borderBottom: isActive
                  ? "1px solid var(--accent)"
                  : "1px solid transparent",
                opacity: isDim ? 0.3 : 1,
              }}
              title={rating}
              disabled={!!selected}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>
      {showReasons && !reasonPicked && (
        <div className="flex flex-wrap gap-3 mt-2">
          {INACCURACY_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => handleReason(reason)}
              className="font-sans uppercase"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.16em",
                color: "var(--accent)",
                borderBottom: "1px solid var(--accent)",
                paddingBottom: 1,
              }}
            >
              {reason}
            </button>
          ))}
        </div>
      )}
      {reasonPicked && (
        <p
          className="font-sans"
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 6,
          }}
        >
          Thanks for the detail
        </p>
      )}
    </div>
  );
}

function VerifyBadge() {
  return (
    <div
      className="inline-flex items-center gap-1 font-sans uppercase"
      style={{
        fontSize: 9,
        letterSpacing: "0.18em",
        color: "var(--accent)",
        marginLeft: 8,
      }}
      title="This item references time-sensitive info — worth verifying"
    >
      <AlertCircle size={10} />
      verify
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Headline — applies a serif-italic-300 treatment to digit/time runs so
// numbers feel quietly emphatic without the heavy span work in markup.

function emphasizeNumbers(text: string): React.ReactNode {
  const pattern = /(\d{1,2}:\d{2}(?:\s?(?:am|pm|AM|PM))?|\d+(?:,\d{3})*(?:\.\d+)?)/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (pattern.test(part)) {
      pattern.lastIndex = 0;
      return (
        <em
          key={i}
          className="font-serif italic"
          style={{ fontWeight: 300, fontStyle: "italic" }}
        >
          {part}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ──────────────────────────────────────────────────────────────────────
// Card

export function FeedCard({
  item,
  index,
  city,
  layoutHint,
  // Legacy props kept for compatibility — the new design ignores them.
  newRenderer: _newRenderer = true,
  variants: _variants = true,
  chips: _chips = true,
}: {
  item: FeedItem;
  index: number;
  city?: string;
  isNight?: boolean;
  layoutHint?: Variant;
  newRenderer?: boolean;
  variants?: boolean;
  chips?: boolean;
}) {
  const variant = pickVariant(item, index, layoutHint);

  const animation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: index * 0.08, ease: "easeOut" as const },
  };

  const categoryLabel = categoryConfig[item.category]?.label;

  // ── Hero — full-width photo, drop cap lede, fact strip ───────────────
  if (variant === "hero") {
    return (
      <motion.article {...animation}>
        {item.imageUrl && (
          <div style={{ width: "100%", height: 320, overflow: "hidden" }}>
            <img
              src={item.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <CatMark
            category={item.category}
            subkicker={categoryLabel ? "Almanac" : undefined}
          />
          <h2
            className="font-display"
            style={{
              fontSize: 36,
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              color: "var(--text-primary)",
              marginBottom: 10,
            }}
          >
            {emphasizeNumbers(item.title)}
            {item.confidence === "low" && <VerifyBadge />}
          </h2>
          <p
            className="font-serif italic"
            style={{
              fontSize: 16,
              fontWeight: 300,
              color: "var(--text-secondary)",
              lineHeight: 1.45,
              marginBottom: 14,
            }}
          >
            {firstSentence(item.body)}
          </p>
          <p
            className="font-serif drop-cap"
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--text-primary)",
            }}
          >
            {restOfBody(item.body)}
          </p>
          {item.facts && item.facts.length > 0 && <FactStrip facts={item.facts} />}
          {isPreview && city && <FeedbackRow item={item} city={city} />}
        </div>
      </motion.article>
    );
  }

  // ── Pull-quote — full-bleed editorial breakout ───────────────────────
  if (variant === "quote") {
    return (
      <motion.article {...animation}>
        <div
          className="relative"
          style={{
            margin: "32px -22px",
            padding: "36px 30px 32px",
            background: "var(--bg-quote)",
            borderTop: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <span
            aria-hidden
            className="font-display"
            style={{
              position: "absolute",
              top: 10,
              left: 22,
              fontSize: 80,
              lineHeight: 1,
              color: "var(--accent)",
              opacity: 0.35,
            }}
          >
            “
          </span>
          <div style={{ position: "relative", paddingTop: 26 }}>
            <CatMark category={item.category} />
            <p
              className="font-display italic"
              style={{
                fontSize: 26,
                lineHeight: 1.15,
                letterSpacing: "-0.005em",
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            >
              {item.title}
              {item.confidence === "low" && <VerifyBadge />}
            </p>
            <p
              className="font-sans"
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "var(--text-secondary)",
                marginBottom: 14,
              }}
            >
              {item.facts && item.facts.length > 0
                ? item.facts.join(" · ")
                : null}
            </p>
            <p
              className="font-serif"
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--text-secondary)",
              }}
            >
              {item.body}
            </p>
          </div>
        </div>
        {isPreview && city && <FeedbackRow item={item} city={city} />}
      </motion.article>
    );
  }

  // ── Stat — 2-col with big accent number ──────────────────────────────
  if (variant === "stat") {
    const headline =
      item.facts && item.facts.length > 0 ? item.facts[0] : null;
    const { value, unit } = splitNumberUnit(headline || "");
    const labelFact = item.facts && item.facts.length > 1 ? item.facts[1] : null;
    return (
      <motion.article {...animation}>
        <CatMark category={item.category} />
        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr auto",
            gap: 16,
            alignItems: "start",
          }}
        >
          <h3
            className="font-display"
            style={{
              fontSize: 28,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
            }}
          >
            {item.title}
            {item.confidence === "low" && <VerifyBadge />}
          </h3>
          {value && (
            <div style={{ textAlign: "right" }}>
              <div className="flex items-baseline justify-end gap-1">
                <span
                  className="font-display"
                  style={{
                    fontSize: 40,
                    lineHeight: 1,
                    color: "var(--accent)",
                  }}
                >
                  {value}
                </span>
                {unit && (
                  <span
                    className="font-sans"
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {unit}
                  </span>
                )}
              </div>
              {labelFact && (
                <p
                  className="font-sans uppercase"
                  style={{
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  {labelFact}
                </p>
              )}
            </div>
          )}
        </div>
        <p
          className="font-serif"
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
            marginTop: 14,
          }}
        >
          {item.body}
        </p>
        {isPreview && city && <FeedbackRow item={item} city={city} />}
      </motion.article>
    );
  }

  // ── Pulse — single-line list signal ──────────────────────────────────
  if (variant === "pulse") {
    const value =
      item.facts && item.facts.length > 0 ? item.facts[0] : null;
    return (
      <motion.article {...animation}>
        <div
          className="grid items-baseline"
          style={{
            gridTemplateColumns: "62px 1fr auto",
            gap: 12,
            padding: "14px 0",
          }}
        >
          <span
            className="font-sans uppercase"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.18em",
              color: "var(--accent)",
            }}
          >
            {categoryLabel || item.category}
          </span>
          <h3
            className="font-serif"
            style={{
              fontSize: 15,
              lineHeight: 1.3,
              color: "var(--text-primary)",
            }}
          >
            {item.title}
            {item.confidence === "low" && <VerifyBadge />}
          </h3>
          {value && (
            <span
              className="font-sans"
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </span>
          )}
        </div>
        {isPreview && city && <FeedbackRow item={item} city={city} />}
      </motion.article>
    );
  }

  // ── Standard — image + body ──────────────────────────────────────────
  if (variant === "standard") {
    return (
      <motion.article {...animation}>
        {item.imageUrl && (
          <div
            style={{
              width: "100%",
              height: 200,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <img
              src={item.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CatMark category={item.category} />
        <h3
          className="font-display"
          style={{
            fontSize: 24,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          {item.title}
          {item.confidence === "low" && <VerifyBadge />}
        </h3>
        <p
          className="font-serif"
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--text-secondary)",
          }}
        >
          {item.body}
        </p>
        {item.facts && item.facts.length > 0 && <FactStrip facts={item.facts} />}
        {isPreview && city && <FeedbackRow item={item} city={city} />}
      </motion.article>
    );
  }

  // ── Field notes — typographic only ───────────────────────────────────
  return (
    <motion.article {...animation}>
      <CatMark category={item.category} />
      <h3
        className="font-display"
        style={{
          fontSize: 22,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
          marginBottom: 8,
        }}
      >
        {item.title}
        {item.confidence === "low" && <VerifyBadge />}
      </h3>
      <p
        className="font-serif"
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--text-secondary)",
        }}
      >
        {item.body}
      </p>
      {isPreview && city && <FeedbackRow item={item} city={city} />}
    </motion.article>
  );
}

// ──────────────────────────────────────────────────────────────────────
// helpers

function firstSentence(body: string): string {
  if (!body) return "";
  const match = body.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : body.split(/\s+/).slice(0, 16).join(" ") + "…";
}

function restOfBody(body: string): string {
  const first = firstSentence(body);
  if (!body.startsWith(first)) return body;
  return body.slice(first.length).trim() || first;
}

function splitNumberUnit(raw: string): { value: string; unit: string } {
  if (!raw) return { value: "", unit: "" };
  // 9:30pm → value 9:30, unit pm
  const m1 = raw.match(/^(\d{1,2}:\d{2})\s*(am|pm|AM|PM)?$/);
  if (m1) return { value: m1[1], unit: m1[2] ? m1[2].toLowerCase() : "" };
  // 48°F → value 48°, unit F
  const m2 = raw.match(/^(\d+(?:\.\d+)?[°%]?)\s*([a-zA-Z]+)?$/);
  if (m2) return { value: m2[1], unit: m2[2] || "" };
  // Fallback — whole string as value
  return { value: raw, unit: "" };
}
