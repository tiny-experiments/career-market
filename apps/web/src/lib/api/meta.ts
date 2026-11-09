import { read } from "./resource";
import type { ChromePayload } from "./types";

export const siteMeta = () => read<ChromePayload>("/api/meta");
