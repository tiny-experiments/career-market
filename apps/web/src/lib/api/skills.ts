import { read } from "./resource";
import type { SkillIndexPayload, SkillPagePayload } from "./types";

export const skillsIndex = () => read<SkillIndexPayload>("/api/skills");

export const skillDetail = (slug: string) =>
  read<SkillPagePayload>(`/api/skills/${encodeURIComponent(slug)}`);
