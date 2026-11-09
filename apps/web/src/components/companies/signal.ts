import type { Signal } from "@/components/data/SignalBadge";
import type { CompanySignalState } from "@/lib/api";

export function signalOf(state: CompanySignalState): Signal {
  return state.toLowerCase() as Signal;
}
