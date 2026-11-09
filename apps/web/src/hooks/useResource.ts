import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  fetchResource,
  peek,
  subscribe,
  type Resource,
  type ResourceEntry,
} from "@/lib/api";
import { describeFailure, type Failure } from "@/lib/failure";

export interface ResourceState<T> {
  /** The answer for this key, however old; null until one lands. */
  readonly data: T | null;
  /** An answer is on its way. With `data` set, it is a quiet refresh. */
  readonly loading: boolean;
  /** Why the latest read failed, in plain words. */
  readonly error: Failure | null;
  readonly reload: () => void;
}

const nothing = () => () => undefined;

/**
 * One read, shared with every other reader of its key. A key already answered
 * renders on the first pass, with no skeleton; a new key shows nothing from
 * the old one. A null resource reads nothing.
 */
export function useResource<T>(resource: Resource<T> | null): ResourceState<T> {
  const key = resource?.key ?? null;
  const [nonce, setNonce] = useState(0);
  const reloaded = useRef(0);
  const current = useEffectEvent(() => resource);

  const listen = useCallback(
    (listener: () => void) =>
      key === null ? nothing() : subscribe(key, listener),
    [key],
  );
  const entry = useSyncExternalStore<ResourceEntry<T> | undefined>(
    listen,
    () => (key === null ? undefined : peek<T>(key)),
  );

  useEffect(() => {
    const target = current();
    if (target === null) return;
    const force = reloaded.current !== nonce;
    reloaded.current = nonce;
    const controller = new AbortController();
    fetchResource(target, { force, signal: controller.signal });
    return () => controller.abort();
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const pending = key !== null && (entry === undefined || entry.pending);
  return {
    data: entry?.data ?? null,
    loading: pending,
    error:
      !pending && entry?.error != null ? describeFailure(entry.error) : null,
    reload,
  };
}
