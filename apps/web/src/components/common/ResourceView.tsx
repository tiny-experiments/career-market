import type { ReactNode } from "react";
import { ErrorState } from "@/components/common/ErrorState";
import type { ResourceState } from "@/hooks/useResource";

export interface ResourceViewProps<T> {
  readonly state: Pick<
    ResourceState<T>,
    "data" | "loading" | "error" | "reload"
  >;
  /** Shown only until the first answer: a refresh keeps the answer on screen. */
  readonly skeleton: ReactNode;
  /** What could not be loaded: "Companies could not be loaded". */
  readonly errorTitle: string;
  /** Replaces the error when the address names something that does not exist. */
  readonly notFound?: ReactNode;
  readonly isEmpty?: (data: T) => boolean;
  /** Shown when `isEmpty` holds, or when nothing was asked for. */
  readonly empty?: ReactNode;
  readonly children: (data: T) => ReactNode;
}

/** The four states of a read, drawn the same way on every page. */
export function ResourceView<T>({
  state,
  skeleton,
  errorTitle,
  notFound,
  isEmpty,
  empty = null,
  children,
}: ResourceViewProps<T>) {
  const { data, loading, error, reload } = state;
  if (data !== null) return isEmpty?.(data) ? empty : children(data);
  if (error !== null) {
    const missing =
      error.code === "NOT_FOUND" || error.code === "VALIDATION_FAILED";
    if (missing && notFound !== undefined) return notFound;
    return (
      <ErrorState
        title={errorTitle}
        onRetry={reload}
        {...(error.message === undefined ? {} : { message: error.message })}
      />
    );
  }
  return loading ? skeleton : empty;
}
