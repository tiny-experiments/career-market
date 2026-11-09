import { read } from "./resource";
import type { MarketOverview } from "./types";

export const marketOverview = () => read<MarketOverview>("/api/market");
