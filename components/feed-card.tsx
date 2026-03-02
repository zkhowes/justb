"use client";

import { motion } from "framer-motion";
import { FeedItem } from "@/lib/types";
import { CategoryPill } from "./category-pill";

export function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const imageUrl = `https://source.unsplash.com/800x450/?${encodeURIComponent(item.imageQuery)}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
      className="bg-[var(--bg-card)] rounded-xl overflow-hidden"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={item.title}
          className="feed-card-image"
          loading="lazy"
        />
        <div className="absolute top-3 left-3">
          <CategoryPill category={item.category} />
        </div>
      </div>
      <div className="p-5">
        <h2 className="font-serif text-lg font-semibold leading-snug mb-2">
          {item.title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {item.body}
        </p>
      </div>
    </motion.article>
  );
}
