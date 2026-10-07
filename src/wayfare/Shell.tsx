'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { CURRENCIES, currencyName } from '@/lib/currencies'
import { useCurrency } from '@/lib/money'
import { initAccount } from './account'
import { loadTrips } from './boot'
import { store } from './store'
import 'leaflet/dist/leaflet.css'
import './wayfare.css'

const toggleDark = () => {
  const dark = document.querySelector('.wf')!.classList.toggle('dark')
  try { localStorage.dark = dark ? '1' : '0' } catch { /* private mode */ }
}

/** Client-only host for the trips area: Redux store, offline data, sync. Renders nothing until local trips are loaded so SSR and first paint agree. */
export default function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(false)
  const { cur, setCurrency } = useCurrency()
  useEffect(() => {
    try { setDark(localStorage.dark === '1') } catch { /* private mode */ } // opt-in: only this area themes dark, so don't follow the OS
    loadTrips().then(() => { setReady(true); initAccount() })
  }, [])
  return (
    <Provider store={store}>
      <div className={`wf${dark ? ' dark' : ''}`}>
        <div className="mb-2 flex flex-wrap items-center justify-end gap-3">
          <label className="label m-0 flex items-center gap-2">Currency
            <select className="input" style={{ width: "auto" }} value={cur} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{currencyName(c)}</option>)}
            </select>
          </label>
          <button className="btn btn-secondary" onClick={() => { toggleDark(); setDark((d) => !d) }} aria-label="Toggle dark mode">Theme</button>
        </div>
        {ready ? children : <p role="status">Loading your trips…</p>}
      </div>
    </Provider>
  )
}
