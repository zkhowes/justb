import { Category } from "@/lib/types";
import {
  Moon,
  Sun,
  Star,
  Leaf,
  MapPin,
  Mountain,
  Landmark,
  Palette,
  Utensils,
  Users,
  Trophy,
  Music,
  CalendarDays,
  Waves,
  Wind,
  Siren,
  LucideIcon,
} from "lucide-react";

const categoryConfig: Record<
  Category,
  { label: string; color: string; bg: string; icon: LucideIcon }
> = {
  "sky-space": {
    label: "Sky & Space",
    color: "var(--cat-sky-space)",
    bg: "var(--cat-sky-space-bg)",
    icon: Moon,
  },
  sky: {
    label: "Sky",
    color: "var(--cat-sky)",
    bg: "var(--cat-sky-bg)",
    icon: Sun,
  },
  space: {
    label: "Space",
    color: "var(--cat-space)",
    bg: "var(--cat-space-bg)",
    icon: Star,
  },
  nature: {
    label: "Nature",
    color: "var(--cat-nature)",
    bg: "var(--cat-nature-bg)",
    icon: Leaf,
  },
  "local-scene": {
    label: "Local Scene",
    color: "var(--cat-local-scene)",
    bg: "var(--cat-local-scene-bg)",
    icon: MapPin,
  },
  sports: {
    label: "Sports",
    color: "var(--cat-sports)",
    bg: "var(--cat-sports-bg)",
    icon: Trophy,
  },
  events: {
    label: "Events",
    color: "var(--cat-events)",
    bg: "var(--cat-events-bg)",
    icon: Music,
  },
  "earth-garden": {
    label: "Earth & Garden",
    color: "var(--cat-earth-garden)",
    bg: "var(--cat-earth-garden-bg)",
    icon: Mountain,
  },
  history: {
    label: "History",
    color: "var(--cat-history)",
    bg: "var(--cat-history-bg)",
    icon: Landmark,
  },
  culture: {
    label: "Culture",
    color: "var(--cat-culture)",
    bg: "var(--cat-culture-bg)",
    icon: Palette,
  },
  food: {
    label: "Food",
    color: "var(--cat-food)",
    bg: "var(--cat-food-bg)",
    icon: Utensils,
  },
  community: {
    label: "Community",
    color: "var(--cat-community)",
    bg: "var(--cat-community-bg)",
    icon: Users,
  },
  happenings: {
    label: "Happenings",
    color: "var(--cat-happenings)",
    bg: "var(--cat-happenings-bg)",
    icon: CalendarDays,
  },
  water: {
    label: "Water",
    color: "var(--cat-water)",
    bg: "var(--cat-water-bg)",
    icon: Waves,
  },
  air: {
    label: "Air",
    color: "var(--cat-air)",
    bg: "var(--cat-air-bg)",
    icon: Wind,
  },
  civic: {
    label: "Civic",
    color: "var(--cat-civic)",
    bg: "var(--cat-civic-bg)",
    icon: Siren,
  },
};

export { categoryConfig };

/**
 * Legacy colored bubble — still used by admin/debug screens.
 */
export function CategoryPill({ category }: { category: Category }) {
  const config = categoryConfig[category];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}

/**
 * Magazine-style category mark — a 1px accent rule above an uppercase kicker.
 * Used in feed cards. `subkicker` adds a "·" + extra text on the same line
 * (e.g. "Sky · Almanac" or "History · 97 yrs ago").
 */
export function CatMark({
  category,
  subkicker,
}: {
  category: Category;
  subkicker?: string;
}) {
  const config = categoryConfig[category];
  const label = config?.label ?? category;

  return (
    <div style={{ minWidth: 56, marginBottom: 8 }}>
      <div
        aria-hidden
        style={{
          width: "100%",
          height: 1,
          background: "var(--accent)",
          marginBottom: 6,
        }}
      />
      <span
        className="font-sans uppercase"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.18em",
          color: "var(--accent)",
          lineHeight: 1,
        }}
      >
        {label}
        {subkicker && (
          <>
            {" · "}
            <span style={{ color: "var(--accent)" }}>{subkicker}</span>
          </>
        )}
      </span>
    </div>
  );
}
