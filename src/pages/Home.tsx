import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { addTrip, newTrip, uid, useAppDispatch, useAppSelector } from '../store'
import type { Trip } from '../types'
import Modal from '../components/Modal'

const COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#e9d5ff']
const DATE = /^\d{4}-\d\d-\d\d$/
export const fmt = (n: number, cur = 'USD') => { try { return n.toLocaleString(undefined, { style: 'currency', currency: cur }) } catch { return n.toFixed(2) } }

function Field({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div className="mb-5"><label className="label">{label}{p.required && <span className="text-danger"> *</span>}<input className="input mt-1 font-normal" {...p} /></label></div>
}

export default function Home() {
  const trips = useAppSelector((s) => s.trips)
  const dispatch = useAppDispatch()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const shown = trips.filter((t) => (t.name + t.destination).toLowerCase().includes(q.toLowerCase()))
  const upcoming = trips.filter((t) => t.endDate >= today).length

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const startDate = f.get('start') as string, endDate = f.get('end') as string
    if (endDate < startDate) return setErr('End date must be on or after the start date.')
    dispatch(addTrip(newTrip({ name: (f.get('name') as string).trim(), destination: (f.get('dest') as string).trim(), startDate, endDate, budget: Number(f.get('budget')) || 0 })))
    setErr(''); setOpen(false)
  }

  async function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    try {
      const raw = JSON.parse(await f.text())
      const list: Trip[] = Array.isArray(raw) ? raw : [raw]
      // trust boundary: validate shape, assign fresh ids so imports never overwrite existing trips
      for (const t of list) {
        if (typeof t?.name !== 'string' || !DATE.test(t.startDate) || !DATE.test(t.endDate)) throw new Error('bad')
      }
      for (const t of list) {
        const base = newTrip({ name: t.name, destination: String(t.destination ?? ''), startDate: t.startDate, endDate: t.endDate, budget: Number(t.budget) || 0 })
        dispatch(addTrip({
          ...base, notes: String(t.notes ?? ''),
          itinerary: Array.isArray(t.itinerary) ? t.itinerary.map((d) => ({ ...d, id: uid(), activities: (d.activities ?? []).map((a) => ({ ...a, id: uid() })) })) : base.itinerary,
          packingList: Array.isArray(t.packingList) ? t.packingList.map((p) => ({ ...p, id: uid() })) : [],
          expenses: Array.isArray(t.expenses) ? t.expenses.map((x) => ({ ...x, id: uid() })) : [],
        }))
      }
    } catch { alert('That file is not a valid Wayfare export.') }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Trips</h1>
          <p className="caption">{trips.length} total · {upcoming} upcoming</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => file.current?.click()}>Import</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={importJson} />
          <button className="btn" onClick={() => setOpen(true)}>New trip</button>
        </div>
      </div>
      <input className="input mb-6" type="search" aria-label="Search trips" placeholder="Search trips" value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.length === 0 ? (
        <p>{trips.length ? 'No trips match your search.' : 'No trips yet. Create your first one.'}</p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t, i) => (
            <li key={t.id}>
              <Link to={`/trip/${t.id}`} className="card flex h-[280px] flex-col gap-3 overflow-hidden !p-0 hover:border-neutral-400">
                <div className="flex h-20 items-center gap-3 px-5" style={{ background: COLORS[i % 5] }}>
                  <span aria-hidden className="grid size-9 place-items-center rounded-full bg-white/70 text-lg font-bold text-[#1a202c]">{(t.destination || t.name)[0]?.toUpperCase()}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-5 pb-5">
                  <h3>{t.name}</h3>
                  <p>{t.destination}</p>
                  <p className="caption mono">{t.startDate} → {t.endDate}</p>
                  <p className="caption">Budget {fmt(t.budget)} · {t.itinerary.reduce((n, d) => n + d.activities.length, 0)} activities</p>
                  <span className="mt-auto font-semibold text-primary-600 dark:text-blue-400">View trip</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => { setOpen(false); setErr('') }} title="New trip">
        <form onSubmit={create}>
          <Field label="Name" name="name" required maxLength={80} />
          <Field label="Destination" name="dest" required maxLength={80} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" name="start" type="date" required defaultValue={today} />
            <Field label="End" name="end" type="date" required defaultValue={today} />
          </div>
          <Field label="Budget" name="budget" type="number" min="0" step="0.01" inputMode="decimal" />
          {err && <p role="alert" className="mb-3 text-xs text-danger">{err}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn">Create</button>
          </div>
        </form>
      </Modal>
    </>
  )
}
