import { siteMeta } from "@/lib/api";
import { useResource } from "./useResource";

/** The ISO day the site's latest numbers are from; null until it is known. */
export function useDataDay(): string | null {
  return useResource(siteMeta()).data?.asOf ?? null;
}
