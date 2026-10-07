import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BackButton, PwaInit, TabBar, TopNav } from "@/components/Pwa";
import ThemeMenu from "@/components/ThemeMenu";
import { userId } from "@/lib/auth";
import { BRAND, startupImages } from "@/lib/pwa";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Wayfare: plan trips, find flights", template: "%s | Wayfare" },
  description: "Plan trips offline, then find the cheapest flights: live fares, 30-day price history and price-drop alerts. Free, no affiliate links.",
  applicationName: "Wayfare",
  formatDetection: { telephone: false },
  icons: { apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  // Next only emits the newer mobile-web-app-capable; iOS Safari still keys off the Apple-prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  appleWebApp: {
    capable: true,
    title: "Wayfare", // home-screen label: keep it short
    statusBarStyle: "black-translucent",
    startupImage: startupImages(),
  },
};
// viewport-fit=cover lets the header paint under the status bar; safe-area insets keep content clear of notch and home indicator.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: BRAND };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const uid = await userId();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme: applied before first paint so there is no flash. "system" follows the device; the preference lives in localStorage
            and, for signed-in users, on the account (synced by lib/theme.ts). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem("wf_theme");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches),e=document.documentElement;e.dataset.theme=d?"dark":"light";e.dataset.themePref=p;e.style.colorScheme=d?"dark":"light"}catch(e){}`,
          }}
        />
        {/* Startup splash: once per launch of the installed app. Runs before first paint so the splash covers the page;
            add ?splash=1 to any URL to preview it in a browser. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;if(/[?&]splash=1/.test(location.search)){d.dataset.splashForce="1"}else if(sessionStorage.getItem("wf_splash")){d.dataset.splash="done"}else{sessionStorage.setItem("wf_splash","1")}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div id="splash" className="splash" aria-hidden="true">
          <svg className="splash-plane" viewBox="0 0 96 96" overflow="visible">
            <path className="route" d="M14 30 32 68 48 40 64 68 82 30" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            <circle className="dot" cx="82" cy="30" r="8" fill="#52ab98" />
          </svg>
          <div className="splash-title">Wayfare</div>
        </div>
        <PwaInit />
        <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
        <header className="chrome">
          <div className="wrap flex items-center justify-between gap-4" style={{ paddingTop: 8, paddingBottom: 8, minHeight: 56 }}>
            <div className="flex items-center gap-1">
              <BackButton />
              <Link href="/" className="brand">
                <svg className="brand-mark" viewBox="0 0 96 96" aria-hidden="true">
                  <rect width="96" height="96" rx="24" fill="rgb(255 255 255 / 0.16)" />
                  <g transform="translate(48 48) scale(.78) translate(-48 -47)">
                    <path d="M14 30 32 68 48 40 64 68 82 30" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="82" cy="30" r="8" fill="#52ab98" stroke="#fff" strokeWidth="2.6" />
                  </g>
                </svg>
                <span className="brand-text">Wayfare</span>
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <TopNav signedIn={!!uid} />
              <ThemeMenu />
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="wrap site-footer">
          <nav aria-label="Footer">
            <Link href="/accounts">How accounts work</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms and Conditions</Link>
            <a href="https://github.com/S1xinch/wayfare">Source code</a>
          </nav>
          <p>© {new Date().getFullYear()} Wayfare. Free, no affiliate links.</p>
        </footer>
        <TabBar signedIn={!!uid} />
      </body>
    </html>
  );
}
