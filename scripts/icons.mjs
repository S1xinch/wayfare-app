// Generates opaque PNGs: app icons + iOS splash screens. Run: npm run icons
// Light + dark variants (prefers-color-scheme). Prints the <link rel="apple-touch-startup-image"> tags to paste into index.html.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0 }
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b }
// px(x, y) -> [r, g, b]
function png(w, h, px) {
  const raw = Buffer.alloc(h * (w * 3 + 1))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3)
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const BLUE = [0, 102, 204], WHITE = [255, 255, 255], BG = [249, 250, 251], BG_DARK = [15, 20, 25]
// blue disc with white ring + blue centre, scaled to a box of side s centred at (cx, cy)
const mark = (cx, cy, s, bg) => (x, y) => {
  const d = Math.hypot(x - cx, y - cy) / s
  return d < 0.1 ? BLUE : d < 0.2 ? WHITE : d < 0.3 ? BLUE : bg
}
for (const [n, s] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]])
  writeFileSync(`public/${n}.png`, png(s, s, (x, y) => { const p = mark(s / 2, s * 0.45, s, BLUE)(x, y); return p === BLUE ? BLUE : WHITE }))

// [css width, css height, dpr] for current iPhones, portrait
const devices = [[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2]]
mkdirSync('public/splash', { recursive: true })
const seen = new Set()
for (const [cw, ch, r] of devices) {
  const w = cw * r, h = ch * r
  for (const [scheme, bg, suffix] of [['light', BG, ''], ['dark', BG_DARK, '-dark']]) {
    const f = `splash/${w}x${h}${suffix}.png`
    if (seen.has(f)) continue
    seen.add(f)
    writeFileSync(`public/${f}`, png(w, h, mark(w / 2, h / 2, Math.min(w, h) * 0.5, bg)))
    console.log(`    <link rel="apple-touch-startup-image" href="${f}" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})" />`)
  }
}
