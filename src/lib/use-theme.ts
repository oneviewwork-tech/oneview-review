"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the dark theme is currently on.
 *
 * The theme lives as a class on <html>, set before hydration by
 * theme-script.tsx, which makes it external state — so it is subscribed to
 * rather than copied into React state in an effect. That also means every
 * control reading it stays in agreement when any one of them toggles.
 */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function useIsDarkTheme(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    // The server cannot know the viewer's theme; null means "not yet known"
    // so nothing renders a wrong icon on the first paint.
    () => null
  );
}

export function setDarkTheme(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    // Private browsing or blocked storage: the class still applies for this
    // page, it simply won't be remembered.
  }
}
