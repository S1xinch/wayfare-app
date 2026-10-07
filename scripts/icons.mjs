// Generates opaque PNGs: app icons + iOS splash screens (light and dark).
// Logo: a "W" drawn as one continuous route, ending at an amber destination dot.
// Run: npm run icons. Prints the <link rel="apple-touch-startup-image"> tags for index.html.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0 }
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b }
function png(w, h, px) {
  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3)
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const BLUE = [0, 102, 204], WHITE = [255, 255, 255], AMBER = [245, 158, 11], BG = [249, 250, 251], BG_DARK = [15, 20, 25], BLUE_DARK = [59, 130, 246]

// Same geometry as the SVG logo (96-unit box): route points, stroke 9, destination dot r8 with an r11 gap ring.
const ROUTE = [[14, 30], [32, 68], [48, 40], [64, 68], [82, 30]]
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t))
// logo(cx, cy, side, routeColor, gapColor, bg): 1px-smoothed edges so small icons don't look jagged.
const logo = (cx, cy, side, route, gap, bg) => {
  const u = side / 96, MIDX = 48, MIDY = 47
  return (x, y) => {
    const X = (x - cx) / u + MIDX, Y = (y - cy) / u + MIDY, px = 1 / u // one output pixel in logo units
    const cov = (d, edge) => Math.max(0, Math.min(1, (edge - d) / px + 0.5))
    const dRoute = Math.min(...ROUTE.slice(1).map((p, i) => segDist(X, Y, ROUTE[i], p)))
    const dDot = Math.hypot(X - 82, Y - 30)
    let c = mix(bg, route, cov(dRoute, 4.5))
    c = mix(c, gap, cov(dDot, 11))
    return mix(c, AMBER, cov(dDot, 8))
  }
}
for (const [n, s] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]])
  writeFileSync(`public/${n}.png`, png(s, s, logo(s / 2, s / 2, s * 0.78, WHITE, BLUE, BLUE)))

// [css width, css height, dpr] for current iPhones, portrait
const devices = [[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2]]
mkdirSync('public/splash', { recursive: true })
const seen = new Set()
for (const [cw, ch, r] of devices) {
  const w = cw * r, h = ch * r
  for (const [scheme, bg, route, suffix] of [['light', BG, BLUE, ''], ['dark', BG_DARK, BLUE_DARK, '-dark']]) {
    const f = `splash/${w}x${h}${suffix}.png`
    if (seen.has(f)) continue
    seen.add(f)
    writeFileSync(`public/${f}`, png(w, h, logo(w / 2, h / 2, Math.min(w, h) * 0.42, route, bg, bg)))
    console.log(`    <link rel="apple-touch-startup-image" href="${f}" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})" />`)
  }
}
