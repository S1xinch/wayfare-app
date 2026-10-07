import { ImageResponse } from "next/og";
import { BRAND, SPLASH } from "@/lib/pwa";

export const dynamic = "force-static";

// Route-W logo (same as the favicon), white on brand blue. Launch images are fully opaque: iOS paints transparency black.
// Only sizes without a hand-made image in public/splash are served from here (see STATIC_SPLASH in lib/pwa.ts).
const Logo = ({ px }: { px: number }) => (
  <svg width={px} height={px} viewBox="0 0 96 96">
    <path d="M14 30 32 68 48 40 64 68 82 30" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="82" cy="30" r="8" fill="#52ab98" />
  </svg>
);

export function generateStaticParams() {
  return SPLASH.map(([w, h]) => ({ kind: "splash", size: `${w}x${h}` }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; size: string }> }) {
  const { kind, size } = await ctx.params;
  const headers = { "Cache-Control": "public, max-age=31536000, immutable" };

  const hit = kind === "splash" && SPLASH.find(([w, h]) => `${w}x${h}` === size);
  if (!hit) return new Response("Not found", { status: 404 });
  const [w, h] = hit;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: BRAND, color: "#fff" }}>
        <Logo px={Math.round(Math.min(w, h) * 0.22)} />
        <div style={{ marginTop: Math.round(w * 0.03), fontSize: Math.round(w * 0.06), fontWeight: 700 }}>Wayfare</div>
      </div>
    ),
    { width: w, height: h, headers },
  );
}
