"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, X, AlertTriangle } from "lucide-react";
import { FeedItem, Category } from "@/lib/types";
import { CategoryPill, categoryConfig } from "./category-pill";

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

const gradients: Record<Category, string> = {
  "sky-space": "from-indigo-900 to-indigo-700",
  sky: "from-amber-700 to-amber-500",
  space: "from-indigo-900 to-indigo-700",
  nature: "from-emerald-700 to-emerald-500",
  "local-scene": "from-amber-700 to-amber-500",
  sports: "from-red-700 to-red-500",
  events: "from-violet-700 to-violet-500",
  "earth-garden": "from-lime-700 to-lime-500",
  history: "from-yellow-800 to-yellow-600",
  culture: "from-purple-700 to-purple-500",
  food: "from-orange-700 to-orange-500",
  community: "from-teal-700 to-teal-500",
  happenings: "from-rose-700 to-pink-500",
  water: "from-sky-800 to-cyan-600",
  air: "from-indigo-700 to-sky-500",
  civic: "from-red-900 to-red-600",
};

type Rating = "good" | "irrelevant" | "inaccurate";
type Variant = "hero" | "quote" | "stat" | "minimal" | "standard";

const INACCURACY_REASONS = [
  "Wrong time/date",
  "Wrong facts",
  "Not my city",
  "Other",
] as const;

function pickVariant(item: FeedItem, index: number): Variant {
  if (index === 0 && item.imageUrl) return "hero";
  if (item.category === "history" || item.category === "culture") return "quote";
  if (item.category === "sky" || item.category === "space" || item.category === "sports" || item.category === "water" || item.category === "air" || item.category === "civic") return "stat";
  if (item.category === "community" || item.category === "food" || item.category === "happenings") return "minimal";
  return "standard";
}

function Chips({ facts, isNight }: { facts: string[]; isNight: boolean }) {
  if (!facts || facts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {facts.map((f, i) => (
        <span
          key={i}
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            isNight
              ? "border-white/20 bg-white/10 text-white/85"
              : "border-black/10 bg-black/5 text-[var(--text-secondary)]"
          }`}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

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

  const buttons: { rating: Rating; icon: typeof Check; color: string; activeColor: string }[] = [
    { rating: "good", icon: Check, color: "text-[var(--text-muted)]", activeColor: "text-emerald-500" },
    { rating: "irrelevant", icon: X, color: "text-[var(--text-muted)]", activeColor: "text-amber-500" },
    { rating: "inaccurate", icon: AlertTriangle, color: "text-[var(--text-muted)]", activeColor: "text-red-500" },
  ];

  return (
    <div className="pt-3 mt-3 border-t border-[var(--border)]/50">
      <div className="flex items-center gap-1">
        {buttons.map(({ rating, icon: Icon, color, activeColor }) => (
          <button
            key={rating}
            onClick={() => handleRate(rating)}
            className={`p-1.5 rounded-lg transition-all ${
              selected === rating
                ? activeColor
                : selected
                  ? "opacity-30 " + color
                  : color + " hover:bg-[var(--border)]/30"
            }`}
            title={rating}
            disabled={!!selected}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
      {showReasons && !reasonPicked && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {INACCURACY_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => handleReason(reason)}
              className="px-2.5 py-1 text-[11px] rounded-full border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors"
            >
              {reason}
            </button>
          ))}
        </div>
      )}
      {reasonPicked && (
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Thanks for the detail</p>
      )}
    </div>
  );
}

export function FeedCard({
  item,
  index,
  city,
  isNight,
  newRenderer = true,
  variants = true,
  chips = true,
}: {
  item: FeedItem;
  index: number;
  city?: string;
  isNight?: boolean;
  newRenderer?: boolean;
  variants?: boolean;
  chips?: boolean;
}) {
  const Icon = categoryConfig[item.category]?.icon;
  const gradient = gradients[item.category] || "from-gray-700 to-gray-500";
  const showChips = newRenderer && chips && !!item.facts && item.facts.length > 0;
  const variant: Variant = newRenderer && variants ? pickVariant(item, index) : "standard";
  const night = !!isNight;

  const wrapperClasses = `rounded-xl overflow-hidden backdrop-blur-xl border ${
    night
      ? "bg-indigo-950/40 border-white/10 shadow-lg shadow-indigo-950/20"
      : "bg-white/60 border-white/30 shadow-lg shadow-black/5"
  }`;

  const animation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: index * 0.08, ease: "easeOut" as const },
  };

  // --- Variant: hero (index 0, has image) ---
  if (variant === "hero" && item.imageUrl) {
    return (
      <motion.article {...animation} className={wrapperClasses}>
        <div className="relative h-72 overflow-hidden">
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
          <div className="absolute top-3 left-3"><CategoryPill category={item.category} /></div>
          {item.confidence === "low" && <VerifyBadge />}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            {showChips && <Chips facts={item.facts!} isNight={true} />}
            <h2 className="font-serif text-2xl font-bold leading-tight text-white drop-shadow">
              {item.title}
            </h2>
          </div>
        </div>
        <div className="p-5">
          <p className={`text-sm leading-relaxed ${night ? "text-white/75" : ""}`}
             style={night ? undefined : { color: "var(--text-secondary)" }}>
            {item.body}
          </p>
          {isPreview && city && <FeedbackRow item={item} city={city} />}
        </div>
      </motion.article>
    );
  }

  // --- Variant: quote (history, culture) ---
  if (variant === "quote") {
    return (
      <motion.article {...animation} className={wrapperClasses}>
        <div className={`relative bg-gradient-to-br ${gradient} p-6`}>
          <div className="absolute top-3 left-3"><CategoryPill category={item.category} /></div>
          {item.confidence === "low" && <VerifyBadge />}
          <div className="pt-8">
            {showChips && <Chips facts={item.facts!} isNight={true} />}
            <p className="font-serif italic text-xl leading-snug text-white/95 mb-3">
              &ldquo;{item.title}&rdquo;
            </p>
            <p className="text-sm leading-relaxed text-white/80">{item.body}</p>
          </div>
        </div>
        {isPreview && city && (
          <div className="px-5 pb-3 pt-0">
            <FeedbackRow item={item} city={city} />
          </div>
        )}
      </motion.article>
    );
  }

  // --- Variant: stat (sky, space, sports) — first fact becomes the headline number ---
  if (variant === "stat") {
    const headline = item.facts && item.facts.length > 0 ? item.facts[0] : null;
    const restFacts = item.facts ? item.facts.slice(1) : [];
    return (
      <motion.article {...animation} className={wrapperClasses}>
        {item.imageUrl ? (
          <div className="relative h-32 overflow-hidden">
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute top-3 left-3"><CategoryPill category={item.category} /></div>
            {item.confidence === "low" && <VerifyBadge />}
          </div>
        ) : (
          <div className={`relative h-16 bg-gradient-to-br ${gradient}`}>
            <div className="absolute top-3 left-3"><CategoryPill category={item.category} /></div>
            {item.confidence === "low" && <VerifyBadge />}
          </div>
        )}
        <div className="p-5">
          {newRenderer && headline && (
            <p className={`font-serif text-3xl font-bold leading-none mb-1 ${
              night ? "text-white" : "text-[var(--text-primary)]"
            }`}>
              {headline}
            </p>
          )}
          <h2 className={`font-serif text-base font-semibold leading-snug mb-2 ${night ? "text-white/90" : ""}`}>
            {item.title}
          </h2>
          {showChips && restFacts.length > 0 && <Chips facts={restFacts} isNight={night} />}
          <p className={`text-sm leading-relaxed ${night ? "text-white/75" : ""}`}
             style={night ? undefined : { color: "var(--text-secondary)" }}>
            {item.body}
          </p>
          {isPreview && city && <FeedbackRow item={item} city={city} />}
        </div>
      </motion.article>
    );
  }

  // --- Variant: minimal (community, food) — typography-only on gradient ---
  if (variant === "minimal") {
    return (
      <motion.article {...animation} className={wrapperClasses}>
        <div className={`relative bg-gradient-to-br ${gradient} p-6`}>
          <div className="absolute top-3 left-3"><CategoryPill category={item.category} /></div>
          {item.confidence === "low" && <VerifyBadge />}
          <div className="pt-8">
            {showChips && <Chips facts={item.facts!} isNight={true} />}
            <h2 className="font-serif text-xl font-bold leading-tight text-white mb-2">
              {item.title}
            </h2>
            <p className="text-sm leading-relaxed text-white/85">{item.body}</p>
            {Icon && (
              <Icon size={120} className="absolute -bottom-6 -right-6 text-white/10 pointer-events-none" strokeWidth={1.5} />
            )}
          </div>
        </div>
        {isPreview && city && (
          <div className="px-5 pb-3">
            <FeedbackRow item={item} city={city} />
          </div>
        )}
      </motion.article>
    );
  }

  // --- Standard (the original layout, used when newRenderer is off OR variant fallback) ---
  return (
    <motion.article {...animation} className={wrapperClasses}>
      {item.imageUrl ? (
        <div className="relative h-48 overflow-hidden">
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-3 left-3"><CategoryPill category={item.category} /></div>
          {item.confidence === "low" && <VerifyBadge />}
        </div>
      ) : (
        <div className={`relative h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          {Icon && <Icon size={48} className="text-white/20" strokeWidth={1.5} />}
          <div className="absolute top-3 left-3"><CategoryPill category={item.category} /></div>
          {item.confidence === "low" && <VerifyBadge />}
        </div>
      )}
      <div className="p-5">
        <h2 className={`font-serif text-lg font-semibold leading-snug mb-2 ${night ? "text-white" : ""}`}>
          {item.title}
        </h2>
        {showChips && <Chips facts={item.facts!} isNight={night} />}
        <p className={`text-sm leading-relaxed ${night ? "text-white/75" : ""}`}
           style={night ? undefined : { color: "var(--text-secondary)" }}>
          {item.body}
        </p>
        {isPreview && city && <FeedbackRow item={item} city={city} />}
      </div>
    </motion.article>
  );
}

function VerifyBadge() {
  return (
    <div
      className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-amber-700"
      title="This item references time-sensitive info — worth verifying"
    >
      <AlertCircle size={10} />
      verify
    </div>
  );
}
