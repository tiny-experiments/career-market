import { read } from "./resource";
import type { ProfessionIndex, ProfessionPage } from "./types";

export const professionsIndex = (region?: string) =>
  read<ProfessionIndex>(
    region === undefined
      ? "/api/professions"
      : `/api/professions?region=${encodeURIComponent(region)}`,
  );

export const professionDetail = (code: string) =>
  read<ProfessionPage>(`/api/professions/${encodeURIComponent(code)}`);
