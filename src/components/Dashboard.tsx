"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import { flightCode, type FlightStatus } from "@/lib/flightstatus";
import { money, useCurrency } from "@/lib/money";
import { useTheme } from "@/lib/theme";
import { THEMES, type Theme } from "@/lib/theme-core";

const THEME_LABEL: Record<Theme, string> = { system: "Match device", light: "Light", dark: "Dark" };

type Alert = { id: number; origin: string; destination: string; dep: string; ret: string; passengers: number; cabin: string; drop_pct: number; threshold: number; frequency: string; status: string; current_price: number | null; updated: number | null };
type Search = { o: string; d: string; dep: string; ret: string; pax: number; cabin: string };
type Booking = { id: number; airline: string; route: string; date: string; confirmation: string; totalPrice: number | null };
type Saved = {
  id: number; origin: string; destination: string; dep: string; ret: string; passengers: number; cabin: string;
  price: number; currency: string; created_at: string;
  flight: { airline: string; flightNumber: string; departure: string; arrival: string; durationMin: number; stops: number; bookingProvider: string; bookingUrl: string };
};
const hm = (m: number) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : "");

const api = (url: string, method = "GET", body?: unknown) =>
  fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
const link = (o: string, d: string, dep: string, ret: string, pax: number, cabin: string) =>
  `/results?o=${o}&d=${d}&dep=${dep}${ret ? `&ret=${ret}` : ""}&pax=${pax}&cabin=${cabin}`;

type StatusState = { loading?: boolean; error?: string; none?: boolean; data?: FlightStatus };

const clock = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "n/a");
const LABEL: Record<string, string> = { scheduled: "On schedule", active: "In the air", landed: "Landed", cancelled: "Cancelled", incident: "Incident reported", diverted: "Diverted" };

function StatusPanel({ st }: { st?: StatusState }) {
  if (!st || st.loading) return null;
  if (st.error) return <p role="alert" className="err text-sm">{st.error}</p>;
  if (st.none || !st.data) return <p role="status" className="text-sm">No live data for this flight yet. Status is available on the day of travel.</p>;
  const d = st.data;
  return (
    <div role="status" className="rounded bg-[var(--surface-2)] p-3 text-sm">
      <p className="font-bold">
        {LABEL[d.status] ?? d.status}
        {d.delayMin > 0 ? `, ${d.delayMin} min late` : ""}
      </p>
      <p>
        Departs {d.dep.iata} {clock(d.dep.actual || d.dep.estimated || d.dep.scheduled)}
        {d.dep.terminal ? `, terminal ${d.dep.terminal}` : ""}
        {d.dep.gate ? `, gate ${d.dep.gate}` : ""}
      </p>
      <p>
        Arrives {d.arr.iata} {clock(d.arr.actual || d.arr.estimated || d.arr.scheduled)}
        {d.arr.terminal ? `, terminal ${d.arr.terminal}` : ""}
        {d.arr.gate ? `, gate ${d.arr.gate}` : ""}
        {d.arr.baggage ? `, baggage belt ${d.arr.baggage}` : ""}
      </p>
      <p className="mt-1">Times are in each airport&apos;s local time. Live data from Aviationstack; it can lag by a minute or two.</p>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [searches, setSearches] = useState<Search[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const { cur: currency, shown, error: fxError, setCurrency } = useCurrency(); // shared with results and homepage
  const { pref: themePref, setTheme } = useTheme(); // site-wide; also in the header menu
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [a, s, b, u, sv] = await Promise.all([api("/api/alerts"), api("/api/searches"), api("/api/bookings"), api("/api/account"), api("/api/saved")]);
    if (a.status === 401) return router.push("/login");
    setAlerts(await a.json());
    setSearches(await s.json());
    setBookings(await b.json());
    setSaved(await sv.json());
    const acct = await u.json();
    setEmailAlerts(acct.emailAlerts);
  }, [router]);
  useEffect(() => { load(); }, [load]);

  async function act(url: string, method: string, body?: unknown) {
    const r = await api(url, method, body);
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Something went wrong.");
    else setErr("");
    await load();
  }

  async function addBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const fd = Object.fromEntries(new FormData(f));
    const r = await api("/api/bookings", "POST", fd);
    if (r.ok) f.reset();
    else setErr((await r.json().catch(() => ({}))).error ?? "Could not save.");
    await load();
  }

  // Live status exists only around the travel day, and the free data plan is small, so it is a button, not automatic.
  const [status, setStatus] = useState<Record<number, StatusState>>({});
  const canCheckStatus = (s: Saved) =>
    !!flightCode(s.flight.flightNumber) && Math.abs(Date.parse(s.dep) - Date.parse(new Date().toISOString().slice(0, 10))) <= 864e5;
  async function checkStatus(s: Saved) {
    const code = flightCode(s.flight.flightNumber)!;
    setStatus((m) => ({ ...m, [s.id]: { loading: true } }));
    const r = await api(`/api/status?flight=${encodeURIComponent(code)}&date=${s.dep}`);
    const j = await r.json().catch(() => ({}));
    setStatus((m) => ({
      ...m,
      [s.id]: !r.ok ? { error: j.error ?? "Could not check status." } : j.found ? { data: j.status } : { none: true },
    }));
  }

  async function signOut() {
    await api("/api/auth/logout", "POST", {});
    router.push("/");
    router.refresh();
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and all saved data? This cannot be undone.")) return;
    await api("/api/account", "DELETE");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="grid gap-8">
      {err && <p role="alert" className="err">{err}</p>}

      <section aria-labelledby="alerts" className="card">
        <h2 id="alerts" className="mb-3">Price alerts</h2>
        {alerts.length === 0 ? (
          <p>No watched routes. Open a search and use “Email me when the price drops”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr><th scope="col">Route</th><th scope="col">Current</th><th scope="col">Alert at</th><th scope="col">Frequency</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={link(a.origin, a.destination, a.dep, a.ret, a.passengers, a.cabin)}>{a.origin} to {a.destination}</Link><br /><span className="text-sm">{a.dep}{a.ret ? ` to ${a.ret}` : ""}</span></td>
                    <td>{a.current_price ? money(a.current_price) : "n/a"}{a.updated ? <><br /><span className="text-sm">{new Date(a.updated).toLocaleDateString()}</span></> : null}</td>
                    <td>{money(a.threshold)} ({a.drop_pct}% drop)</td>
                    <td>
                      <label htmlFor={`f${a.id}`} className="sr-only">Frequency</label>
                      <select id={`f${a.id}`} className="input" value={a.frequency} onChange={(e) => act("/api/alerts", "PATCH", { id: a.id, frequency: e.target.value })}>
                        <option value="daily">At most daily</option>
                        <option value="on_change">On change</option>
                      </select>
                    </td>
                    <td>{a.status === "active" ? "Active" : "Paused"}</td>
                    <td className="whitespace-nowrap">
                      <button className="btn btn-plain mr-2" onClick={() => act("/api/alerts", "PATCH", { id: a.id, status: a.status === "active" ? "paused" : "active" })}>{a.status === "active" ? "Pause" : "Resume"}</button>
                      <button className="btn btn-plain" onClick={() => act(`/api/alerts?id=${a.id}`, "DELETE")}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="saved" className="card">
        <h2 id="saved" className="mb-1">Saved flights</h2>
        <p className="mb-3 text-sm">Flights you saved from search results. They sync to every device you sign in on. Booking links can expire, so use Check current price for a fresh one.</p>
        {saved.length === 0 ? (
          <p>Nothing saved yet. Use <strong>Save</strong> on a fare in the search results.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {saved.map((s) => {
              const past = s.dep < new Date().toISOString().slice(0, 10);
              return (
                <li key={s.id} className="card grid gap-1" style={past ? { opacity: 0.65 } : undefined}>
                  <div className="flex items-baseline justify-between gap-2">
                    <strong>{s.origin} to {s.destination}</strong>
                    <span className="text-xl font-bold">{money(s.price, s.currency)}</span>
                  </div>
                  <p className="text-sm">{s.dep}{s.ret ? ` to ${s.ret}` : ""}{past ? " (departed)" : ""}</p>
                  <p className="text-sm">
                    {s.flight.airline} {s.flight.flightNumber}, {s.flight.departure} to {s.flight.arrival}
                    {s.flight.durationMin ? `, ${hm(s.flight.durationMin)}` : ""}, {s.flight.stops === 0 ? "non-stop" : `${s.flight.stops} stop${s.flight.stops > 1 ? "s" : ""}`}
                  </p>
                  <p className="text-sm">Price when saved, {new Date(s.created_at).toLocaleDateString()}.</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {!past && <Link className="btn btn-plain" href={link(s.origin, s.destination, s.dep, s.ret, s.passengers, s.cabin)}>Check current price</Link>}
                    {!past && s.flight.bookingUrl && (
                      <a className="btn" href={s.flight.bookingUrl} target="_blank" rel="noopener noreferrer">View on {s.flight.bookingProvider || "airline site"}</a>
                    )}
                    {canCheckStatus(s) && (
                      <button className="btn btn-plain" onClick={() => checkStatus(s)} disabled={status[s.id]?.loading}>
                        {status[s.id]?.loading ? "Checking…" : "Flight status"}
                      </button>
                    )}
                    <button className="btn btn-plain" onClick={() => act(`/api/saved?id=${s.id}`, "DELETE")}>Remove</button>
                  </div>
                  <StatusPanel st={status[s.id]} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="searches" className="card">
        <h2 id="searches" className="mb-3">Saved searches</h2>
        {searches.length === 0 ? <p>Your recent searches will appear here.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {searches.map((s) => (
              <li key={`${s.o}${s.d}${s.dep}${s.ret}`}>
                <Link href={link(s.o, s.d, s.dep, s.ret, s.pax, s.cabin)}>{s.o} to {s.d}</Link> <span className="text-sm">{s.dep}{s.ret ? ` to ${s.ret}` : ""}. Search again</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="bookings" className="card">
        <h2 id="bookings" className="mb-1">Booking history</h2>
        <p className="mb-3 text-sm">Record trips you booked on partner sites. Details are encrypted at rest and only you can see them.</p>
        <form onSubmit={addBooking} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><label htmlFor="b-conf">Confirmation number</label><input id="b-conf" name="confirmation" required maxLength={40} className="input" /></div>
          <div><label htmlFor="b-air">Airline</label><input id="b-air" name="airline" required maxLength={80} className="input" /></div>
          <div><label htmlFor="b-route">Route</label><input id="b-route" name="route" required maxLength={80} placeholder="JFK to LAX" className="input" /></div>
          <div><label htmlFor="b-date">Travel date</label><input id="b-date" name="date" type="date" className="input" /></div>
          <div><label htmlFor="b-price">Total price</label><input id="b-price" name="totalPrice" type="number" min={0} step="0.01" className="input" /></div>
          <div className="sm:col-span-2 lg:col-span-5"><button className="btn">Save booking</button></div>
        </form>
        {bookings.length === 0 ? <p>No bookings recorded.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead><tr><th scope="col">Confirmation</th><th scope="col">Airline</th><th scope="col">Route</th><th scope="col">Date</th><th scope="col">Price</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>{b.confirmation}</td><td>{b.airline}</td><td>{b.route}</td><td>{b.date || "n/a"}</td>
                    <td>{b.totalPrice != null ? `$${b.totalPrice}` : "n/a"}</td>
                    <td><button className="btn btn-plain" onClick={() => act(`/api/bookings?id=${b.id}`, "DELETE")}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="settings" className="card grid gap-4">
        <h2 id="settings">Account settings</h2>
        <label className="flex items-center gap-2 font-normal">
          <input type="checkbox" checked={emailAlerts} onChange={(e) => act("/api/account", "PATCH", { emailAlerts: e.target.checked })} />
          Send price alert emails
        </label>
        <div>
          <label htmlFor="currency">Display currency</label>
          <select
            id="currency"
            className="input"
            style={{ width: "auto", maxWidth: "100%" }}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{currencyName(c)}</option>
            ))}
          </select>
          <p className="mt-1 text-sm">
            Used for prices across the site (search results, deals, alerts and saved flights), on every device you sign in on.
            {shown !== "USD" && " Converted from USD at European Central Bank rates."}
          </p>
          {fxError && <p role="alert" className="err mt-1 text-sm">{fxError}</p>}
        </div>
        <div>
          <label htmlFor="theme">Appearance</label>
          <select id="theme" className="input" style={{ width: "auto", maxWidth: "100%" }} value={themePref} onChange={(e) => setTheme(e.target.value as Theme)}>
            {THEMES.map((t) => (
              <option key={t} value={t}>{THEME_LABEL[t]}</option>
            ))}
          </select>
          <p className="mt-1 text-sm">
            “Match device” follows your phone or computer&apos;s light and dark setting, switching automatically. Saved to your account, so it applies on every device you sign in on.
          </p>
        </div>
        <p className="flex flex-wrap gap-3">
          <a className="btn btn-plain" href="/api/account?export=1">Download my data</a>
          <button className="btn btn-plain" onClick={signOut}>Sign out</button>
          <button className="btn btn-plain" onClick={deleteAccount}>Delete my account</button>
        </p>
      </section>
    </div>
  );
}
