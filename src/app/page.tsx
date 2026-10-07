import Link from "next/link";
import FlightNumberForm from "@/components/FlightNumberForm";
import Price from "@/components/Price";
import { InstallHint } from "@/components/Pwa";
import SearchForm from "@/components/SearchForm";
import { userId } from "@/lib/auth";
import { sql } from "@/lib/db";
import { topDeals } from "@/lib/queries";

export const dynamic = "force-dynamic";

const q = (o: string, d: string, dep: string, ret: string, extra = "") =>
  `/results?o=${o}&d=${d}&dep=${dep}${ret ? `&ret=${ret}` : ""}${extra}`;

export default async function Home() {
  const uid = await userId();
  const [deals, recent] = await Promise.all([
    topDeals(5).catch(() => []),
    uid
      ? sql`
          SELECT DISTINCT ON (origin, destination, departure_date, return_date)
            origin AS o, destination AS d, departure_date::text AS dep, return_date AS ret, passengers AS pax, cabin, created_at
          FROM saved_searches WHERE user_id = ${uid}
          ORDER BY origin, destination, departure_date, return_date, created_at DESC`.catch(() => [])
      : Promise.resolve([]),
  ]);
  const recentCards = [...recent].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 4);

  return (
    <>
      <section className="hero text-white">
        <div className="wrap py-12 sm:py-16">
          <h1 className="mb-2">Compare flight prices</h1>
          <p className="mb-6 max-w-2xl">
            Live fares from Google Flights, price history for every route you search, and an email when a price drops.
            Free. No affiliate links: booking buttons go straight to the booking site.
          </p>
          <div className="grid gap-4 text-ink">
            <SearchForm />
            <FlightNumberForm />
          </div>
        </div>
      </section>

      <div className="wrap grid gap-8">
        <InstallHint />
        {recentCards.length > 0 && (
          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-3">Recent searches</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentCards.map((r) => (
                <li key={`${r.o}${r.d}${r.dep}${r.ret}`} className="card">
                  <p className="font-bold">{r.o} to {r.d}</p>
                  <p className="text-sm">{r.dep}{r.ret ? ` to ${r.ret}` : ""}</p>
                  <Link href={q(r.o, r.d, r.dep, r.ret, `&pax=${r.pax}&cabin=${r.cabin}`)}>Search again</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="deals">
          <h2 id="deals" className="mb-3">Deals from the last 24 hours</h2>
          {deals.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((d) => (
                <li key={`${d.origin}${d.destination}${d.dep}${d.ret}`} className="card">
                  <span className="badge badge-deal">Deal</span>
                  <p className="mt-2 text-lg font-bold">{d.origin} to {d.destination}: <Price usd={d.price} /></p>
                  <p className="text-sm">
                    <Price usd={d.saving} /> below the 30-day average of <Price usd={d.avg30} />. Departs {d.dep}.
                  </p>
                  <Link href={q(d.origin, d.destination, d.dep, d.ret)}>View fares</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No deals detected in the last 24 hours. A route is rated once it has at least three price
              observations in 30 days, so deals appear as routes get searched and watched.
            </p>
          )}
        </section>

        <section aria-labelledby="partners">
          <h2 id="partners" className="mb-3">Also compare on</h2>
          <ul className="flex flex-wrap gap-4">
            <li><a href="https://www.google.com/travel/flights">Google Flights</a></li>
            <li><a href="https://www.skyscanner.com">Skyscanner</a></li>
            <li><a href="https://www.kayak.com/flights">Kayak</a></li>
          </ul>
        </section>
      </div>
    </>
  );
}
