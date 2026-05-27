const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── PNG encoding (RGBA 8-bit) ────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(rowLen * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────

const BG = [13, 13, 26, 255];           // #0D0D1A
const MOON = [206, 194, 250];           // lavanda suave
const STAR = [245, 240, 255];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Composite src over dst (both [r,g,b,a] 0-255)
function over(src, dst) {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return [0, 0, 0, 0];
  const r = (src[0] * sa + dst[0] * da * (1 - sa)) / oa;
  const g = (src[1] * sa + dst[1] * da * (1 - sa)) / oa;
  const b = (src[2] * sa + dst[2] * da * (1 - sa)) / oa;
  return [Math.round(r), Math.round(g), Math.round(b), Math.round(oa * 255)];
}

// ─── Scene: crescent moon with stars, centered ───────────────────────────────

function makeScene({ size, transparent = false, moonScale = 0.32, showStars = true, cutRScale = 0.90, cutOffXScale = 0.28 }) {
  // canvas may be non-square; use shortest side for moon radius
  const w = size.w, h = size.h;
  const minSide = Math.min(w, h);
  const cx = w / 2, cy = h / 2;

  const moonR = minSide * moonScale;
  const cutR = moonR * cutRScale;
  // offset cut circle up-and-right to make a waning crescent facing left
  const cutOffX = moonR * cutOffXScale;
  const cutOffY = -moonR * 0.05;

  // Visual centering: the crescent's bounding box in X runs from
  // (moonCx - moonR) on the left to the circle intersection on the right.
  // Intersection x-offset from moonCx: (moonR² - cutR² + cutOffX²) / (2·cutOffX).
  const uIntersect = (moonR * moonR - cutR * cutR + cutOffX * cutOffX) / (2 * cutOffX);
  const moonCx = cx + (moonR - uIntersect) / 2;
  const moonCy = cy;

  const stars = showStars ? [
    { x: cx - minSide * 0.28, y: cy - minSide * 0.34, r: minSide * 0.006 },
    { x: cx + minSide * 0.30, y: cy - minSide * 0.30, r: minSide * 0.008 },
    { x: cx - minSide * 0.20, y: cy + minSide * 0.30, r: minSide * 0.005 },
    { x: cx + minSide * 0.25, y: cy + minSide * 0.28, r: minSide * 0.006 },
    { x: cx + minSide * 0.36, y: cy - minSide * 0.05, r: minSide * 0.005 },
    { x: cx - minSide * 0.36, y: cy + minSide * 0.08, r: minSide * 0.005 },
    { x: cx + minSide * 0.15, y: cy - minSide * 0.40, r: minSide * 0.004 },
    { x: cx - minSide * 0.10, y: cy + minSide * 0.42, r: minSide * 0.004 },
  ] : [];

  return encodePng(w, h, (x, y) => {
    let pixel = transparent ? [0, 0, 0, 0] : BG.slice();

    // Moon (crescent = moon disk MINUS offset disk)
    const dx = x + 0.5 - moonCx, dy = y + 0.5 - moonCy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dxc = x + 0.5 - (moonCx + cutOffX), dyc = y + 0.5 - (moonCy + cutOffY);
    const distCut = Math.sqrt(dxc * dxc + dyc * dyc);

    // alpha for inside moon (feather 1px)
    const aIn = 1 - smoothstep(moonR - 1, moonR + 0.5, dist);
    // alpha for inside the cut (we want to subtract this)
    const aCut = 1 - smoothstep(cutR - 1, cutR + 0.5, distCut);
    const moonAlpha = Math.max(0, aIn * (1 - aCut));
    if (moonAlpha > 0) {
      pixel = over([MOON[0], MOON[1], MOON[2], Math.round(255 * moonAlpha)], pixel);
    }

    // Stars
    for (const s of stars) {
      const sdx = x + 0.5 - s.x, sdy = y + 0.5 - s.y;
      const sd = Math.sqrt(sdx * sdx + sdy * sdy);
      const sa = 1 - smoothstep(s.r - 0.75, s.r + 0.75, sd);
      if (sa > 0) pixel = over([STAR[0], STAR[1], STAR[2], Math.round(230 * sa)], pixel);
    }

    return pixel;
  });
}

// ─── Generate files ──────────────────────────────────────────────────────────

const outDir = path.resolve(__dirname, '..', 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'icon.png',          w: 1024, h: 1024, transparent: false, moonScale: 0.32, showStars: true },
  { name: 'adaptive-icon.png', w: 1024, h: 1024, transparent: true,  moonScale: 0.26, showStars: false }, // foreground, safe zone
  // Favicon: crescent más agresivo (cut más desplazado y más pequeño) para
  // que sobreviva el downscale a 16/32px en la pestaña del navegador.
  { name: 'favicon.png',       w: 256,  h: 256,  transparent: false, moonScale: 0.42, showStars: false, cutRScale: 0.82, cutOffXScale: 0.50 },
  { name: 'splash.png',        w: 1242, h: 2436, transparent: false, moonScale: 0.18, showStars: true },
];

for (const t of targets) {
  const buf = makeScene({ size: { w: t.w, h: t.h }, transparent: t.transparent, moonScale: t.moonScale, showStars: t.showStars, cutRScale: t.cutRScale, cutOffXScale: t.cutOffXScale });
  fs.writeFileSync(path.join(outDir, t.name), buf);
  console.log(`  ✓ ${t.name}  (${t.w}×${t.h}, ${(buf.length / 1024).toFixed(1)} KB)`);
}
console.log('\nAssets generados en', outDir);
