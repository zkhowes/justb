import { Category } from "@/lib/types";

const categoryConfig: Record<Category, { label: string; color: string; bg: string }> = {
  history: { label: "History", color: "var(--cat-history)", bg: "var(--cat-history-bg)" },
  nature: { label: "Nature", color: "var(--cat-nature)", bg: "var(--cat-nature-bg)" },
  weather: { label: "Weather", color: "var(--cat-weather)", bg: "var(--cat-weather-bg)" },
  culture: { label: "Culture", color: "var(--cat-culture)", bg: "var(--cat-culture-bg)" },
  food: { label: "Food", color: "var(--cat-food)", bg: "var(--cat-food-bg)" },
  sports: { label: "Sports", color: "var(--cat-sports)", bg: "var(--cat-sports-bg)" },
  music: { label: "Music", color: "var(--cat-music)", bg: "var(--cat-music-bg)" },
  community: { label: "Community", color: "var(--cat-community)", bg: "var(--cat-community-bg)" },
};

export function CategoryPill({ category }: { category: Category }) {
  const config = categoryConfig[category];

  return (
    <span
      className="inline-block px-2.5 py-1 text-xs font-medium rounded-full"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}
