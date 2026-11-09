import { read } from "./resource";
import type { ProfessionIndex, ProfessionPage } from "./types";

export const professionsIndex = () => read<ProfessionIndex>("/api/professions");

export const professionDetail = (code: string) =>
  read<ProfessionPage>(`/api/professions/${encodeURIComponent(code)}`);
