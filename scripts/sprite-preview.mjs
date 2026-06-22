#!/usr/bin/env node
// Dev-only sprite previewer. Crops one cell — or a rectangular block of cells — out of a sprite
// sheet, scales it up with nearest-neighbor (so pixel art stays crisp), and writes a PNG you can
// open to eyeball which sprite lives at a given col/row. Pure Node: only built-in `fs`/`zlib`, no
// image dependency, so it runs anywhere Node does.
//
// Usage:
//   node scripts/sprite-preview.mjs <sheet.png> <col> <row>                  # one cell
//   node scripts/sprite-preview.mjs <sheet.png> <col0> <row0> <col1> <row1>  # block, TL..BR
//
// Options:
//   --size=N    source cell size in px (default: parsed from a "-N.png" filename suffix, else 32)
//   --scale=N   integer upscale factor (default 8)
//   --grid      draw 1px separators between cells (handy when scanning a block)
//   --out=FILE  output path (default: sprite-previews/<sheet>-c<col>-r<row>[..c<col1>-r<row1>].png)
//
// Previews land in sprite-previews/ (gitignored), the way the generation visualizer writes its
// report. Coordinates are 0-indexed, matching the sprite catalog (data/sprites/sprite-catalog.js).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { basename, dirname, join } from 'node:path';

const PNG_SIG = '89504e470d0a1a0a';
const OUT_DIR = 'sprite-previews';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

// Decode an 8-bit, non-interlaced PNG (color types 0/2/4/6) to flat RGBA. Throws on anything else —
// enough for the sheets we ship without pulling in a PNG library.
function decodePng(buf) {
  if (buf.subarray(0, 8).toString('hex') !== PNG_SIG) throw new Error('Not a PNG file');
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len; // length(4) + type(4) + data + crc(4)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8) throw new Error(`Unsupported bit depth ${bitDepth} (need 8)`);
  if (interlace !== 0) throw new Error('Interlaced PNGs are not supported');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`Unsupported color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const cur = Buffer.alloc(stride);
  const prev = Buffer.alloc(stride);
  const rgba = Buffer.alloc(width * height * 4);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const ft = raw[p++];
    for (let x = 0; x < stride; x++) {
      const v = raw[p++];
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let out;
      switch (ft) {
        case 0: out = v; break;
        case 1: out = v + a; break;
        case 2: out = v + b; break;
        case 3: out = v + ((a + b) >> 1); break;
        case 4: out = v + paeth(a, b, c); break;
        default: throw new Error(`Unknown scanline filter ${ft}`);
      }
      cur[x] = out & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const si = x * channels, di = (y * width + x) * 4;
      if (channels >= 3) { rgba[di] = cur[si]; rgba[di + 1] = cur[si + 1]; rgba[di + 2] = cur[si + 2]; }
      else { rgba[di] = rgba[di + 1] = rgba[di + 2] = cur[si]; } // grayscale → replicate
      rgba[di + 3] = channels === 4 ? cur[si + 3] : channels === 2 ? cur[si + 1] : 255;
    }
    cur.copy(prev);
  }
  return { width, height, rgba };
}

// Encode flat RGBA to a PNG (single IDAT, filter 0 on every scanline).
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };
  return Buffer.concat([
    Buffer.from(PNG_SIG, 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (const a of argv) {
    if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); flags[k] = v === undefined ? true : v; }
    else pos.push(a);
  }
  return { flags, pos };
}

function main() {
  const { flags, pos } = parseArgs(process.argv.slice(2));
  if (pos.length !== 3 && pos.length !== 5) {
    console.error('Usage: node scripts/sprite-preview.mjs <sheet.png> <col> <row> [<col1> <row1>] [--size=N] [--scale=N] [--grid] [--out=FILE]');
    process.exit(1);
  }
  const sheetPath = pos[0];
  let [c0, r0, c1, r1] = pos.length === 5
    ? pos.slice(1).map(Number)
    : [Number(pos[1]), Number(pos[2]), Number(pos[1]), Number(pos[2])];
  if ([c0, r0, c1, r1].some((n) => !Number.isInteger(n) || n < 0)) {
    console.error('col/row must be non-negative integers');
    process.exit(1);
  }
  if (c1 < c0) [c0, c1] = [c1, c0];
  if (r1 < r0) [r0, r1] = [r1, r0];

  const suffix = basename(sheetPath).match(/-(\d+)\.png$/i);
  const size = flags.size ? Number(flags.size) : suffix ? Number(suffix[1]) : 32;
  const scale = flags.scale ? Number(flags.scale) : 8;
  const grid = Boolean(flags.grid);

  const sheet = decodePng(readFileSync(sheetPath));
  const cols = sheet.width / size, rows = sheet.height / size;
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
    console.error(`Sheet ${sheet.width}×${sheet.height} is not a whole number of ${size}px cells`);
    process.exit(1);
  }
  if (c1 >= cols || r1 >= rows) {
    console.error(`Region exceeds the ${cols}×${rows} grid (cols 0..${cols - 1}, rows 0..${rows - 1})`);
    process.exit(1);
  }

  const cellCols = c1 - c0 + 1, cellRows = r1 - r0 + 1;
  const outW = cellCols * size * scale, outH = cellRows * size * scale;
  const out = Buffer.alloc(outW * outH * 4);
  // Nearest-neighbor: each output pixel samples the source cell-block pixel under it.
  for (let oy = 0; oy < outH; oy++) {
    const sy = r0 * size + Math.floor(oy / scale);
    for (let ox = 0; ox < outW; ox++) {
      const sx = c0 * size + Math.floor(ox / scale);
      const si = (sy * sheet.width + sx) * 4, di = (oy * outW + ox) * 4;
      out[di] = sheet.rgba[si]; out[di + 1] = sheet.rgba[si + 1];
      out[di + 2] = sheet.rgba[si + 2]; out[di + 3] = sheet.rgba[si + 3];
    }
  }
  if (grid) {
    const line = (di) => { out[di] = 255; out[di + 1] = 0; out[di + 2] = 255; out[di + 3] = 255; };
    for (let c = 1; c < cellCols; c++) { const ox = c * size * scale; for (let oy = 0; oy < outH; oy++) line((oy * outW + ox) * 4); }
    for (let r = 1; r < cellRows; r++) { const oy = r * size * scale; for (let ox = 0; ox < outW; ox++) line((oy * outW + ox) * 4); }
  }

  const single = c0 === c1 && r0 === r1;
  const sheetBase = basename(sheetPath).replace(/\.png$/i, '');
  const region = single ? `c${c0}-r${r0}` : `c${c0}-r${r0}..c${c1}-r${r1}`;
  const outPath = flags.out ?? join(OUT_DIR, `${sheetBase}-${region}.png`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, encodePng(outW, outH, out));
  console.log(`${basename(sheetPath)} [${size}px] cols ${c0}..${c1}, rows ${r0}..${r1} → ${outPath} (${outW}×${outH}, ${scale}×${grid ? ', grid' : ''})`);
}

main();
