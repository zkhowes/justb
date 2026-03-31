"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, X, AlertTriangle } from "lucide-react";
import { FeedItem, Category } from "@/lib/types";
import { CategoryPill, categoryConfig } from "./category-pill";

const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";

const gradients: Record<Category, string> = {
  "sky-space": "from-indigo-900 to-indigo-700",
  nature: "from-emerald-700 to-emerald-500",
  "local-scene": "from-amber-700 to-amber-500",
  sports: "from-red-700 to-red-500",
  events: "from-violet-700 to-violet-500",
  "earth-garden": "from-lime-700 to-lime-500",
  history: "from-yellow-800 to-yellow-600",
  culture: "from-purple-700 to-purple-500",
  food: "from-orange-700 to-orange-500",
  community: "from-teal-700 to-teal-500",
};

type Rating = "good" | "irrelevant" | "inaccurate";

const INACCURACY_REASONS = [
  "Wrong time/date",
  "Wrong facts",
  "Not my city",
  "Other",
] as const;

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
    <div className="pt-3 border-t border-[var(--border)]/50">
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
}: {
  item: FeedItem;
  index: number;
  city?: string;
  isNight?: boolean;
}) {
  const Icon = categoryConfig[item.category]?.icon;
  const gradient = gradients[item.category] || "from-gray-700 to-gray-500";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className={`rounded-xl overflow-hidden backdrop-blur-xl border ${
        isNight
          ? "bg-indigo-950/40 border-white/10 shadow-lg shadow-indigo-950/20"
          : "bg-white/60 border-white/30 shadow-lg shadow-black/5"
      }`}
    >
      {item.imageUrl ? (
        <div className="relative h-48 overflow-hidden">
          <img
            src={item.imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-3 left-3">
            <CategoryPill category={item.category} />
          </div>
          {item.confidence === "low" && (
            <div
              className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-amber-700"
              title="This item references time-sensitive info — worth verifying"
            >
              <AlertCircle size={10} />
              verify
            </div>
          )}
        </div>
      ) : (
        <div
          className={`relative h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}
        >
          {Icon && (
            <Icon size={48} className="text-white/20" strokeWidth={1.5} />
          )}
          <div className="absolute top-3 left-3">
            <CategoryPill category={item.category} />
          </div>
          {item.confidence === "low" && (
            <div
              className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-amber-700"
              title="This item references time-sensitive info — worth verifying"
            >
              <AlertCircle size={10} />
              verify
            </div>
          )}
        </div>
      )}
      <div className="p-5">
        <h2 className="font-serif text-lg font-semibold leading-snug mb-2">
          {item.title}
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {item.body}
        </p>
        {isPreview && city && <FeedbackRow item={item} city={city} />}
      </div>
    </motion.article>
  );
}
