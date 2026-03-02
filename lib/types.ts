export type Category =
  | "sky-space"
  | "nature"
  | "local-scene"
  | "gardening"
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
};
