"use client";

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { FeedItem, Category } from "@/lib/types";
import { CategoryPill, categoryConfig } from "./category-pill";

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

export function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const Icon = categoryConfig[item.category]?.icon;
  const gradient = gradients[item.category] || "from-gray-700 to-gray-500";

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className="bg-[var(--bg-card)] rounded-xl overflow-hidden"
      style={{ boxShadow: "var(--shadow)" }}
    >
      {item.imageUrl ? (
        <div className="relative h-32 overflow-hidden">
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
      </div>
    </motion.article>
  );
}
