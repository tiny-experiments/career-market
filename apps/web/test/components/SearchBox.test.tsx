import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SearchBox, type SearchGroup } from "@/components/layout";
import { renderWithRouter } from "../support/renderWithRouter";

const GROUPS: SearchGroup[] = [
  {
    heading: "Companies",
    items: [
      {
        id: "stripe",
        label: "Stripe",
        hint: "stripe.com",
        to: "/companies/stripe",
      },
    ],
  },
  {
    heading: "Skills",
    items: [{ id: "python", label: "Python", to: "/skills/python" }],
  },
];

describe("SearchBox", () => {
  it("opens with the slash key and navigates to the chosen result", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SearchBox groups={GROUPS} />, {
      extraRoutes: [{ path: "/companies/:slug", element: <p>Company page</p> }],
    });
    await user.keyboard("/");
    const input = await screen.findByPlaceholderText(
      "Search professions, companies, skills, jobs",
    );
    await user.type(input, "stri");
    await user.click(await screen.findByText("Stripe"));
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/companies/stripe",
    );
  });

  it("asks for a query before anything is typed", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SearchBox />);
    await user.click(
      screen.getByRole("button", { name: /^Search professions/ }),
    );
    expect(
      await screen.findByText(
        "Start typing to search professions, companies, skills and jobs.",
      ),
    ).toBeInTheDocument();
  });
});
