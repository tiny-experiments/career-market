import { createCn } from "cn/config";

// The type tokens from index.css. Unregistered, `text-eyebrow` reads as a text
// colour: it would drop `text-muted-foreground` and keep a clashing `text-sm`.
export const cn = createCn({
  extend: {
    theme: {
      text: ["display", "h1", "h2", "body", "small", "eyebrow"],
      container: ["page"],
      spacing: [
        "nav",
        "subbar",
        "row",
        "row-compact",
        "control",
        "rail",
        "gutter",
        "spark",
        "spark-h",
      ],
      shadow: ["card", "float"],
    },
  },
});
