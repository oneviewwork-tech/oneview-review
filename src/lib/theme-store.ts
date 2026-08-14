// A tiny external store for the .dark class on <html>, so multiple
// ThemeToggle instances (and future consumers) stay in sync and reads use
// useSyncExternalStore instead of a setState-in-effect pattern — the
// server has no way to know the visitor's theme (it's read from
// localStorage/matchMedia by theme-script.tsx before hydration), so
// getServerSnapshot below intentionally returns a fixed default and the
// hook itself handles reconciling that against the real DOM after mount.
const listeners = new Set<() => void>();

export function subscribeTheme(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getThemeSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function getThemeServerSnapshot(): boolean {
  return false;
}

export function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", dark ? "dark" : "light");
  listeners.forEach((l) => l());
}
