'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCurrency } from '@/lib/money'
import { uid, updateTrip, useAppDispatch, useAppSelector } from '../store'
import { forgetTrip } from '../account'
import type { Activity, Trip } from '../types'
import Modal from '../components/Modal'
import Ideas from '../components/Ideas'
import { fmt } from './Home'

const TripMap = dynamic(() => import('../components/TripMap'), { ssr: false, loading: () => <div className="h-[400px] animate-pulse rounded-lg bg-neutral-200 dark:bg-[#2b4852]" /> }) // leaflet touches window at import
const TABS = ['Itinerary', 'Packing', 'Expenses', 'Notes', 'Ideas', 'Map'] as const
const form = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = e.currentTarget; return { v: Object.fromEntries(new FormData(f)) as Record<string, string>, reset: () => f.reset() } }
const coord = (s: string, max: number) => { const n = parseFloat(s); return s !== '' && Math.abs(n) <= max ? n : undefined }

function Input({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className="label">{label}<input className="input mt-1 font-normal" {...p} /></label>
}

export default function TripDetail() {
  const { id } = useParams<{ id: string }>()
  const trip = useAppSelector((s) => s.trips.find((t) => t.id === id))
  const dispatch = useAppDispatch()
  const router = useRouter()
  const { cur } = useCurrency() // account/device currency preference: budgets are shown in it, new expenses default to it
  const [tab, setTab] = useState<(typeof TABS)[number]>('Itinerary')
  const [confirm, setConfirm] = useState(false)
  if (!trip) return <p>Trip not found. <Link href="/trips" className="underline">Back to trips</Link></p>
  const patch = (p: Partial<Trip>) => dispatch(updateTrip({ id: trip.id, ...p }))

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${trip!.name.replace(/[^\w-]+/g, '_')}.json` })
    a.click(); URL.revokeObjectURL(url)
  }

  const addActivity = (dayId: string) => (e: React.FormEvent<HTMLFormElement>) => {
    const { v, reset } = form(e)
    const act: Activity = { id: uid(), time: v.time, title: v.title.trim(), location: v.location.trim(), description: v.description.trim(), lat: coord(v.lat, 90), lng: coord(v.lng, 180) }
    patch({ itinerary: trip.itinerary.map((d) => d.id === dayId ? { ...d, activities: [...d.activities, act].sort((a, b) => a.time.localeCompare(b.time)) } : d) })
    reset()
  }
  const delActivity = (dayId: string, aid: string) =>
    patch({ itinerary: trip.itinerary.map((d) => d.id === dayId ? { ...d, activities: d.activities.filter((a) => a.id !== aid) } : d) })

  const cats = [...new Set(trip.packingList.map((p) => p.category))]
  const totals = trip.expenses.reduce<Record<string, number>>((m, x) => ({ ...m, [x.currency]: (m[x.currency] ?? 0) + x.amount }), {})
  const curs = Object.keys(totals)

  return (
    <>
      <span className="flex gap-4"><Link href="/trips" className="underline">← Trips</Link><Link href="/" className="underline">Find flights</Link></span>
      <div className="my-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{trip.name}</h1>
          <p>{trip.destination} · <span className="mono">{trip.startDate} → {trip.endDate}</span></p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button className="btn btn-secondary" onClick={exportJson}>Export JSON</button>
          <button className="btn btn-secondary" onClick={() => print()}>Print / PDF</button>
          <button className="btn btn-secondary" onClick={() => setConfirm(true)}>Delete</button>
        </div>
      </div>

      <div role="tablist" aria-label="Trip sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-neutral-200 print:hidden dark:border-[#2b4852]">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`min-h-11 px-4 font-semibold ${tab === t ? 'border-b-2 border-primary-600 text-primary-600 dark:text-[#52ab98]' : ''}`}>{t}</button>
        ))}
      </div>

      {tab === 'Itinerary' && (
        <section className="space-y-5">
          {trip.itinerary.length === 0 && <p>No days yet.</p>}
          {trip.itinerary.map((d) => (
            <div key={d.id} className="card">
              <h3 className="mono mb-3">{d.date}</h3>
              <ul className="mb-4 space-y-2">
                {d.activities.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3">
                    <div><span className="mono mr-2">{a.time}</span><strong>{a.title}</strong>{a.location && <span> · {a.location}</span>}{a.description && <p className="caption">{a.description}</p>}</div>
                    <button className="min-h-11 min-w-11 print:hidden" aria-label={`Delete ${a.title}`} onClick={() => delActivity(d.id, a.id)}>✕</button>
                  </li>
                ))}
              </ul>
              <form onSubmit={addActivity(d.id)} className="grid grid-cols-2 gap-3 sm:grid-cols-6 print:hidden">
                <Input label="Time" name="time" type="time" required />
                <div className="col-span-1 sm:col-span-2"><Input label="Title" name="title" required maxLength={100} /></div>
                <div className="col-span-2 sm:col-span-3"><Input label="Location" name="location" maxLength={100} /></div>
                <div className="col-span-2 sm:col-span-2"><Input label="Latitude" name="lat" type="number" step="any" min="-90" max="90" inputMode="decimal" /></div>
                <div className="col-span-2 sm:col-span-2"><Input label="Longitude" name="lng" type="number" step="any" min="-180" max="180" inputMode="decimal" /></div>
                <div className="col-span-2 sm:col-span-2"><Input label="Notes" name="description" maxLength={300} /></div>
                <div className="col-span-2 sm:col-span-6"><button className="btn">Add activity</button></div>
              </form>
            </div>
          ))}
        </section>
      )}

      {tab === 'Packing' && (
        <section>
          <form className="card mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4" onSubmit={(e) => {
            const { v, reset } = form(e)
            patch({ packingList: [...trip.packingList, { id: uid(), category: v.category.trim() || 'General', item: v.item.trim(), quantity: Math.max(1, Number(v.qty) || 1), packed: false }] })
            reset()
          }}>
            <Input label="Item" name="item" required maxLength={80} />
            <Input label="Category" name="category" maxLength={40} placeholder="General" />
            <Input label="Qty" name="qty" type="number" min="1" defaultValue="1" inputMode="numeric" />
            <div className="flex items-end"><button className="btn w-full">Add</button></div>
          </form>
          {trip.packingList.length === 0 && <p>Nothing to pack yet.</p>}
          {cats.map((c) => (
            <div key={c} className="mb-4">
              <h3 className="mb-2">{c}</h3>
              <ul>
                {trip.packingList.filter((p) => p.category === c).map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <label className={`flex min-h-11 flex-1 items-center gap-2 ${p.packed ? 'line-through opacity-60' : ''}`}>
                      <input type="checkbox" className="size-4 accent-[#2b6777]" checked={p.packed}
                        onChange={() => patch({ packingList: trip.packingList.map((x) => x.id === p.id ? { ...x, packed: !x.packed } : x) })} />
                      {p.item} <span className="caption">×{p.quantity}</span>
                    </label>
                    <button className="min-h-11 min-w-11" aria-label={`Remove ${p.item}`} onClick={() => patch({ packingList: trip.packingList.filter((x) => x.id !== p.id) })}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {tab === 'Expenses' && (
        <section>
          <div className="card mb-5">
            <p>Budget <strong className="mono">{fmt(trip.budget, cur)}</strong></p>
            {curs.length === 0 && <p>No expenses yet.</p>}
            {curs.map((c) => <p key={c}>Spent <strong className="mono">{fmt(totals[c], c)}</strong></p>)}
            {/* budget is currency-less, so only compare when every expense shares one currency */}
            {curs.length === 1 && (
              <p className={trip.budget - totals[curs[0]] < 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}>
                {fmt(trip.budget - totals[curs[0]], curs[0])} remaining
              </p>
            )}
          </div>
          <form className="card mb-5 grid grid-cols-2 gap-3 sm:grid-cols-6" onSubmit={(e) => {
            const { v, reset } = form(e)
            patch({ expenses: [...trip.expenses, { id: uid(), date: v.date, category: v.category.trim() || 'Other', description: v.description.trim(), amount: Number(v.amount), currency: (v.currency.trim() || 'USD').toUpperCase() }] })
            reset()
          }}>
            <Input label="Date" name="date" type="date" required defaultValue={trip.startDate} />
            <Input label="Category" name="category" maxLength={40} placeholder="Food" />
            <div className="col-span-2"><Input label="Description" name="description" maxLength={100} /></div>
            <Input label="Amount" name="amount" type="number" step="0.01" min="0" required inputMode="decimal" />
            <Input key={cur} label="Currency" name="currency" maxLength={3} minLength={3} pattern="[A-Za-z]{3}" defaultValue={cur} />
            <div className="col-span-2 sm:col-span-6"><button className="btn">Add expense</button></div>
          </form>
          <ul className="space-y-2">
            {trip.expenses.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3">
                <span><span className="mono mr-2">{x.date}</span>{x.category}{x.description && ` · ${x.description}`}</span>
                <span className="flex items-center"><span className="mono text-right">{fmt(x.amount, x.currency)}</span>
                  <button className="min-h-11 min-w-11" aria-label="Delete expense" onClick={() => patch({ expenses: trip.expenses.filter((e) => e.id !== x.id) })}>✕</button></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'Notes' && (
        <section>
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" className="input min-h-64" value={trip.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </section>
      )}

      {tab === 'Ideas' && <Ideas trip={trip} />}

      {tab === 'Map' && (
        <section>
          <p className="caption mb-2">Shows activities that have latitude and longitude. Tiles need a connection.</p>
          <TripMap trip={trip} />
        </section>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Delete ${trip.name}?`}>
        <p className="mb-6">This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button autoFocus className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { forgetTrip(trip.id); router.push('/trips') }}>Delete</button>
        </div>
      </Modal>
    </>
  )
}
