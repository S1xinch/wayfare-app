// Generates opaque PNG icons (blue square + white pin dot). Run: npm run icons
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0 }
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b }
function png(s) {
  const raw = Buffer.alloc(s * (s * 3 + 1))
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const o = y * (s * 3 + 1) + 1 + x * 3, d = Math.hypot(x - s / 2, y - s * 0.45)
    const [r, g, b] = d < s * 0.2 ? [255, 255, 255] : d < s * 0.3 ? [255, 255, 255] : [0, 102, 204]
    const hole = d < s * 0.1
    raw[o] = hole ? 0 : r; raw[o + 1] = hole ? 102 : g; raw[o + 2] = hole ? 204 : b
  }
  const h = Buffer.alloc(13); h.writeUInt32BE(s, 0); h.writeUInt32BE(s, 4); h[8] = 8; h[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
for (const [n, s] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]]) writeFileSync(`public/${n}.png`, png(s))
