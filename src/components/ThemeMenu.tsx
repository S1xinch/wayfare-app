"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { THEMES, type Theme } from "@/lib/theme-core";

const LABEL: Record<Theme, string> = { system: "Match device", light: "Light", dark: "Dark" };
const ICON: Record<Theme, string> = {
  system: "M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 20h8M12 16v4",
  light: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  dark: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
};

const Icon = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Header menu: Match device / Light / Dark. The choice applies site-wide and is saved to the account when signed in. */
export default function ThemeMenu() {
  const { pref, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="theme-menu" ref={box}>
      <button type="button" className="theme-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Theme: ${LABEL[pref]}`} onClick={() => setOpen((o) => !o)}>
        <Icon d={ICON[pref]} />
      </button>
      {open && (
        <div className="theme-pop" role="menu" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitemradio"
              aria-checked={pref === t}
              onClick={() => {
                setTheme(t);
                setOpen(false);
              }}
            >
              <Icon d={ICON[t]} />
              <span>{LABEL[t]}</span>
              {pref === t && <span aria-hidden="true" className="theme-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
