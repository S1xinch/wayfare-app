// Regenerates the brand assets from one route-W logo: favicon (src/app/icon.svg), app icons and iOS launch images.
// Run: node scripts/brand-assets.mjs   (uses sharp, which ships with Next)
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const BRAND = "#2b6777", DEEP = "#1f4a57", LIGHT = "#37798b", ACCENT = "#52ab98", PAPER = "#f2f2f2", NIGHT = "#10222a", PALE = "#c8d8e4";

// 96-unit logo box: a W drawn as a flight route, ending in a destination dot. A circle is masked out of the stroke
// around the dot so the two never touch. `ring` outlines the dot (white on the teal icon, none on plain backgrounds).
const logo = ({ cx, cy, k, stroke, ring, shadow }) => `
  <g transform="translate(${cx} ${cy}) scale(${k}) translate(-48 -47)">
    <mask id="gap"><rect x="-10" y="-10" width="116" height="116" fill="#fff"/><circle cx="82" cy="30" r="12.5" fill="#000"/></mask>
    <path d="M14 30 32 68 48 40 64 68 82 30" fill="none" stroke="${stroke}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" mask="url(#gap)"${shadow ? ' filter="url(#soft)"' : ""}/>
    <circle cx="82" cy="30" r="8" fill="${ACCENT}"${ring ? ` stroke="${ring}" stroke-width="2.6"` : ""}/>
  </g>`;

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LIGHT}"/><stop offset=".55" stop-color="${BRAND}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient>
  <radialGradient id="glow" cx=".82" cy=".14" r=".7"><stop offset="0" stop-color="${PALE}" stop-opacity=".28"/><stop offset="1" stop-color="${PALE}" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.6" flood-color="#0b2530" flood-opacity=".35"/></filter>
</defs>`;
const svg = (w, h, inner, size = ` width="${w}" height="${h}"`) => `<svg xmlns="http://www.w3.org/2000/svg"${size} viewBox="0 0 ${w} ${h}">${defs}${inner}</svg>`;
const tile = (w, h, r = 0) => `<rect width="${w}" height="${h}" rx="${r}" fill="url(#bg)"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#glow)"/>`;
const png = (w, h, inner, out) => sharp(Buffer.from(svg(w, h, inner))).png().toFile(out);
const teal = (px) => tile(px, px) + logo({ cx: px / 2, cy: px / 2, k: (px * 0.62) / 77, stroke: "#fff", ring: "#fff", shadow: true });

// Favicon: rounded tile, scales freely (no fixed size).
writeFileSync("src/app/icon.svg", svg(96, 96, tile(96, 96, 21) + logo({ cx: 48, cy: 48, k: 0.78, stroke: "#fff", ring: "#fff", shadow: true }), "") + "\n");

// App icons are fully opaque (iOS paints transparency black). 512 doubles as the maskable icon: the W stays inside the safe zone.
for (const [px, file] of [[192, "icon-192.png"], [512, "icon-512.png"], [180, "apple-touch-icon.png"]]) await png(px, px, teal(px), `public/${file}`);

const SIZES = ["1320x2868", "1206x2622", "1290x2796", "1179x2556", "1284x2778", "1170x2532", "1125x2436", "1242x2688", "828x1792", "750x1334"];
for (const s of SIZES) {
  const [w, h] = s.split("x").map(Number), k = (w * 0.35) / 77;
  await png(w, h, `<rect width="${w}" height="${h}" fill="${PAPER}"/>` + logo({ cx: w / 2, cy: h / 2, k, stroke: BRAND }), `public/splash/${s}.png`);
  await png(w, h, `<rect width="${w}" height="${h}" fill="${NIGHT}"/>` + logo({ cx: w / 2, cy: h / 2, k, stroke: PALE }), `public/splash/${s}-dark.png`);
}
console.log("brand assets written");
