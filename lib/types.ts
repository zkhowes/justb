export type Category =
  | "history"
  | "nature"
  | "weather"
  | "culture"
  | "food"
  | "sports"
  | "music"
  | "community";

export type FeedItem = {
  id: string;
  title: string;
  body: string;
  category: Category;
  imageQuery: string;
};
