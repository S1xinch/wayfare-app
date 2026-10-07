"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import { sameFlight } from "@/lib/flightstatus";
import { money, useCurrency } from "@/lib/money";
import AddToTrip from "@/wayfare/AddToTrip";
import Sheet from "./Sheet";
import type { DealInfo, Pt } from "@/lib/deals";
import { hourOf, type Flight } from "@/lib/normalize";

const PriceChart = dynamic(() => import("./PriceChart"), { ssr: false, loading: () => <p>Loading chart…</p> });

type Data = {
  flights: Flight[];
  fetchedAt: number;
  cached: boolean;
  deal: DealInfo;
  history: Pt[];
  links: { name: string; url: string }[];
  params: { o: string; d: string; dep: string; ret: string; pax: number; cabin: string };
};
type SortKey = "price" | "durationMin" | "departure" | "emissionsKg";

// Desktop: filters in a sidebar. Phones: a bottom sheet opened by a Filters button.
const WIDE = "(min-width: 1024px)";
const subscribeWide = (cb: () => void) => {
  const m = matchMedia(WIDE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

// Phones get cards instead of the wide table.
const PHONE = "(max-width: 767px)";
const subscribePhone = (cb: () => void) => {
  const m = matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

function FilterShell({ wide, open, onOpen, onClose, children }: { wide: boolean; open: boolean; onOpen: () => void; onClose: () => void; children: React.ReactNode }) {
  if (wide)
    return (
      <aside aria-label="Filters" className="card grid h-fit gap-3">
        <h2 className="text-lg">Filters</h2>
        {children}
      </aside>
    );
  return (
    <div>
      <button type="button" className="btn btn-plain w-full" onClick={onOpen}>Filters</button>
      <Sheet open={open} onClose={onClose} title="Filters">
        <div className="grid gap-3">{children}</div>
      </Sheet>
    </div>
  );
}

const WINDOWS = ["00:00 – 06:00", "06:00 – 12:00", "12:00 – 18:00", "18:00 – 00:00"];
const dur = (m: number) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : "n/a");
const ago = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} minute${m > 1 ? "s" : ""} ago` : `${Math.round(m / 60)} hour${m >= 90 ? "s" : ""} ago`;
};

export default function Results({ params }: { params: Record<string, string> }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(0);

  const [direct, setDirect] = useState(false);
  const [stops, setStops] = useState([true, true, true]); // non-stop, 1 stop, 2+
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [windows, setWindows] = useState([true, true, true, true]);
  const [maxHours, setMaxHours] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "price", dir: 1 });
  const [open, setOpen] = useState<string | null>(null);
  const [fnq, setFnq] = useState(params.fn ?? ""); // flight-number filter; ?fn= comes from "Find a flight by number"
  const wide = useSyncExternalStore(subscribeWide, () => matchMedia(WIDE).matches, () => true);
  const [sheet, setSheet] = useState(false);
  const phone = useSyncExternalStore(subscribePhone, () => matchMedia(PHONE).matches, () => false);

  // Shared display currency (also used by the dashboard and homepage): preference, applied currency and rate.
  const { cur, shown, rate, date: fxDate, loading: fxLoading, error: fxError, setCurrency } = useCurrency();

  // Saved flights live on the server, so they follow the account to every device.
  const [savedIds, setSavedIds] = useState<Record<string, number>>({}); // flight id -> saved row id
  const [saveMsg, setSaveMsg] = useState("");
  const routeKey = data ? `${data.params.o}-${data.params.d}-${data.params.dep}-${data.params.ret}` : "";
  useEffect(() => {
    if (!data) return;
    const p = data.params;
    fetch(`/api/saved?${new URLSearchParams({ o: p.o, d: p.d, dep: p.dep, ret: p.ret })}`)
      .then(async (r) => {
        if (!r.ok) return setSavedIds({}); // not signed in: nothing saved to show
        const rows: { id: number; flightId: string }[] = await r.json();
        setSavedIds(Object.fromEntries(rows.map((x) => [x.flightId, x.id])));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  async function toggleSave(f: Flight) {
    if (!data) return;
    setSaveMsg("");
    const sid = savedIds[f.id];
    if (sid) {
      const r = await fetch(`/api/saved?id=${sid}`, { method: "DELETE" });
      if (r.ok) setSavedIds((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== f.id)));
      return;
    }
    const r = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data.params, flight: f }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) return setSaveMsg("login");
    if (!r.ok) return setSaveMsg(j.error ?? "Could not save this flight.");
    setSavedIds((s) => ({ ...s, [f.id]: j.id }));
  }

  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(i);
  }, []);

  const qs = new URLSearchParams(params).toString();
  useEffect(() => {
    if (!params.o) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout>;
    const t0 = Date.now();
    setLoading(true);
    setError("");
    setData(null);
    // A new search starts a live lookup (returns {pending, snap}); poll until it finishes.
    async function run(snap?: string) {
      try {
        const r = await fetch(`/api/search?${qs}${snap ? `&snap=${snap}` : ""}`);
        const j = await r.json();
        if (dead) return;
        if (!r.ok) throw new Error(j.error ?? "Search failed.");
        if (j.pending) {
          if (Date.now() - t0 > 300_000) throw new Error("The flight source is taking too long. Try again shortly.");
          timer = setTimeout(() => run(j.snap), 3000);
          return;
        }
        setData(j);
        setMaxPrice(Math.ceil(Math.max(0, ...j.flights.map((f: Flight) => f.price))));
        setSkip(new Set());
        setLoading(false);
      } catch (e) {
        if (dead) return;
        setError(e instanceof Error ? e.message : "Search failed.");
        setLoading(false);
      }
    }
    run();
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [qs]); // eslint-disable-line react-hooks/exhaustive-deps

  const airlines = useMemo(() => [...new Set(data?.flights.map((f) => f.airline))].sort(), [data]);
  const ceiling = useMemo(() => Math.ceil(Math.max(0, ...(data?.flights.map((f) => f.price) ?? []))), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const hrs = Number(maxHours);
    return data.flights
      .filter((f) => (direct ? f.stops === 0 : stops[Math.min(f.stops, 2)]))
      .filter((f) => !skip.has(f.airline))
      .filter((f) => !fnq.trim() || f.legs.some((l) => l.segments.some((s) => sameFlight(s.flightNumber, fnq))))
      .filter((f) => {
        const h = hourOf(f.departure);
        return h < 0 || windows[Math.floor(h / 6)];
      })
      .filter((f) => !hrs || !f.durationMin || f.durationMin <= hrs * 60)
      .filter((f) => f.price * rate >= (Number(minPrice) || 0) && f.price <= maxPrice)
      .sort((a, b) => {
        const x = sort.key === "departure" ? a.departure.localeCompare(b.departure) : a[sort.key] - b[sort.key];
        return x * sort.dir || a.price - b.price;
      });
  }, [data, direct, stops, skip, windows, maxHours, minPrice, maxPrice, sort, rate, fnq]);

  if (!params.o) return <p>Enter a search above to see fares.</p>;
  if (loading) return <p role="status">Searching live fares. This usually takes a few seconds, or a couple of minutes if the backup source is needed; repeat searches are instant for an hour.</p>;
  if (error) return <p role="alert" className="err">{error}</p>;
  if (!data) return null;
  if (!data.flights.length) return <p role="status">No fares were returned for this search. Try other dates or airports.</p>;

  const { deal, params: p } = data;
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (-s.dir) as 1 | -1 } : { key, dir: 1 }));
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");
  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button type="button" onClick={() => toggleSort(k)} className="font-bold underline">
      {children}
      {sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </button>
  );

  return (
    <div className="grid gap-6">
      <section className="card grid gap-3" aria-labelledby="summary">
        <h2 id="summary">{p.o} to {p.d}, {p.dep}{p.ret ? ` – ${p.ret}` : ""}</h2>
        <p>
          Updated {now ? ago(now - data.fetchedAt) : "…"}
          {data.cached ? " (cached results are refreshed hourly)" : ""}. Lowest fare {money(Math.min(...data.flights.map((f) => f.price)), data.flights[0].currency)}.
          {data.flights[0].typicalHigh > 0 && (
            <> Google&apos;s typical price range for this trip: {money(data.flights[0].typicalLow, data.flights[0].currency)} to {money(data.flights[0].typicalHigh, data.flights[0].currency)}.</>
          )}
        </p>
        <p className="flex flex-wrap items-center gap-3">
          {deal.isDeal && <span className="badge badge-deal">Hot Deal</span>}
          {deal.isHigh && <span className="badge badge-high">High Price</span>}
          {deal.samples >= 3 && deal.avg30 !== null ? (
            <span>
              30-day average {money(deal.avg30)}
              {deal.avg7 !== null && <>, 7-day average {money(deal.avg7)}</>}.{" "}
              {deal.dealCount} of {deal.samples} observations in 30 days were deals.
              {deal.lastChange && <> Price last changed {new Date(deal.lastChange).toLocaleString()}.</>}
            </span>
          ) : (
            <span>Not enough price history yet to rate this fare ({deal.samples} observation{deal.samples === 1 ? "" : "s"}; 3 needed).</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="cur" className="mb-0">Currency</label>
          <select
            id="cur"
            className="input"
            style={{ width: "auto" }}
            value={cur}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{currencyName(c)}</option>
            ))}
          </select>
          {fxLoading && <span role="status" className="text-sm">Loading rates…</span>}
          {shown !== "USD" && <span className="text-sm">Converted from USD at the European Central Bank rate of {fxDate}. Booking sites charge in their own currency.</span>}
          {fxError && <span role="alert" className="err text-sm">{fxError}</span>}
        </div>
        <p className="flex flex-wrap gap-4">
          <span>Compare on:</span>
          {data.links.map((l) => (
            <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a>
          ))}
        </p>
      </section>

      <section className="card" aria-labelledby="hist">
        <h2 id="hist" className="mb-2">30-day price history</h2>
        {data.history.length >= 2 ? <PriceChart data={data.history} /> : <p>History builds each time this route is searched or watched.</p>}
      </section>

      <Watch params={p} />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <FilterShell wide={wide} open={sheet} onOpen={() => setSheet(true)} onClose={() => setSheet(false)}>
          <details open>
            <summary className="cursor-pointer font-bold">Flight number</summary>
            <label htmlFor="fnq" className="mt-2">Show only this flight</label>
            <input id="fnq" className="input uppercase" placeholder="BA 117" autoComplete="off" spellCheck={false} value={fnq} onChange={(e) => setFnq(e.target.value)} />
          </details>
          <details open>
            <summary className="cursor-pointer font-bold">Stops</summary>
            <label className="mt-2 flex items-center gap-2 font-normal">
              <input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} /> Direct flights only
            </label>
            {["Non-stop", "1 stop", "2+ stops"].map((t, i) => (
              <label key={t} className="flex items-center gap-2 font-normal">
                <input type="checkbox" disabled={direct} checked={direct ? i === 0 : stops[i]} onChange={() => setStops(stops.map((s, j) => (j === i ? !s : s)))} /> {t}
              </label>
            ))}
          </details>
          <details open>
            <summary className="cursor-pointer font-bold">Departure time</summary>
            {WINDOWS.map((t, i) => (
              <label key={t} className="flex items-center gap-2 font-normal">
                <input type="checkbox" checked={windows[i]} onChange={() => setWindows(windows.map((s, j) => (j === i ? !s : s)))} /> {t}
              </label>
            ))}
          </details>
          <details open>
            <summary className="cursor-pointer font-bold">Airlines</summary>
            {airlines.map((a) => (
              <label key={a} className="flex items-center gap-2 font-normal">
                <input type="checkbox" checked={!skip.has(a)} onChange={() => setSkip((s) => { const n = new Set(s); n.has(a) ? n.delete(a) : n.add(a); return n; })} /> {a}
              </label>
            ))}
          </details>
          <details open>
            <summary className="cursor-pointer font-bold">Duration and price</summary>
            <label htmlFor="mh" className="mt-2">Max duration (hours)</label>
            <input id="mh" type="number" min={1} className="input" value={maxHours} onChange={(e) => setMaxHours(e.target.value)} />
            <label htmlFor="mn" className="mt-2">Min price ({shown})</label>
            <input id="mn" type="number" min={0} className="input" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            <label htmlFor="mx" className="mt-2">Max price: {money(maxPrice)}</label>
            <input id="mx" type="range" min={0} max={ceiling} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full" />
          </details>
        </FilterShell>

        <section aria-labelledby="fares" className="min-w-0">
          <h2 id="fares" className="mb-2">{rows.length} of {data.flights.length} fares</h2>
          {fnq.trim() && (
            <p className="mb-2" role="status">
              Showing flight <strong>{fnq.trim().toUpperCase()}</strong> on {data.params.dep} only.{" "}
              <button type="button" className="underline" style={{ color: "var(--color-brand)" }} onClick={() => setFnq("")}>Show all fares</button>
              {rows.length === 0 && " No fares matched. The flight may not operate on this date, or its fares are not published yet."}
            </p>
          )}
          {saveMsg && (
            <p role="alert" className="err mb-2">
              {saveMsg === "login" ? <>Sign in to save flights; they sync to all your devices. <Link href="/login">Sign in</Link> or <Link href="/register">create an account</Link>.</> : saveMsg}
            </p>
          )}
          {phone ? (
            <>
              <label htmlFor="sort" className="mb-1">Sort by</label>
              <select
                id="sort"
                className="input mb-3"
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(":");
                  setSort({ key: key as SortKey, dir: Number(dir) as 1 | -1 });
                }}
              >
                <option value="price:1">Price, lowest first</option>
                <option value="price:-1">Price, highest first</option>
                <option value="durationMin:1">Shortest duration</option>
                <option value="departure:1">Departure time</option>
                <option value="emissionsKg:1">Lowest CO₂</option>
              </select>
              <ul className="grid gap-3">
                {rows.map((f) => (
                  <FareCard key={f.id} f={f} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} book={data.links[0]} saved={!!savedIds[f.id]} onSave={() => toggleSave(f)} />
                ))}
              </ul>
            </>
          ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort("departure")}><SortBtn k="departure">Departs</SortBtn></th>
                  <th scope="col">Arrives</th>
                  <th scope="col" aria-sort={ariaSort("durationMin")}><SortBtn k="durationMin">Duration</SortBtn></th>
                  <th scope="col">Stops</th>
                  <th scope="col">Airline</th>
                  <th scope="col" aria-sort={ariaSort("emissionsKg")}><SortBtn k="emissionsKg">CO₂</SortBtn></th>
                  <th scope="col" aria-sort={ariaSort("price")}><SortBtn k="price">Price</SortBtn></th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <FareRow key={f.id} f={f} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} book={data.links[0]} saved={!!savedIds[f.id]} onSave={() => toggleSave(f)} />
                ))}
              </tbody>
            </table>
          </div>
          )}
          <p className="mt-2 text-sm">
            Prices include required taxes and fees for the passengers you searched. Optional charges such as bags and seat
            selection are not itemised by the data source; check them on the booking site before you pay.
          </p>
        </section>
      </div>
    </div>
  );
}

function SaveButton({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <button type="button" className="btn btn-plain" aria-pressed={saved} onClick={onSave}>
      {saved ? "Saved ✓" : "Save"}
    </button>
  );
}

function FareRow({ f, open, onToggle, book, saved, onSave }: { f: Flight; open: boolean; onToggle: () => void; book: { name: string; url: string }; saved: boolean; onSave: () => void }) {
  return (
    <>
      <tr>
        <td>{f.departure || "n/a"}</td>
        <td>{f.arrival || "n/a"}</td>
        <td>{dur(f.durationMin)}</td>
        <td>{f.stops === 0 ? "Non-stop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}</td>
        <td>{f.airline}</td>
        <td>{f.emissionsKg ? `${f.emissionsKg} kg` : "n/a"}</td>
        <td className="font-bold">{money(f.price, f.currency)}</td>
        <td className="whitespace-nowrap">
          <span className="mr-2"><SaveButton saved={saved} onSave={onSave} /></span>
          <span className="mr-2"><AddToTrip flight={f} /></span>
          <button type="button" className="btn btn-plain mr-2" aria-expanded={open} onClick={onToggle}>{open ? "Hide" : "Details"}</button>
          <a className="btn" href={f.bookingUrl || book.url} target="_blank" rel="noopener noreferrer">
            View on {f.bookingUrl ? f.bookingProvider || "airline site" : book.name}
          </a>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-[var(--surface-2)]"><FareDetails f={f} /></td>
        </tr>
      )}
    </>
  );
}

function FareDetails({ f }: { f: Flight }) {
  return (
    <>
      {f.legs.map((l, i) => (
        <div key={i} className="mb-3">
          <h3 className="mb-1">{l.title || (i === 0 ? "Outbound" : "Return")}{l.date ? `, ${l.date}` : ""}</h3>
          <p className="text-sm">{l.from} to {l.to}, {l.stops === 0 ? "non-stop" : `${l.stops} stop${l.stops > 1 ? "s" : ""}`}, {dur(l.durationMin)}{l.emissionsKg ? `, ${l.emissionsKg} kg CO₂e` : ""}</p>
          <ul className="mt-1 grid gap-1">
            {l.segments.map((s, j) => (
              <li key={j}>
                <strong>{s.flightNumber}</strong> {s.airline}{s.aircraft ? `, ${s.aircraft}` : ""}: {s.from} {s.depart} to {s.to} {s.arrive}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {f.amenities.length > 0 && <p className="text-sm">{f.amenities.filter((a) => !/^Emissions|^Contrail/.test(a)).join(" · ")}</p>}
      <p className="mt-2 text-sm">Fare breakdown, bag fees and seat prices are shown on the booking site.</p>
    </>
  );
}

/** Phone layout: one card per fare instead of a wide table. */
function FareCard({ f, open, onToggle, book, saved, onSave }: { f: Flight; open: boolean; onToggle: () => void; book: { name: string; url: string }; saved: boolean; onSave: () => void }) {
  return (
    <li className="card grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold">{money(f.price, f.currency)}</span>
        <span className="text-right font-bold">{f.airline}</span>
      </div>
      <p>
        {f.departure || "n/a"} to {f.arrival || "n/a"}, {dur(f.durationMin)}, {f.stops === 0 ? "non-stop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}
        {f.emissionsKg ? `, ${f.emissionsKg} kg CO₂` : ""}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <SaveButton saved={saved} onSave={onSave} />
        <AddToTrip flight={f} />
        <button type="button" className="btn btn-plain col-span-2" aria-expanded={open} onClick={onToggle}>{open ? "Hide details" : "Details"}</button>
        <a className="btn col-span-2 text-center" href={f.bookingUrl || book.url} target="_blank" rel="noopener noreferrer">
          View on {f.bookingUrl ? f.bookingProvider || "airline site" : book.name}
        </a>
      </div>
      {open && <div className="rounded bg-[var(--surface-2)] p-3"><FareDetails f={f} /></div>}
    </li>
  );
}

function Watch({ params: p }: { params: Data["params"] }) {
  const [pct, setPct] = useState("10");
  const [freq, setFreq] = useState("daily");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setState(null);
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, pax: p.pax, dropPct: Number(pct), frequency: freq }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setState(res.ok ? { ok: true, text: "Watching this route. Manage it in your dashboard." } : { ok: false, text: j.error ?? "Could not save." });
    if (res.status === 401) setState({ ok: false, text: "login" });
  }

  return (
    <form onSubmit={save} className="card grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" aria-labelledby="watch">
      <h2 id="watch" className="sm:col-span-3">Email me when the price drops</h2>
      <div>
        <label htmlFor="pct">Drop by (%)</label>
        <input id="pct" type="number" min={1} max={90} className="input" value={pct} onChange={(e) => setPct(e.target.value)} />
      </div>
      <div>
        <label htmlFor="freq">Alert frequency</label>
        <select id="freq" className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
          <option value="daily">At most daily</option>
          <option value="on_change">Whenever the price changes</option>
        </select>
      </div>
      <button className="btn" disabled={busy}>Watch route</button>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={`sm:col-span-3 ${state.ok ? "" : "err"}`}>
          {state.text === "login" ? <>Sign in to watch routes. <Link href="/login">Sign in</Link> or <Link href="/register">create an account</Link>.</> : state.text}
        </p>
      )}
    </form>
  );
}
