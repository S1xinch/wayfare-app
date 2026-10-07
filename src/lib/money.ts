import { useEffect, useSyncExternalStore } from "react";
import { CURRENCIES } from "./currencies";
import { me } from "./me";

/**
 * One shared display-currency store for the whole app. Fares arrive in USD; money() converts for display.
 * Preference: the account's value when signed in (follows you across devices), otherwise this device's.
 * Rates: European Central Bank via /api/rates, fetched once per page.
 */
type Rates = { date: string; rates: Record<string, number> };
type State = {
  cur: string; // the preference
  shown: string; // the currency actually applied (USD while rates load or if unavailable)
  rate: number;
  date: string;
  loading: boolean;
  error: string;
};

const SERVER: State = { cur: "USD", shown: "USD", rate: 1, date: "", loading: false, error: "" };
let state = SERVER;
let rates: Rates | null = null;
let signedIn = false;
let started = false;
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};

const save = (currency: string) =>
  fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency }) }).catch(() => {});

async function apply(cur: string) {
  if (cur === "USD") return set({ cur, shown: "USD", rate: 1, loading: false, error: "" });
  set({ cur, error: "", loading: !rates });
  if (!rates) {
    try {
      const r = await fetch("/api/rates");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      rates = j;
    } catch (e) {
      if (state.cur === cur) set({ shown: "USD", rate: 1, loading: false, error: (e as Error).message || "Exchange rates are unavailable right now." });
      return;
    }
  }
  if (state.cur !== cur) return; // the choice changed while rates were loading
  const rate = rates!.rates[cur];
  set(rate ? { shown: cur, rate, date: rates!.date, loading: false } : { shown: "USD", rate: 1, loading: false, error: `No exchange rate for ${cur}. Showing USD.` });
}

function start() {
  if (started) return;
  started = true;
  let local = "USD";
  try {
    const saved = localStorage.getItem("ff_currency");
    if (saved && CURRENCIES.includes(saved)) local = saved;
  } catch {}
  apply(local);
  me().then((j) => {
    if (!j) return;
    signedIn = true;
    if (j.currency && j.currency !== "USD") apply(j.currency);
    else if (local !== "USD") save(local); // chosen on this device before signing in: keep it
  });
}

export function setCurrency(c: string) {
  try {
    localStorage.setItem("ff_currency", c);
  } catch {}
  if (signedIn) save(c);
  apply(c);
}

/** Format a USD amount in the display currency. Amounts already in another currency are left as they are. */
export function money(n: number, from = "USD") {
  const convert = from === "USD" && state.shown !== "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: convert ? state.shown : from, maximumFractionDigits: 0 }).format(convert ? n * state.rate : n);
}

export function useCurrency() {
  const s = useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
    () => SERVER,
  );
  useEffect(start, []);
  return { ...s, setCurrency };
}
