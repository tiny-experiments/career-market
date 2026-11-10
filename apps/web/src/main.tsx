import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { THEME_STORAGE_KEY } from "./lib/theme.ts";
import { createAppRouter } from "./router.tsx";

const router = createAppRouter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
    >
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
