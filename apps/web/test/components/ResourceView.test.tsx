import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResourceView } from "@/components/common";
import type { Failure } from "@/lib/failure";

const base = {
  data: null as number | null,
  loading: false,
  error: null as Failure | null,
  reload: () => undefined,
};

const view = (state: Partial<typeof base>) =>
  render(
    <ResourceView
      state={{ ...base, ...state }}
      skeleton={<p>skeleton</p>}
      errorTitle="Numbers could not be loaded"
      notFound={<p>missing</p>}
      isEmpty={(n) => n === 0}
      empty={<p>empty</p>}
    >
      {(n) => <p>value {n}</p>}
    </ResourceView>,
  );

describe("ResourceView", () => {
  it("shows the skeleton until the first answer", () => {
    view({ loading: true });
    expect(screen.getByText("skeleton")).toBeInTheDocument();
  });

  it("keeps the answer on screen during a refresh", () => {
    view({ data: 5, loading: true });
    expect(screen.getByText("value 5")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    view({ data: 0 });
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("shows the empty state when nothing was asked", () => {
    view({});
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("offers a retry on failure", async () => {
    const reload = vi.fn();
    render(
      <ResourceView
        state={{
          ...base,
          reload,
          error: { code: "INTERNAL", message: undefined },
        }}
        skeleton={null}
        errorTitle="Numbers could not be loaded"
      >
        {() => null}
      </ResourceView>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Numbers could not be loaded",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each(["NOT_FOUND", "VALIDATION_FAILED"])(
    "treats %s as a missing page",
    (code) => {
      view({ error: { code: code as Failure["code"], message: undefined } });
      expect(screen.getByText("missing")).toBeInTheDocument();
    },
  );
});
