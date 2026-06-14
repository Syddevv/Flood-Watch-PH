import Script from "next/script";

import { THEME_STORAGE_KEY } from "@/lib/constants";

const script = `
(() => {
  try {
    const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme = stored === "dark" ? "dark" : "light";
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
  } catch {
    document.documentElement.dataset.theme = "light";
    document.documentElement.classList.remove("dark");
  }
})();
`;

export function ThemeScript() {
  return (
    <Script
      id="theme-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
