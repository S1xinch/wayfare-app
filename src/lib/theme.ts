import { useEffect, useSyncExternalStore } from "react";
import { me } from "./me";
import { parseTheme, resolveTheme, type Theme } from "./theme-core";

/**
 * Site-wide theme. "system" follows the device (including when it switches at sunset); light/dark force it.
 * The choice is kept on this device and, when signed in, on the account so it follows you across devices.
 * layout.tsx runs a tiny script before first paint so the right theme is already applied on load.
 */
type State = { pref: Theme; resolved: "light" | "dark" };

const KEY = "wf_theme";
const SERVER: State = { pref: "system", resolved: "light" };
let state = SERVER;
let started = false;
let signedIn = false;
const subs = new Set<() => void>();
const query = () => matchMedia("(prefers-color-scheme: dark)");

function apply(pref: Theme) {
  const resolved = resolveTheme(pref, query().matches);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePref = pref;
  root.style.colorScheme = resolved;
  state = { pref, resolved };
  subs.forEach((f) => f());
}

const remember = (pref: Theme) => {
  try {
    localStorage.setItem(KEY, pref);
  } catch {}
};

const save = (theme: Theme) =>
  fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }) }).catch(() => {});

export function setTheme(pref: Theme) {
  remember(pref);
  if (signedIn) save(pref);
  apply(pref);
}

function start() {
  if (started) return;
  started = true;
  let local: Theme | null = null;
  try {
    local = parseTheme(localStorage.getItem(KEY));
  } catch {}
  apply(local ?? "system");
  query().addEventListener("change", () => {
    if (state.pref === "system") apply("system");
  });
  me().then((acct) => {
    if (!acct) return;
    signedIn = true;
    const server = parseTheme(acct.theme);
    if (server) {
      remember(server);
      apply(server); // the account's choice wins, so every device agrees
    } else if (local) save(local); // chosen on this device before signing in: keep it
  });
}

export function useTheme() {
  const s = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
    () => SERVER,
  );
  useEffect(start, []);
  return { ...s, setTheme };
}
