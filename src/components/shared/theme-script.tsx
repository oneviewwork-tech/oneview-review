import Script from "next/script";

// Runs before hydration so the correct theme class is present on <html>
// for the very first paint — without this, a dark-mode user sees a flash
// of the light theme (or vice versa) on every load.
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export function ThemeScript() {
  // App Router's own docs recommend beforeInteractive from the root layout
  // for exactly this pre-hydration case; the underlying eslint rule
  // predates App Router and only knows about pages/_document.js.
  // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
  return <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>;
}
