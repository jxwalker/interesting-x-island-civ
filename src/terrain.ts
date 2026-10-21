import { Rng, subSeed } from "./rng";

/** World size in tiles. One tile ≈ one creature-width. */
export const W = 128;
export const H = 88;
/** Offscreen terrain resolution, px per tile. */
export const TPX = 8;

export const T_DEEP = 0;
export const T_SHALLOW = 1;
export const T_SAND = 2;
export const T_GRASS = 3;
export const T_FOREST = 4;
export const T_HILL = 5;
export const T_ROCK = 6;

export const SEA_DEEP = "#0b3d5c";

export interface Tree {
  x: number;
  y: number;
  r: number;
}

export interface Terrain {
  seed: number;
  elev: Float32Array;
  type: Uint8Array;
  river: Uint8Array;
  /** 1 = main island, 2 = offshore islet, 0 = sea / unreachable. */
  region: Uint8Array;
  trees: Tree[];
  stones: { x: number; y: number }[];
  /** Pixel rasters (TPX px per tile). */
  base: HTMLCanvasElement | null;
  snow: HTMLCanvasElement | null;
  foam: HTMLCanvasElement | null;
  sparkles: Float32Array;
  isletCenter: { x: number; y: number };
  peak: { x: number; y: number };
}

// ---------------------------------------------------------------- noise

class ValueNoise {
  private perm = new Uint16Array(512);
  private vals = new Float32Array(256);

  constructor(rng: Rng) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p.push(i);
      this.vals[i] = rng.next() * 2 - 1;
    }
    for (let i = 255; i > 0; i--) {
      const j = rng.int(i + 1);
      const t = p[i]!;
      p[i] = p[j]!;
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]!;
  }

  private v(ix: number, iy: number): number {
    return this.vals[this.perm[(this.perm[ix & 255]! + iy) & 511]! & 255]!;
  }

  noise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = this.v(ix, iy);
    const b = this.v(ix + 1, iy);
    const c = this.v(ix, iy + 1);
    const d = this.v(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  fbm(x: number, y: number, oct: number): number {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      s += amp * this.noise(x * f + o * 17.3, y * f - o * 9.1);
      f *= 2.03;
      amp *= 0.5;
    }
    return s;
  }
}

interface Field {
  elev: (x: number, y: number) => number;
  moist: (x: number, y: number) => number;
  detail: (x: number, y: number) => number;
}

function makeField(seed: number): { field: Field; islet: { x: number; y: number } } {
  const rng = new Rng(subSeed(seed, 11));
  const n1 = new ValueNoise(rng);
  const n2 = new ValueNoise(rng);
  const n3 = new ValueNoise(rng);
  // Islet sits off one of the corners; the main island is pushed the other way.
  const ang = rng.range(0, Math.PI * 2);
  const ix = W / 2 + Math.cos(ang) * W * 0.37;
  const iy = H / 2 + Math.sin(ang) * H * 0.34;
  const ox = -Math.cos(ang) * 4;
  const oy = -Math.sin(ang) * 3;
  const stretch = rng.range(0.9, 1.1);
  const elev = (x: number, y: number): number => {
    const nx = ((x - W / 2 - ox) / (W * 0.4)) * stretch;
    const ny = (y - H / 2 - oy) / (H * 0.4);
    const warp = n3.fbm(x * 0.03, y * 0.03, 2) * 0.5;
    const d = Math.sqrt(nx * nx + ny * ny) + warp * 0.35;
    const n = n1.fbm(x * 0.045, y * 0.045, 5);
    let e = 0.62 - 1.05 * d * d + n * 0.85;
    // A gentle ridge of hills inland.
    e += Math.max(0, 0.3 - d) * 0.5;
    // A sea channel around the offshore islet, then the islet bump itself.
    const dist = Math.hypot(x - ix, y - iy);
    e = Math.min(e, -0.24 + (dist - 9.5) * 0.07);
    const dx = (x - ix) / 7;
    const dy = (y - iy) / 6;
    const di = dx * dx + dy * dy;
    e = Math.max(e, 0.32 * Math.exp(-di * 1.3) - 0.09 + n * 0.1);
    return e;
  };
  const moist = (x: number, y: number): number => n2.fbm(x * 0.06, y * 0.06, 4);
  const detail = (x: number, y: number): number => n3.noise(x * 0.9, y * 0.9);
  return { field: { elev, moist, detail }, islet: { x: ix, y: iy } };
}

function classify(e: number, m: number): number {
  if (e < -0.14) return T_DEEP;
  if (e < 0) return T_SHALLOW;
  if (e < 0.055) return T_SAND;
  if (e > 0.62) return T_ROCK;
  if (e > 0.45) return T_HILL;
  if (m > 0.04 && e > 0.09) return T_FOREST;
  return T_GRASS;
}

// ---------------------------------------------------------------- generation

export function generateTerrain(seed: number, render: boolean): Terrain {
  const { field, islet } = makeField(seed);
  const N = W * H;
  const elev = new Float32Array(N);
  const type = new Uint8Array(N);
  const river = new Uint8Array(N);
  const region = new Uint8Array(N);
  let peak = { x: W / 2, y: H / 2 };
  let peakE = -Infinity;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const e = field.elev(x + 0.5, y + 0.5);
      const i = y * W + x;
      elev[i] = e;
      type[i] = classify(e, field.moist(x + 0.5, y + 0.5));
      const dIs = Math.hypot(x - islet.x, y - islet.y);
      if (e > peakE && dIs > 14) {
        peakE = e;
        peak = { x, y };
      }
    }
  }

  // Main island = land component containing the peak.
  const flood = (sx: number, sy: number, id: number): number => {
    const stack = [sy * W + sx];
    let count = 0;
    while (stack.length) {
      const i = stack.pop()!;
      if (region[i] || type[i]! < T_SAND) continue;
      region[i] = id;
      count++;
      const x = i % W;
      const y = (i - x) / W;
      if (x > 0) stack.push(i - 1);
      if (x < W - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - W);
      if (y < H - 1) stack.push(i + W);
    }
    return count;
  };
  flood(peak.x, peak.y, 1);
  // Islet = land component nearest the islet centre that is not the main island.
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < N; i++) {
    if (type[i]! >= T_SAND && region[i] === 0) {
      const x = i % W;
      const y = (i - x) / W;
      const d = Math.hypot(x - islet.x, y - islet.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  let isletCenter = { x: islet.x, y: islet.y };
  if (best >= 0 && bestD < 12) {
    flood(best % W, Math.floor(best / W), 2);
    let sx = 0;
    let sy = 0;
    let c = 0;
    for (let i = 0; i < N; i++) {
      if (region[i] === 2) {
        sx += i % W;
        sy += Math.floor(i / W);
        c++;
      }
    }
    if (c > 0) isletCenter = { x: sx / c + 0.5, y: sy / c + 0.5 };
  }

  // River: from the peak, follow decreasing distance-to-sea with a meander.
  const dist = new Int32Array(N).fill(-1);
  const q: number[] = [];
  for (let i = 0; i < N; i++) {
    if (type[i]! <= T_SHALLOW) {
      dist[i] = 0;
      q.push(i);
    }
  }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!;
    const x = i % W;
    const y = (i - x) / W;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) {
      if (j >= 0 && dist[j] === -1) {
        dist[j] = dist[i]! + 1;
        q.push(j);
      }
    }
  }
  const rr = new Rng(subSeed(seed, 23));
  const riverPath: { x: number; y: number }[] = [];
  {
    let x = peak.x;
    let y = peak.y;
    let dirx = rr.range(-1, 1);
    let diry = rr.range(-1, 1);
    for (let step = 0; step < 400; step++) {
      const i = y * W + x;
      riverPath.push({ x: x + 0.5, y: y + 0.5 });
      if (type[i]! <= T_SHALLOW) break;
      river[i] = 1;
      let bx = x;
      let by = y;
      let bs = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          const dd = dist[j]! - dist[i]!;
          if (dd > 0) continue;
          const s = dd * 1.0 - (dx * dirx + dy * diry) * 0.6 + rr.next() * 0.9 + (river[j] ? 5 : 0);
          if (s < bs) {
            bs = s;
            bx = nx;
            by = ny;
          }
        }
      }
      if (bx === x && by === y) break;
      dirx = dirx * 0.7 + (bx - x) * 0.3;
      diry = diry * 0.7 + (by - y) * 0.3;
      x = bx;
      y = by;
    }
  }

  // Trees & stones (placed on the reachable land).
  const tr = new Rng(subSeed(seed, 31));
  const trees: Tree[] = [];
  for (let k = 0; k < 2600; k++) {
    const x = tr.range(1, W - 1);
    const y = tr.range(1, H - 1);
    const i = Math.floor(y) * W + Math.floor(x);
    if (river[i]) continue;
    const t = type[i]!;
    const p = t === T_FOREST ? 0.55 : t === T_GRASS ? 0.03 : t === T_HILL ? 0.06 : 0;
    if (!tr.chance(p)) continue;
    let clash = false;
    for (const o of trees) {
      if (Math.abs(o.x - x) < 1.3 && Math.abs(o.y - y) < 1.3) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    trees.push({ x, y, r: tr.range(0.85, 1.35) });
  }
  trees.sort((a, b) => a.y - b.y);
  const stones: { x: number; y: number }[] = [];
  for (let k = 0; k < 900; k++) {
    const x = tr.range(1, W - 1);
    const y = tr.range(1, H - 1);
    const t = type[Math.floor(y) * W + Math.floor(x)]!;
    if ((t === T_HILL || t === T_ROCK) && tr.chance(0.35)) stones.push({ x, y });
  }

  const sparkles = new Float32Array(160 * 3);
  {
    let k = 0;
    let guard = 0;
    while (k < 160 && guard++ < 20000) {
      const x = tr.range(0, W);
      const y = tr.range(0, H);
      if (type[Math.floor(y) * W + Math.floor(x)]! > T_SHALLOW) continue;
      sparkles[k * 3] = x;
      sparkles[k * 3 + 1] = y;
      sparkles[k * 3 + 2] = tr.range(0, Math.PI * 2);
      k++;
    }
  }

  const terr: Terrain = {
    seed,
    elev,
    type,
    river,
    region,
    trees,
    stones,
    base: null,
    snow: null,
    foam: null,
    sparkles,
    isletCenter,
    peak,
  };
  if (render && typeof document !== "undefined") renderTerrain(terr, field, riverPath);
  return terr;
}

// ---------------------------------------------------------------- raster

type RGB = [number, number, number];

function lerpC(a: RGB, b: RGB, t: number): RGB {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

const C_DEEP: RGB = [11, 61, 92];
const C_MID: RGB = [18, 104, 140];
const C_SHAL: RGB = [52, 186, 196];
const C_SAND: RGB = [240, 218, 160];
const C_SAND2: RGB = [222, 196, 132];
const C_GRASS: RGB = [128, 196, 88];
const C_GRASS2: RGB = [92, 164, 70];
const C_FOREST: RGB = [62, 128, 58];
const C_HILL: RGB = [132, 138, 84];
const C_ROCK: RGB = [146, 128, 104];
const C_ROCK2: RGB = [178, 164, 142];

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function landColor(e: number, m: number, d: number): RGB {
  if (e < 0.055) return lerpC(C_SAND, C_SAND2, 0.5 + d * 0.6);
  const g = lerpC(C_GRASS, C_GRASS2, smooth(0.08, 0.4, e) + d * 0.25);
  let c = lerpC(C_SAND, g, smooth(0.045, 0.085, e));
  if (m > -0.02) c = lerpC(c, C_FOREST, smooth(-0.02, 0.1, m) * smooth(0.07, 0.12, e) * (1 - smooth(0.42, 0.5, e)));
  c = lerpC(c, C_HILL, smooth(0.4, 0.52, e));
  c = lerpC(c, C_ROCK, smooth(0.56, 0.66, e));
  c = lerpC(c, C_ROCK2, smooth(0.7, 0.85, e) + d * 0.1);
  return c;
}

function renderTerrain(t: Terrain, f: Field, riverPath: { x: number; y: number }[]): void {
  const pw = W * TPX;
  const ph = H * TPX;
  const base = document.createElement("canvas");
  base.width = pw;
  base.height = ph;
  const ctx = base.getContext("2d")!;
  const img = ctx.createImageData(pw, ph);
  const data = img.data;
  const snowC = document.createElement("canvas");
  snowC.width = pw;
  snowC.height = ph;
  const sctx = snowC.getContext("2d")!;
  const simg = sctx.createImageData(pw, ph);
  const sd = simg.data;
  const foamC = document.createElement("canvas");
  foamC.width = pw;
  foamC.height = ph;
  const fctx = foamC.getContext("2d")!;
  const fimg = fctx.createImageData(pw, ph);
  const fd = fimg.data;
  const inv = 1 / TPX;
  // Elevation per pixel first, so hill shading can use neighbours cheaply.
  const ep = new Float32Array(pw * ph);
  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) ep[py * pw + px] = f.elev((px + 0.5) * inv, (py + 0.5) * inv);
  }
  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      const x = (px + 0.5) * inv;
      const y = (py + 0.5) * inv;
      const i = py * pw + px;
      const e = ep[i]!;
      const k = i * 4;
      let c: RGB;
      if (e < 0) {
        // Water: deep → mid → turquoise shallows, with soft caustic noise.
        const dn = f.detail(x * 0.6, y * 0.6) * 0.08 * smooth(-0.62, -0.3, e);
        if (e < -0.14) c = lerpC(C_DEEP, C_MID, smooth(-0.45, -0.14, e) + dn);
        else c = lerpC(C_MID, C_SHAL, smooth(-0.15, -0.01, e) + dn);
        const fo = smooth(-0.035, -0.004, e);
        fd[k] = 255;
        fd[k + 1] = 255;
        fd[k + 2] = 255;
        fd[k + 3] = Math.round(fo * 200);
        sd[k + 3] = 0;
      } else {
        const m = f.moist(x, y);
        const d = f.detail(x, y);
        c = landColor(e, m, d);
        // Hill shading: light from the north-west.
        const ex = ep[i + (px < pw - 1 ? 1 : 0)]! - ep[i - (px > 0 ? 1 : 0)]!;
        const ey = ep[i + (py < ph - 1 ? pw : 0)]! - ep[i - (py > 0 ? pw : 0)]!;
        const shade = Math.max(-0.3, Math.min(0.3, -(ex + ey) * 2.4 * (TPX / 2.85)));
        const sh = 1 + shade;
        c = [c[0] * sh, c[1] * sh, c[2] * sh];
        // Snow mask: thicker inland and on hills, patchy at the coast.
        const sn = 0.62 + smooth(0.02, 0.3, e) * 0.38 + m * 0.35 + d * 0.04;
        sd[k] = 246;
        sd[k + 1] = 250;
        sd[k + 2] = 255;
        sd[k + 3] = Math.round(Math.min(1, Math.max(0, sn)) * 235);
        fd[k + 3] = 0;
      }
      data[k] = c[0];
      data[k + 1] = c[1];
      data[k + 2] = c[2];
      data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  sctx.putImageData(simg, 0, 0);
  fctx.putImageData(fimg, 0, 0);

  // River: soft bank + bright water ribbon, widening towards the sea.
  if (riverPath.length > 2) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const n = riverPath.length;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n; i++) {
        const a = riverPath[i - 1]!;
        const b = riverPath[i]!;
        const w = (0.7 + (1.2 * i) / n) * TPX;
        ctx.strokeStyle = pass === 0 ? "rgba(70,120,70,0.55)" : "#4fb8d0";
        ctx.lineWidth = pass === 0 ? w + TPX * 0.9 : w;
        ctx.beginPath();
        ctx.moveTo(a.x * TPX, a.y * TPX);
        ctx.lineTo(b.x * TPX, b.y * TPX);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "rgba(220,250,255,0.35)";
    ctx.lineWidth = TPX * 0.3;
    ctx.beginPath();
    ctx.moveTo(riverPath[0]!.x * TPX, riverPath[0]!.y * TPX);
    for (let i = 1; i < n; i++) ctx.lineTo(riverPath[i]!.x * TPX - 0.6, riverPath[i]!.y * TPX - 0.6);
    ctx.stroke();
    // Snow should not cover the river.
    sctx.globalCompositeOperation = "destination-out";
    sctx.lineCap = "round";
    sctx.lineWidth = TPX * 1.6;
    sctx.beginPath();
    sctx.moveTo(riverPath[0]!.x * TPX, riverPath[0]!.y * TPX);
    for (let i = 1; i < n; i++) sctx.lineTo(riverPath[i]!.x * TPX, riverPath[i]!.y * TPX);
    sctx.stroke();
    sctx.globalCompositeOperation = "source-over";
  }

  // Stones on the hills.
  const q = TPX / 5;
  for (const s of t.stones) {
    const x = s.x * TPX;
    const y = s.y * TPX;
    ctx.fillStyle = "rgba(40,36,30,0.25)";
    ctx.beginPath();
    ctx.ellipse(x + q, y + 1.4 * q, 2.6 * q, 1.6 * q, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b9b3a8";
    ctx.beginPath();
    ctx.ellipse(x, y, 2.4 * q, 1.7 * q, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x - 0.6 * q, y - 0.6 * q, 1.1 * q, 0.7 * q, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trees: shadow pass, then canopy blobs, so shadows never sit on top.
  for (const tr of t.trees) {
    const x = tr.x * TPX;
    const y = tr.y * TPX;
    const r = tr.r * TPX;
    ctx.fillStyle = "rgba(20,40,20,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.45, y + r * 0.55, r * 1.05, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const tr of t.trees) {
    const x = tr.x * TPX;
    const y = tr.y * TPX;
    const r = tr.r * TPX;
    const h = (tr.x * 13.7 + tr.y * 7.1) % 1;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.1);
    const dark = h < 0.5 ? "#2f6b34" : "#3a7a2e";
    g.addColorStop(0, h < 0.5 ? "#7cc46a" : "#8fcc5a");
    g.addColorStop(0.55, h < 0.5 ? "#4b9a48" : "#5aa23e");
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Snow should leave the canopy green-ish on top.
    sctx.globalCompositeOperation = "destination-out";
    sctx.fillStyle = "rgba(0,0,0,0.55)";
    sctx.beginPath();
    sctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    sctx.fill();
    sctx.globalCompositeOperation = "source-over";
  }

  // Sand speckle for texture.
  const sr = new Rng(subSeed(t.seed, 41));
  for (let k = 0; k < 2200; k++) {
    const x = sr.range(0, W);
    const y = sr.range(0, H);
    const ty = t.type[Math.floor(y) * W + Math.floor(x)]!;
    if (ty === T_SAND) {
      ctx.fillStyle = sr.chance(0.5) ? "rgba(255,250,230,0.5)" : "rgba(170,140,90,0.35)";
      ctx.fillRect(x * TPX, y * TPX, TPX * 0.2, TPX * 0.2);
    } else if (ty === T_GRASS && sr.chance(0.5)) {
      ctx.fillStyle = sr.chance(0.5) ? "rgba(200,240,140,0.35)" : "rgba(40,90,40,0.25)";
      ctx.fillRect(x * TPX, y * TPX, TPX * 0.3, TPX * 0.3);
    }
  }

  t.base = base;
  t.snow = snowC;
  t.foam = foamC;
}

export function tileAt(t: Terrain, x: number, y: number): number {
  const ix = x | 0;
  const iy = y | 0;
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return T_DEEP;
  return t.type[iy * W + ix]!;
}

export function regionAt(t: Terrain, x: number, y: number): number {
  const ix = x | 0;
  const iy = y | 0;
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return 0;
  return t.region[iy * W + ix]!;
}
