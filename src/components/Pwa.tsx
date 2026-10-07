"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Marks the installed app, locks pinch-zoom there (not in the browser, where zoom is an accessibility need), registers the service worker. */
export function PwaInit() {
  useEffect(() => {
    const s = isStandalone();
    document.documentElement.dataset.standalone = String(s);
    if (s) {
      document
        .querySelector('meta[name="viewport"]')
        ?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Startup splash: once the app is ready (and the splash has been visible long enough not to flicker), the plane flies off.
    const root = document.documentElement;
    const splash = document.getElementById("splash");
    if (splash && root.dataset.splash !== "done") {
      const finish = () => {
        root.dataset.splash = "done";
      };
      splash.addEventListener("animationend", (e) => e.target === splash && finish());
      const start = setTimeout(() => {
        splash.classList.add("splash--go");
        setTimeout(finish, 3000); // safety net in case the animation event never fires
      }, Math.max(0, 900 - performance.now()));
      return () => clearTimeout(start);
    }
  }, []);
  return null;
}

/** Back button for the installed app (there is no browser chrome to go back with). */
export function BackButton() {
  const path = usePathname();
  const router = useRouter();
  if (path === "/") return null;
  return (
    <button type="button" className="back" aria-label="Back" onClick={() => (history.length > 1 ? router.back() : router.push("/"))}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 5-7 7 7 7" />
      </svg>
    </button>
  );
}

const icon = (d: string) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/** Header navigation. The current page gets aria-current, which the stylesheet turns into the highlighted pill. */
export function TopNav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const items: { href: string; label: string; on: boolean; secondary?: boolean }[] = [
    { href: "/", label: "Flights", on: path === "/" || path.startsWith("/results") },
    { href: "/trips", label: "Trips", on: path.startsWith("/trips") },
    ...(signedIn
      ? [{ href: "/dashboard", label: "Dashboard", on: path.startsWith("/dashboard") }]
      : [
          { href: "/login", label: "Sign in", on: path === "/login" },
          { href: "/register", label: "Create account", on: path === "/register", secondary: true },
        ]),
  ];
  return (
    <nav aria-label="Main" className="topnav flex">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.on ? "page" : undefined} className={i.secondary ? "nav-secondary" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tab bar, shown by CSS only in the installed phone app. */
export function TabBar({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: "/", label: "Flights", on: path === "/" || path === "/results", d: "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" },
    { href: "/trips", label: "Trips", on: path.startsWith("/trips"), d: "M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3zM9 4v13M15 7v13" },
    {
      href: signedIn ? "/dashboard" : "/login",
      label: signedIn ? "Account" : "Sign in",
      on: ["/dashboard", "/login", "/register"].includes(path),
      d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    },
  ];
  return (
    <nav aria-label="App" className="tabbar">
      {tabs.map((t) => (
        <Link key={t.label} href={t.href} className="tab" aria-current={t.on ? "page" : undefined}>
          {icon(t.d)}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** iOS has no install prompt: show manual steps in Safari, until installed or dismissed. */
export function InstallHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("ff_install_dismissed") === "1";
    } catch {}
    setShow(ios && !isStandalone() && !dismissed);
  }, []);
  if (!show) return null;
  return (
    <section className="card install-hint" aria-label="Install the app">
      <p>
        <strong>Install Wayfare.</strong> Tap{" "}
        <svg style={{ display: "inline", verticalAlign: "-3px" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
          <path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8" />
        </svg>{" "}
        then <strong>Add to Home Screen</strong> for the full-screen app.
      </p>
      <button
        type="button"
        className="btn btn-plain"
        onClick={() => {
          try {
            localStorage.setItem("ff_install_dismissed", "1");
          } catch {}
          setShow(false);
        }}
      >
        Dismiss
      </button>
    </section>
  );
}
