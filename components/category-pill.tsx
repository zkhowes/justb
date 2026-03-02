import { Category } from "@/lib/types";
import {
  Moon,
  Leaf,
  MapPin,
  Sprout,
  Landmark,
  Palette,
  Utensils,
  Users,
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
  gardening: {
    label: "Gardening",
    color: "var(--cat-gardening)",
    bg: "var(--cat-gardening-bg)",
    icon: Sprout,
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
};

export { categoryConfig };

export function CategoryPill({ category }: { category: Category }) {
  const config = categoryConfig[category];
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
