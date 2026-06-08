export type ProductCategory =
  | "headcount"
  | "background"
  | "framing"
  | "pose"
  | "expression"
  | "appearance"
  | "outfit"
  | "custom_main"
  | "custom_negative"
  | "character_scope"
  | "utility";

export type CatalogTarget = "prompt" | "negative" | "character" | "any";

export type CatalogReviewStatus =
  | "accepted"
  | "candidate"
  | "rejected"
  | "needs_review";

export interface CoreCatalogEntry {
  id: string;
  tag: string;
  label: string;
  koreanLabel: string;
  productCategory: ProductCategory;
  sourceMajorCategory: string;
  sourceMinorCategory: string;
  count: number;
  aliases: string[];
  priority: number;
  defaultVisible: boolean;
  target: CatalogTarget;
  reviewStatus: "accepted";
}
