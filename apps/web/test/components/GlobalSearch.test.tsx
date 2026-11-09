import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it } from "vitest";
import { GlobalSearch } from "@/components/layout";
import { clearResources } from "@/lib/api";
import { stubFetch } from "../support/fetchStub";
import { renderWithRouter } from "../support/renderWithRouter";

const KUBERNETES = {
  body: {
    query: "k8s",
    groups: [
      {
        kind: "skill",
        title: "Skills",
        hits: [
          {
            kind: "skill",
            id: "kubernetes",
            label: "Kubernetes",
            sublabel: null,
            href: "/skills/kubernetes",
            open: 10,
            domain: null,
          },
        ],
      },
    ],
    roles: [
      {
        id: "kr_abc123",
        title: "Platform Engineer",
        company: "Stripe",
        location: null,
        url: "/jobs/kr_abc123",
      },
    ],
    rolesUnavailable: false,
  },
};

const render = () =>
  renderWithRouter(
    <ThemeProvider attribute="class">
      <GlobalSearch />
    </ThemeProvider>,
  );

const type = async (text: string) => {
  const user = userEvent.setup();
  await user.keyboard("/");
  await user.type(
    await screen.findByPlaceholderText(
      "Search professions, companies, skills, jobs",
    ),
    text,
  );
  return user;
};

beforeEach(() => clearResources());

describe("GlobalSearch", () => {
  it("shows the server's matches even when the words differ, and opens one", async () => {
    stubFetch({ "/api/search?limit=5&q=k8s&roles=1": KUBERNETES });
    render();
    const user = await type("k8s");
    await user.click(await screen.findByText("Kubernetes"));
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/skills/kubernetes",
    );
  });

  it("lists jobs that land on our own job page, and a way to all results", async () => {
    stubFetch({ "/api/search?limit=5&q=k8s&roles=1": KUBERNETES });
    render();
    const user = await type("k8s");
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    await user.click(await screen.findByText("See all results for “k8s”"));
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/search?q=k8s",
    );
  });

  it("asks once per pause in typing, and not for a single letter", async () => {
    const mock = stubFetch();
    render();
    await type("k");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mock).not.toHaveBeenCalled();
    await userEvent.keyboard("8s");
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(mock.mock.calls[0]?.[0]).toBe("/api/search?limit=5&q=k8s&roles=1");
  });

  it("says so when nothing matches", async () => {
    stubFetch({
      "/api/search?limit=5&q=zzz&roles=1": {
        body: { query: "zzz", groups: [], roles: [], rolesUnavailable: false },
      },
    });
    render();
    await type("zzz");
    expect(
      await screen.findByText("Nothing matches that yet."),
    ).toBeInTheDocument();
  });

  it("starts empty the next time it opens", async () => {
    stubFetch({ "/api/search?limit=5&q=k8s&roles=1": KUBERNETES });
    render();
    const user = await type("k8s");
    await screen.findByText("Kubernetes");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.keyboard("/");
    expect(
      await screen.findByPlaceholderText(
        "Search professions, companies, skills, jobs",
      ),
    ).toHaveValue("");
  });
});
