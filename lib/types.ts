export type Category =
  | "sky-space"
  | "nature"
  | "local-scene"
  | "sports"
  | "events"
  | "earth-garden"
  | "history"
  | "culture"
  | "food"
  | "community";

export type FeedItem = {
  id: string;
  title: string;
  body: string;
  category: Category;
  confidence: "high" | "medium" | "low";
  imageQuery?: string;
  imageUrl?: string;
};
