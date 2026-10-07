'use client'
import { useEffect, useRef, useState } from 'react'
import { copyText, mapUrl, optionsFor, placeOf, platformOf, type App, type Platform } from '@/lib/maps'
import type { Activity } from '../types'

const KEY = 'wf_map_app'

const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const PIN = 'M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'
const COPY = 'M9 9h10v10H9zM5 15V5h10'

/**
 * "Open in map" for an itinerary activity. The choice of app adapts to the device (Apple Maps first on iPhone/iPad, the system's
 * own "open with" chooser on Android so any installed map app works, Google Maps first on desktop) and is shown as a dropdown on
 * wide screens and a bottom sheet on phones. The last app used is remembered and moved to the top.
 */
export default function OpenInMap({ activity, destination }: { activity: Activity; destination: string }) {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<Platform>('desktop')
  const [last, setLast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setPlatform(platformOf(navigator.userAgent, navigator.maxTouchPoints)) // after mount, so server and first render agree
    try { setLast(localStorage.getItem(KEY)) } catch { /* private mode */ }
  }, [])

  useEffect(() => {
    if (!open) return
    box.current?.querySelector<HTMLElement>('.map-item')?.focus()
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const place = placeOf(activity, destination)

  const choose = (app: App) => {
    try { localStorage.setItem(KEY, app) } catch { /* private mode */ }
    setLast(app)
    setOpen(false)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText(place))
      setCopied(true)
      setTimeout(() => { setCopied(false); setOpen(false) }, 1100)
    } catch { setOpen(false) }
  }

  return (
    <div className="map-menu print:hidden" ref={box}>
      <button ref={trigger} type="button" className="map-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        aria-label={`Open ${activity.title} in a map app`}>
        <Icon d={PIN} />
        <span className="hidden sm:inline">Open in map</span>
        <span className="sm:hidden">Map</span>
      </button>
      {open && (
        <>
          <div className="map-scrim" aria-hidden="true" />
          <div className="map-pop" role="menu" aria-label="Open in map">
            <p className="map-title">Open “{place.name}” in…</p>
            {optionsFor(platform, last).map((o) => (
              <a key={o.app} className="map-item" role="menuitem" href={mapUrl(o.app, place)} onClick={() => choose(o.app)}
                {...(o.app === 'geo' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
                <Icon d={PIN} />
                <span>{o.label}</span>
                {o.app === last && <span className="map-last">Last used</span>}
              </a>
            ))}
            <hr />
            <button type="button" className="map-item" role="menuitem" onClick={copy}>
              <Icon d={COPY} />
              <span>{copied ? 'Copied ✓' : 'Copy location'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
