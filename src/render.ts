import {
  A_FISH,
  A_PLAY,
  A_SLEEP,
  BOAT,
  COOKING,
  DAY,
  FIRE,
  FISHING,
  FX_BIRTH,
  FX_BUILD,
  FX_CRATE,
  FX_DISCOVER,
  FX_ELECT,
  FX_FISH,
  FX_LIGHTNING,
  FX_SPLASH,
  FX_STEAM,
  FX_TEACH,
  HUT,
  R_BERRY,
  R_FISH,
  R_STONE,
  SPEAR,
  STORY,
  S_CRATE,
  S_FIRE,
  S_HUT,
  S_WILDFIRE,
  S_WORKSHOP,
  TECHS,
  TOOLS,
  WORKSHOP,
  type Agent,
  type World,
} from "./sim";
import { H, SEA_DEEP, W } from "./terrain";

const TAU = Math.PI * 2;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Camera state per island view (smoothed in main). */
export interface Cam {
  cx: number;
  cy: number;
  zoom: number;
}

export interface ViewXf {
  rect: Rect;
  s: number;
  ox: number;
  oy: number;
}

export function makeXf(rect: Rect, cam: Cam, twin: boolean): ViewXf {
  // Crop the empty deep sea around the island; it's seamless with the backdrop.
  const base = twin ? Math.min(rect.w / (W * 0.84), rect.h / (H * 0.86)) : Math.min(rect.w / (W * 0.86), rect.h / (H * 0.86));
  // Never show past the world's edge.
  const cover = Math.max(rect.w / W, rect.h / H);
  const s = Math.max(base, cover) * cam.zoom;
  return { rect, s, ox: rect.x + rect.w / 2 - cam.cx * s, oy: rect.y + rect.h / 2 - cam.cy * s };
}

export function toWorld(xf: ViewXf, px: number, py: number): { x: number; y: number } {
  return { x: (px - xf.ox) / xf.s, y: (py - xf.oy) / xf.s };
}

// ===================================================================== icons

/** Small vector glyph for each tech (no emoji font needed on canvas). */
export function drawTechIcon(ctx: CanvasRenderingContext2D, tech: number, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r / 10, r / 10);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  switch (tech) {
    case 0: // forage: berry cluster
      for (const [bx, by] of [[-3, 1], [3, 1], [0, -3.5], [0, 4.5]] as const) {
        ctx.beginPath();
        ctx.arc(bx, by, 3.2, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(2.5, -9);
      ctx.stroke();
      break;
    case TOOLS: // hand axe
      ctx.beginPath();
      ctx.moveTo(-6, 7);
      ctx.lineTo(3, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, -4);
      ctx.lineTo(6, 2);
      ctx.lineTo(-1, -1);
      ctx.closePath();
      ctx.fill();
      break;
    case FIRE: {
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.bezierCurveTo(6, -3, 8, 2, 5, 6);
      ctx.bezierCurveTo(3, 9, -3, 9, -5, 6);
      ctx.bezierCurveTo(-8, 1, -4, -2, -2, -5);
      ctx.bezierCurveTo(-1, -2, 1, -1, 0, -9);
      ctx.fill();
      ctx.fillStyle = "rgba(255,240,180,0.9)";
      ctx.beginPath();
      ctx.ellipse(0, 4, 2.4, 3.4, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case SPEAR:
      ctx.beginPath();
      ctx.moveTo(-7, 8);
      ctx.lineTo(5, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(9, -9);
      ctx.lineTo(6.5, -1.5);
      ctx.lineTo(1.5, -6.5);
      ctx.closePath();
      ctx.fill();
      break;
    case FISHING:
      ctx.beginPath();
      ctx.ellipse(-1, 0, 6, 3.6, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(9, -4);
      ctx.lineTo(9, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0b1a24";
      ctx.beginPath();
      ctx.arc(-4, -0.8, 0.9, 0, TAU);
      ctx.fill();
      break;
    case COOKING:
      ctx.beginPath();
      ctx.moveTo(-8, -1);
      ctx.lineTo(8, -1);
      ctx.quadraticCurveTo(7, 8, 0, 8);
      ctx.quadraticCurveTo(-7, 8, -8, -1);
      ctx.fill();
      ctx.lineWidth = 1.4;
      for (const sx of [-3, 1, 5]) {
        ctx.beginPath();
        ctx.moveTo(sx - 1, -3);
        ctx.quadraticCurveTo(sx + 1, -5.5, sx - 1, -8.5);
        ctx.stroke();
      }
      break;
    case HUT:
      ctx.beginPath();
      ctx.moveTo(-8.5, 7);
      ctx.quadraticCurveTo(-8, -6, 0, -8.5);
      ctx.quadraticCurveTo(8, -6, 8.5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1b120a";
      ctx.beginPath();
      ctx.moveTo(-2.4, 7);
      ctx.lineTo(-2.4, 2);
      ctx.quadraticCurveTo(0, -0.5, 2.4, 2);
      ctx.lineTo(2.4, 7);
      ctx.fill();
      break;
    case STORY:
      ctx.beginPath();
      ctx.ellipse(0, -1.5, 8.5, 6, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, 3);
      ctx.lineTo(-6, 8.5);
      ctx.lineTo(0, 4);
      ctx.fill();
      ctx.fillStyle = "#0b1a24";
      for (const dx of [-4, 0, 4]) {
        ctx.beginPath();
        ctx.arc(dx, -1.5, 1.1, 0, TAU);
        ctx.fill();
      }
      break;
    case WORKSHOP: {
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU;
        const rr = k % 2 === 0 ? 9 : 6.5;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0b1a24";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fill();
      break;
    }
    case BOAT:
      ctx.beginPath();
      ctx.moveTo(-9, 2);
      ctx.lineTo(9, 2);
      ctx.lineTo(6, 7);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(0, -9);
      ctx.lineTo(7, -1);
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
      break;
  }
  ctx.restore();
}

// ===================================================================== particles

interface Flake {
  x: number;
  y: number;
  s: number;
  v: number;
}

const flakes: Flake[] = [];
for (let i = 0; i < 160; i++) {
  flakes.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 1.6, v: 0.04 + Math.random() * 0.06 });
}

/** Twin mode runs fast: soften the night so the day cycle doesn't strobe. */
let nightScale = 1;

// Scratch canvas for the night overlay (reduced resolution).
let nightC: HTMLCanvasElement | null = null;
let nightX: CanvasRenderingContext2D | null = null;

function nightCtx(w: number, h: number): CanvasRenderingContext2D {
  if (!nightC) {
    nightC = document.createElement("canvas");
    nightX = nightC.getContext("2d")!;
  }
  const cw = Math.max(1, Math.ceil(w));
  const ch = Math.max(1, Math.ceil(h));
  if (nightC.width !== cw || nightC.height !== ch) {
    nightC.width = cw;
    nightC.height = ch;
  }
  return nightX!;
}

// ===================================================================== draw

export interface DrawOpts {
  time: number;
  followId: number;
  twinLabel: string | null;
  twinColor: string;
  hover: { x: number; y: number } | null;
  giftArmed: boolean;
  /** Lightning flash brightness 0..1 (UI-side, for clicks). */
  ripple: { x: number; y: number; t: number } | null;
  dpr: number;
  banner: { text: string; tech: number; t: number } | null;
  quality: number;
}

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h.toFixed(0)},${s}%,${l}%,${a})`;
}

export function drawIsland(ctx: CanvasRenderingContext2D, world: World, xf: ViewXf, o: DrawOpts): void {
  nightScale = o.twinLabel ? 0.55 : 1;
  const { rect, s } = xf;
  const t = o.time;
  const ter = world.terrain;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  // --- sea + terrain
  ctx.fillStyle = SEA_DEEP;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.setTransform(o.dpr * s, 0, 0, o.dpr * s, o.dpr * xf.ox, o.dpr * xf.oy);
  ctx.imageSmoothingEnabled = true;
  if (ter.base) ctx.drawImage(ter.base, 0, 0, W, H);

  // Animated foam & sparkles on the water.
  if (ter.foam) {
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 1.3);
    const off = Math.sin(t * 0.9) * 0.18;
    ctx.drawImage(ter.foam, -off, -off, W + off * 2, H + off * 2);
    ctx.globalAlpha = 1;
  }
  const sp = ter.sparkles;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < sp.length; i += 3) {
    const a = Math.sin(t * 1.7 + sp[i + 2]!) * 0.5 + 0.5;
    if (a < 0.55) continue;
    const drift = Math.sin(t * 0.4 + sp[i + 2]!) * 0.6;
    ctx.globalAlpha = (a - 0.55) * 1.4;
    ctx.fillRect(sp[i]! + drift, sp[i + 1]!, 0.9 * a, 0.14);
  }
  ctx.globalAlpha = 1;

  // Snow cover.
  const snow = world.snow;
  if (snow > 0.01 && ter.snow) {
    ctx.globalAlpha = Math.min(0.78, snow * 0.8);
    ctx.drawImage(ter.snow, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Camp marker: a trampled clearing.
  {
    const g = ctx.createRadialGradient(world.camp.x, world.camp.y, 0.5, world.camp.x, world.camp.y, 6);
    g.addColorStop(0, "rgba(160,120,70,0.32)");
    g.addColorStop(1, "rgba(160,120,70,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(world.camp.x, world.camp.y, 6, 4.6, 0, 0, TAU);
    ctx.fill();
  }

  // Scorch marks from wildfires.
  for (const st of world.structs) {
    if (st.kind !== S_WILDFIRE) continue;
    ctx.fillStyle = "rgba(40,28,20,0.45)";
    ctx.beginPath();
    ctx.ellipse(st.x, st.y, 3.2, 2.4, 0.3, 0, TAU);
    ctx.fill();
  }

  // Graves.
  for (const g of world.graves) {
    const age = (world.t - g.t) / DAY;
    const a = Math.max(0.35, 1 - age / 60);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(30,30,30,0.3)";
    ctx.beginPath();
    ctx.ellipse(g.x + 0.12, g.y + 0.35, 0.42, 0.18, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#c9c4bb";
    ctx.beginPath();
    ctx.moveTo(g.x - 0.3, g.y + 0.3);
    ctx.lineTo(g.x - 0.3, g.y - 0.15);
    ctx.arc(g.x, g.y - 0.15, 0.3, Math.PI, 0);
    ctx.lineTo(g.x + 0.3, g.y + 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(90,85,80,0.8)";
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y - 0.3);
    ctx.lineTo(g.x, g.y + 0.1);
    ctx.moveTo(g.x - 0.13, g.y - 0.15);
    ctx.lineTo(g.x + 0.13, g.y - 0.15);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Resources.
  for (const r of world.res) {
    if (r.kind === R_BERRY) {
      ctx.fillStyle = "rgba(20,50,20,0.28)";
      ctx.beginPath();
      ctx.ellipse(r.x + 0.2, r.y + 0.35, 0.9, 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = snow > 0.4 ? "#5f8a5a" : "#3f8f3c";
      ctx.beginPath();
      ctx.arc(r.x, r.y, 0.78, 0, TAU);
      ctx.fill();
      ctx.fillStyle = snow > 0.4 ? "#7aa074" : "#5cb04f";
      ctx.beginPath();
      ctx.arc(r.x - 0.2, r.y - 0.22, 0.45, 0, TAU);
      ctx.fill();
      const n = Math.floor(r.amt);
      ctx.fillStyle = r.region === 2 ? "#ff3d7f" : "#e8304f";
      for (let k = 0; k < n; k++) {
        const ang = k * 2.39996 + r.x;
        const rr = 0.18 + 0.42 * ((k * 0.37) % 1);
        ctx.beginPath();
        ctx.arc(r.x + Math.cos(ang) * rr, r.y + Math.sin(ang) * rr * 0.8, 0.16, 0, TAU);
        ctx.fill();
      }
    } else if (r.kind === R_FISH) {
      if (r.amt < 1) continue;
      const ph = (t * 0.7 + r.x * 0.37) % 1;
      ctx.strokeStyle = `rgba(230,255,255,${0.55 * (1 - ph)})`;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 0.3 + ph * 1.1, (0.3 + ph * 1.1) * 0.6, 0, 0, TAU);
      ctx.stroke();
      const fa = t * 1.2 + r.y;
      ctx.fillStyle = "rgba(10,50,70,0.45)";
      ctx.beginPath();
      ctx.ellipse(r.x + Math.cos(fa) * 0.5, r.y + Math.sin(fa) * 0.3, 0.35, 0.14, fa + Math.PI / 2, 0, TAU);
      ctx.fill();
    } else if (r.kind === R_STONE) {
      ctx.fillStyle = "#8d8780";
      ctx.beginPath();
      ctx.moveTo(r.x - 0.7, r.y + 0.4);
      ctx.lineTo(r.x - 0.4, r.y - 0.4);
      ctx.lineTo(r.x + 0.2, r.y - 0.6);
      ctx.lineTo(r.x + 0.75, r.y + 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3b3f4a";
      ctx.beginPath();
      ctx.moveTo(r.x - 0.1, r.y + 0.1);
      ctx.lineTo(r.x + 0.15, r.y - 0.35);
      ctx.lineTo(r.x + 0.4, r.y + 0.15);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Raft route hint once someone knows rafts.
  if (world.hasIslet && world.techCount[BOAT]! > 0) {
    ctx.setLineDash([0.5, 0.6]);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(world.launch.x, world.launch.y);
    ctx.lineTo(world.landing.x, world.landing.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Goats.
  for (const g of world.goats) {
    if (!g.alive) continue;
    const bob = Math.abs(Math.sin(t * 6 + g.x)) * (Math.hypot(g.vx, g.vy) > 0.2 ? 0.12 : 0);
    ctx.fillStyle = "rgba(30,30,20,0.28)";
    ctx.beginPath();
    ctx.ellipse(g.x, g.y + 0.35, 0.55, 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f2ede2";
    ctx.beginPath();
    ctx.ellipse(g.x, g.y - bob, 0.55, 0.36, 0, 0, TAU);
    ctx.fill();
    const hx = g.vx >= 0 ? 0.5 : -0.5;
    ctx.fillStyle = "#e1d8c8";
    ctx.beginPath();
    ctx.arc(g.x + hx, g.y - 0.25 - bob, 0.22, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#7a6a55";
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(g.x + hx, g.y - 0.42 - bob);
    ctx.lineTo(g.x + hx * 1.25, g.y - 0.62 - bob);
    ctx.stroke();
  }

  // Structures.
  const night = world.darkness;
  for (const st of world.structs) drawStruct(ctx, st, t, night, world);

  // Creatures.
  const as = world.agents;
  for (let i = 0; i < as.length; i++) {
    const a = as[i]!;
    if (a.hut >= 0 && a.alive) continue;
    drawCreature(ctx, a, t, world, a.id === o.followId, s);
  }

  // FX (world space).
  drawFx(ctx, world, t);

  // --- screen-space overlays
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  drawSky(ctx, world, xf, o);

  // Need icons sit above the night overlay so they stay readable.
  ctx.setTransform(o.dpr * s, 0, 0, o.dpr * s, o.dpr * xf.ox, o.dpr * xf.oy);
  for (let i = 0; i < as.length; i++) {
    const a = as[i]!;
    if (!a.alive || a.hut >= 0) continue;
    drawNeeds(ctx, a, t, s);
  }
  drawTeachOverlay(ctx, world, s);
  if (o.followId >= 0) {
    const a = world.agentById(o.followId);
    if (a && a.alive) {
      const pr = 1.3 + 0.15 * Math.sin(t * 4);
      ctx.strokeStyle = "rgba(255,240,170,0.95)";
      ctx.lineWidth = 2.2 / s;
      ctx.beginPath();
      ctx.arc(a.x, a.y - 0.3, pr, 0, TAU);
      ctx.stroke();
      // Name tag in screen space so it stays crisp at any zoom.
      ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
      const sx = xf.ox + a.x * s;
      const sy = xf.oy + (a.y - pr - 0.5) * s - 8;
      ctx.font = `600 12px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      const tw = ctx.measureText(a.name).width;
      ctx.fillStyle = "rgba(10,16,24,0.78)";
      roundRect(ctx, sx - tw / 2 - 6, sy - 13, tw + 12, 18, 9);
      ctx.fill();
      ctx.fillStyle = "#fff6d6";
      ctx.fillText(a.name, sx, sy);
    }
  }

  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  // Click ripple (new island / gift drop).
  if (o.ripple) {
    const k = o.ripple.t;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
    ctx.lineWidth = 3 * (1 - k) + 0.5;
    for (let r = 0; r < 3; r++) {
      const rr = (k * 1.4 - r * 0.15) * Math.max(rect.w, rect.h) * 0.6;
      if (rr <= 0) continue;
      ctx.beginPath();
      ctx.arc(o.ripple.x, o.ripple.y, rr, 0, TAU);
      ctx.stroke();
    }
  }

  // Twin label.
  if (o.twinLabel) {
    const pad = 8;
    ctx.font = `700 11px "IBM Plex Mono", monospace`;
    const techs = world.techsKnown();
    const txt = `${o.twinLabel}`;
    const sub = `${techs} techs · ${world.avgTechs().toFixed(1)}/head · pop ${world.alivePop()}`;
    const w1 = Math.max(ctx.measureText(txt).width, ctx.measureText(sub).width * 0.92) + pad * 2;
    ctx.fillStyle = "rgba(6,14,22,0.72)";
    roundRect(ctx, rect.x + 10, rect.y + 10, w1, 40, 8);
    ctx.fill();
    ctx.strokeStyle = o.twinColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = o.twinColor;
    ctx.textAlign = "left";
    ctx.fillText(txt, rect.x + 10 + pad, rect.y + 26);
    ctx.font = `500 10px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "#cfe0ea";
    ctx.fillText(sub, rect.x + 10 + pad, rect.y + 42);
  }

  // Discovery banner.
  if (o.banner && o.banner.t < 3.2) {
    const k = o.banner.t;
    const a = k < 0.25 ? k / 0.25 : k > 2.6 ? Math.max(0, (3.2 - k) / 0.6) : 1;
    const def = TECHS[o.banner.tech];
    const col = def ? def.color : "#fff";
    ctx.globalAlpha = a;
    ctx.font = `600 ${rect.w < 520 ? 12 : 15}px "Space Grotesk", sans-serif`;
    const tw = ctx.measureText(o.banner.text).width;
    const bw = tw + 46;
    const bx = rect.x + rect.w / 2 - bw / 2;
    const by = rect.y + rect.h - 54 - (1 - Math.min(1, k * 4)) * 10;
    ctx.fillStyle = "rgba(6,14,22,0.78)";
    roundRect(ctx, bx, by, bw, 34, 17);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawTechIcon(ctx, o.banner.tech, bx + 19, by + 17, 9, col);
    ctx.fillStyle = "#f4f8fb";
    ctx.textAlign = "left";
    ctx.fillText(o.banner.text, bx + 34, by + 22);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function flame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number, seed: number): void {
  const f1 = Math.sin(t * 13 + seed) * 0.12 + Math.sin(t * 7.3 + seed * 2) * 0.1;
  const h = size * (1 + f1);
  const sway = Math.sin(t * 5 + seed) * 0.12 * size;
  const layers: [string, number][] = [
    ["rgba(255,90,30,0.9)", 1],
    ["rgba(255,170,40,0.95)", 0.68],
    ["rgba(255,240,170,0.95)", 0.36],
  ];
  for (const [c, k] of layers) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - 0.45 * size * k, y);
    ctx.quadraticCurveTo(x - 0.5 * size * k, y - h * k * 0.6, x + sway * k, y - h * k);
    ctx.quadraticCurveTo(x + 0.5 * size * k, y - h * k * 0.6, x + 0.45 * size * k, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStruct(ctx: CanvasRenderingContext2D, st: World["structs"][number], t: number, night: number, world: World): void {
  const x = st.x;
  const y = st.y;
  switch (st.kind) {
    case S_FIRE: {
      // Stone ring.
      ctx.fillStyle = "rgba(30,25,20,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, y + 0.15, 0.95, 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = st.progress >= 1 ? "#3a2b22" : "rgba(80,60,40,0.6)";
      ctx.beginPath();
      ctx.ellipse(x, y, 0.7, 0.4, 0, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        ctx.fillStyle = k % 2 ? "#9b958a" : "#b5afa3";
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 0.85, y + Math.sin(a) * 0.5, 0.2, 0.15, 0, 0, TAU);
        ctx.fill();
      }
      if (st.progress < 1) {
        ctx.strokeStyle = "#8a5a32";
        ctx.lineWidth = 0.14;
        for (let k = 0; k < Math.ceil(st.progress * 3) + st.wood; k++) {
          const a = k * 1.2;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * 0.5, y - Math.sin(a) * 0.3);
          ctx.lineTo(x + Math.cos(a) * 0.5, y + Math.sin(a) * 0.3);
          ctx.stroke();
        }
      } else if (st.fuel > 0) {
        const sz = 0.75 + st.fuel * 0.75;
        flame(ctx, x - 0.2, y + 0.15, sz * 0.8, t, x);
        flame(ctx, x + 0.22, y + 0.1, sz * 0.7, t, y);
        flame(ctx, x, y + 0.2, sz, t, x + y);
        // Sparks.
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.8 + k / 3 + x) % 1;
          ctx.fillStyle = `rgba(255,200,90,${1 - ph})`;
          ctx.fillRect(x + Math.sin(ph * 9 + k) * 0.4, y - 0.6 - ph * 2.2, 0.1, 0.1);
        }
      } else {
        // Embers.
        const g = 0.4 + 0.25 * Math.sin(t * 2 + x);
        ctx.fillStyle = `rgba(255,90,40,${g})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 0.45, 0.25, 0, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case S_WILDFIRE: {
      if (st.fuel <= 0) break;
      const n = 11;
      for (let k = 0; k < n; k++) {
        const a = k * 2.4;
        const rr = 0.3 + (k % 4) * 0.75;
        flame(ctx, x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr * 0.8, (1.2 + st.fuel * 1.6) * (1 - (k % 4) * 0.13), t, k * 1.7 + x);
      }
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.25 + k / 5) % 1;
        ctx.fillStyle = `rgba(70,70,70,${0.35 * (1 - ph) * st.fuel})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin(k * 3 + t * 0.5) * 0.8 + ph * 1.5, y - 1.5 - ph * 5, 0.6 + ph * 1.4, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case S_HUT: {
      ctx.fillStyle = "rgba(25,20,10,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + 0.3, y + 0.75, 1.5, 0.6, 0, 0, TAU);
      ctx.fill();
      if (st.progress < 1) {
        // Frame poles.
        ctx.strokeStyle = "#8a5a32";
        ctx.lineWidth = 0.16;
        const p = st.progress;
        const poles = 2 + Math.floor((st.wood / Math.max(1, st.woodNeed)) * 4);
        for (let k = 0; k < poles; k++) {
          const bx = x - 1.1 + (k / Math.max(1, poles - 1)) * 2.2;
          ctx.beginPath();
          ctx.moveTo(bx, y + 0.6);
          ctx.quadraticCurveTo(bx * 0.3 + x * 0.7, y - 0.9, x, y - 1.1);
          ctx.stroke();
        }
        if (p > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - 1.5, y + 0.7 - 2 * p, 3, 2 * p);
          ctx.clip();
          hutDome(ctx, x, y, night, 0);
          ctx.restore();
        }
      } else {
        hutDome(ctx, x, y, night, st.occ);
      }
      break;
    }
    case S_WORKSHOP: {
      ctx.fillStyle = "rgba(25,20,10,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + 0.4, y + 1.0, 2.2, 0.7, 0, 0, TAU);
      ctx.fill();
      const p = st.progress;
      ctx.save();
      if (p < 1) {
        ctx.beginPath();
        ctx.rect(x - 2.5, y + 1 - 3.2 * p, 5, 3.2 * p + 0.5);
        ctx.clip();
      }
      // Walls.
      ctx.fillStyle = "#a77b4f";
      ctx.fillRect(x - 1.7, y - 0.8, 3.4, 1.8);
      ctx.fillStyle = "#8e6440";
      for (let k = 0; k < 4; k++) ctx.fillRect(x - 1.7, y - 0.6 + k * 0.42, 3.4, 0.07);
      // Roof.
      ctx.fillStyle = "#c98d4a";
      ctx.beginPath();
      ctx.moveTo(x - 2.1, y - 0.7);
      ctx.lineTo(x, y - 2.1);
      ctx.lineTo(x + 2.1, y - 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(x - 2.1, y - 0.7);
      ctx.lineTo(x, y - 2.1);
      ctx.lineTo(x - 0.2, y - 0.7);
      ctx.closePath();
      ctx.fill();
      // Door + window.
      ctx.fillStyle = night > 0.3 ? `rgba(255,190,90,${0.5 + night * 0.5})` : "#3a2616";
      ctx.fillRect(x - 0.35, y + 0.15, 0.7, 0.85);
      ctx.fillRect(x + 0.75, y - 0.35, 0.55, 0.45);
      ctx.restore();
      if (p >= 1) {
        // Spinning gear sign.
        ctx.save();
        ctx.translate(x, y - 2.65);
        ctx.rotate(t * 1.6);
        drawTechIcon(ctx, WORKSHOP, 0, 0, 0.6, "#fbbf24");
        ctx.restore();
      } else {
        ctx.strokeStyle = "#8a5a32";
        ctx.lineWidth = 0.12;
        ctx.strokeRect(x - 1.7, y - 2.1, 3.4, 3.1);
      }
      break;
    }
    case S_CRATE: {
      const age = world.t - st.born;
      const drop = Math.max(0, 1 - age / 0.6);
      const yy = y - drop * drop * 8;
      ctx.fillStyle = "rgba(20,20,10,0.3)";
      ctx.beginPath();
      ctx.ellipse(x + 0.2, y + 0.55, 0.9 * (1 - drop * 0.5), 0.3, 0, 0, TAU);
      ctx.fill();
      if (st.amt <= 0) {
        ctx.globalAlpha = 0.5;
      }
      ctx.fillStyle = "#b8864f";
      ctx.fillRect(x - 0.7, yy - 0.6, 1.4, 1.1);
      ctx.strokeStyle = "#6e4a26";
      ctx.lineWidth = 0.1;
      ctx.strokeRect(x - 0.7, yy - 0.6, 1.4, 1.1);
      ctx.beginPath();
      ctx.moveTo(x - 0.7, yy - 0.6);
      ctx.lineTo(x + 0.7, yy + 0.5);
      ctx.stroke();
      ctx.fillStyle = st.crateKind === R_BERRY ? "#e8304f" : "#9aa3ad";
      const n = Math.min(6, Math.ceil(st.amt / 3));
      for (let k = 0; k < n; k++) {
        ctx.beginPath();
        ctx.arc(x - 0.45 + (k % 3) * 0.45, yy - 0.75 - Math.floor(k / 3) * 0.3, 0.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

function hutDome(ctx: CanvasRenderingContext2D, x: number, y: number, night: number, occ: number): void {
  const g = ctx.createLinearGradient(x - 1.4, y - 1.4, x + 1.4, y + 0.8);
  g.addColorStop(0, "#e8b66a");
  g.addColorStop(0.6, "#c48a44");
  g.addColorStop(1, "#8e5f2c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 1.4, y + 0.7);
  ctx.quadraticCurveTo(x - 1.45, y - 1.1, x, y - 1.35);
  ctx.quadraticCurveTo(x + 1.45, y - 1.1, x + 1.4, y + 0.7);
  ctx.closePath();
  ctx.fill();
  // Thatch lines.
  ctx.strokeStyle = "rgba(110,70,30,0.55)";
  ctx.lineWidth = 0.07;
  for (let k = 0; k < 3; k++) {
    const yy = y - 0.7 + k * 0.45;
    ctx.beginPath();
    ctx.moveTo(x - 1.1 - k * 0.08, yy);
    ctx.quadraticCurveTo(x, yy - 0.3, x + 1.1 + k * 0.08, yy);
    ctx.stroke();
  }
  // Door: glows when someone sleeps inside at night.
  const glow = occ > 0 && night > 0.2;
  ctx.fillStyle = glow ? `rgba(255,190,90,${0.6 + 0.4 * night})` : "#3a2616";
  ctx.beginPath();
  ctx.moveTo(x - 0.38, y + 0.7);
  ctx.lineTo(x - 0.38, y + 0.15);
  ctx.quadraticCurveTo(x, y - 0.25, x + 0.38, y + 0.15);
  ctx.lineTo(x + 0.38, y + 0.7);
  ctx.closePath();
  ctx.fill();
}

function drawCreature(ctx: CanvasRenderingContext2D, a: Agent, t: number, world: World, followed: boolean, s: number): void {
  const baby = a.age < 2.5;
  const elder = a.age > a.lifespan * 0.8;
  const r = baby ? 0.5 : 0.82;
  const dying = !a.alive;
  const alpha = dying ? Math.max(0, a.dying / 1.5) : 1;
  const bob = a.moving ? Math.abs(Math.sin(a.walk * 1.4)) * 0.18 : 0;
  const asleep = a.act === A_SLEEP && a.phase === 1;
  const x = a.x;
  let y = a.y - bob - (dying ? (1 - alpha) * 0.8 : 0);
  ctx.globalAlpha = alpha;

  if (a.onBoat) {
    // Raft with a little sail, bobbing.
    const by = Math.sin(t * 3 + a.id) * 0.08;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(x - a.fx * 0.9, y + 0.35 - a.fy * 0.5, 1.2, 0.35, Math.atan2(a.fy, a.fx), 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#9b6a3c";
    ctx.fillRect(x - 0.9, y + 0.05 + by, 1.8, 0.5);
    ctx.fillStyle = "#7d522c";
    for (let k = 0; k < 4; k++) ctx.fillRect(x - 0.9 + k * 0.45, y + 0.05 + by, 0.06, 0.5);
    ctx.strokeStyle = "#5b3b1f";
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(x + 0.4, y + 0.1 + by);
    ctx.lineTo(x + 0.4, y - 1.5 + by);
    ctx.stroke();
    ctx.fillStyle = "#f4ecd8";
    ctx.beginPath();
    ctx.moveTo(x + 0.45, y - 1.45 + by);
    ctx.lineTo(x + 1.25, y - 0.2 + by);
    ctx.lineTo(x + 0.45, y - 0.15 + by);
    ctx.closePath();
    ctx.fill();
    y += by - 0.25;
  } else {
    // Shadow.
    ctx.fillStyle = "rgba(20,30,20,0.32)";
    ctx.beginPath();
    ctx.ellipse(x + 0.08, a.y + r * 0.85, r * 0.95, r * 0.38, 0, 0, TAU);
    ctx.fill();
  }

  // Elder/teacher halo.
  if (a.taught >= 3 && a.alive) {
    const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.1);
    g.addColorStop(0, "rgba(255,236,160,0.45)");
    g.addColorStop(1, "rgba(255,236,160,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.1, 0, TAU);
    ctx.fill();
  }

  // Learning flash ring in the tech colour.
  if (a.learnFx > 0) {
    const k = 1 - a.learnFx / 1.2;
    const def = TECHS[a.learnTech]!;
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = alpha * (1 - k);
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.arc(x, y, r + k * 1.6, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  // Body.
  const sat = elder ? 30 : 68;
  const light = elder ? 72 : 62;
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.05);
  body.addColorStop(0, hsl(a.hue, sat, Math.min(92, light + 20)));
  body.addColorStop(1, hsl(a.hue, sat, light - 14));
  ctx.fillStyle = body;
  ctx.beginPath();
  if (asleep) ctx.ellipse(x, y + r * 0.2, r * 1.12, r * 0.78, 0, 0, TAU);
  else ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = hsl(a.hue, 40, 22, 0.75);
  ctx.lineWidth = Math.max(0.06, 0.9 / s);
  ctx.stroke();

  // Little feet when walking.
  if (a.moving && !a.onBoat) {
    const ph = Math.sin(a.walk * 1.4);
    ctx.fillStyle = hsl(a.hue, 40, 30);
    ctx.beginPath();
    ctx.arc(x - r * 0.45, y + r * 0.9 + ph * 0.06, r * 0.22, 0, TAU);
    ctx.arc(x + r * 0.45, y + r * 0.9 - ph * 0.06, r * 0.22, 0, TAU);
    ctx.fill();
  }

  // Eyes look where it's heading.
  const ex = a.fx * r * 0.28;
  const ey = a.fy * r * 0.18 - r * 0.12;
  if (asleep || dying) {
    ctx.strokeStyle = "#1a1410";
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.48, y + ey + r * 0.15);
    ctx.lineTo(x - r * 0.18, y + ey + r * 0.15);
    ctx.moveTo(x + r * 0.18, y + ey + r * 0.15);
    ctx.lineTo(x + r * 0.48, y + ey + r * 0.15);
    ctx.stroke();
  } else {
    const blink = Math.sin(t * 0.9 + a.id * 1.7) > 0.985;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.32 + ex, y + ey, r * 0.24, blink ? r * 0.04 : r * 0.28, 0, 0, TAU);
    ctx.ellipse(x + r * 0.32 + ex, y + ey, r * 0.24, blink ? r * 0.04 : r * 0.28, 0, 0, TAU);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = "#14100c";
      ctx.beginPath();
      ctx.arc(x - r * 0.32 + ex * 1.5, y + ey + a.fy * r * 0.06, r * 0.13, 0, TAU);
      ctx.arc(x + r * 0.32 + ex * 1.5, y + ey + a.fy * r * 0.06, r * 0.13, 0, TAU);
      ctx.fill();
    }
    // Rosy cheeks for the little ones.
    if (baby) {
      ctx.fillStyle = "rgba(255,120,140,0.5)";
      ctx.beginPath();
      ctx.arc(x - r * 0.55, y + r * 0.3, r * 0.14, 0, TAU);
      ctx.arc(x + r * 0.55, y + r * 0.3, r * 0.14, 0, TAU);
      ctx.fill();
    }
  }

  // Tool in hand: spear-holders carry a spear, toolmakers an axe.
  if (!asleep && a.alive && !baby) {
    const hx = x + (a.fx >= 0 ? r * 0.95 : -r * 0.95);
    if (a.carryWood) {
      ctx.strokeStyle = "#7a4e26";
      ctx.lineWidth = 0.17;
      ctx.beginPath();
      ctx.moveTo(hx - 0.35, y - 0.25);
      ctx.lineTo(hx + 0.35, y + 0.3);
      ctx.stroke();
    } else if (a.techs & (1 << SPEAR)) {
      ctx.strokeStyle = "#6d4b2a";
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(hx, y + 0.45);
      ctx.lineTo(hx, y - 0.95);
      ctx.stroke();
      ctx.fillStyle = "#c9ccd2";
      ctx.beginPath();
      ctx.moveTo(hx - 0.1, y - 0.9);
      ctx.lineTo(hx, y - 1.2);
      ctx.lineTo(hx + 0.1, y - 0.9);
      ctx.fill();
    }
    if (a.carry > 0) {
      ctx.fillStyle = "#e8304f";
      ctx.beginPath();
      ctx.arc(x - (a.fx >= 0 ? r * 0.85 : -r * 0.85), y + 0.15, 0.17, 0, TAU);
      ctx.fill();
    }
    // Fishing line.
    if (a.act === A_FISH && a.phase === 1 && a.ti >= 0) {
      const rs = world.res[a.ti];
      if (rs) {
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(x, y - 0.3);
        ctx.quadraticCurveTo((x + rs.x) / 2, Math.min(y, rs.y) - 1.4, rs.x, rs.y + Math.sin(t * 5) * 0.06);
        ctx.stroke();
        ctx.fillStyle = "#ff5f5f";
        ctx.beginPath();
        ctx.arc(rs.x, rs.y + Math.sin(t * 5) * 0.06, 0.12, 0, TAU);
        ctx.fill();
      }
    }
    // Tinkering: little bonk sparks.
    if (a.act === A_PLAY && a.phase === 1 && Math.sin(t * 9 + a.id) > 0.6) {
      ctx.fillStyle = "rgba(255,240,200,0.9)";
      ctx.fillRect(hx - 0.06, y - 0.1, 0.12, 0.12);
      ctx.fillRect(hx + 0.12, y - 0.32, 0.08, 0.08);
    }
  }

  // Chief's crown.
  if (a.id === world.chief && a.alive) {
    const cy = y - r - 0.12;
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.moveTo(x - 0.42, cy + 0.12);
    ctx.lineTo(x - 0.45, cy - 0.32);
    ctx.lineTo(x - 0.2, cy - 0.08);
    ctx.lineTo(x, cy - 0.42);
    ctx.lineTo(x + 0.2, cy - 0.08);
    ctx.lineTo(x + 0.45, cy - 0.32);
    ctx.lineTo(x + 0.42, cy + 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#a8760e";
    ctx.lineWidth = 0.05;
    ctx.stroke();
    const gl = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * gl})`;
    ctx.fillRect(x - 0.05, cy - 0.38, 0.1, 0.1);
  }
  if (followed) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(x, y, r + 0.15, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawNeeds(ctx: CanvasRenderingContext2D, a: Agent, t: number, s: number): void {
  let need = -1;
  if (a.food < 0.16) need = 0;
  else if (a.warmth < 0.26) need = 1;
  else if (a.energy < 0.12 && !(a.act === A_SLEEP && a.phase === 1)) need = 2;
  const asleep = a.act === A_SLEEP && a.phase === 1;
  const minPx = 9;
  const sz = Math.max(0.42, minPx / s / 2);
  const x = a.x + 0.55;
  const y = a.y - 1.25 - Math.sin(t * 3 + a.id) * 0.08;
  if (asleep) {
    // Floating "z".
    const ph = (t * 0.5 + a.id * 0.13) % 1;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
    ctx.fillStyle = "#e7f0ff";
    ctx.font = `700 ${Math.max(0.6, 10 / s)}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("z", a.x + 0.4 + ph * 0.4, a.y - 0.7 - ph * 1.1);
    ctx.globalAlpha = 1;
    return;
  }
  if (need < 0) return;
  // Bubble.
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(x, y, sz * 1.15, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - sz * 0.5, y + sz * 0.8);
  ctx.lineTo(x - sz * 0.95, y + sz * 1.6);
  ctx.lineTo(x - sz * 0.05, y + sz * 1.05);
  ctx.fill();
  if (need === 0) {
    // Drumstick.
    ctx.fillStyle = "#c8682c";
    ctx.beginPath();
    ctx.ellipse(x + sz * 0.15, y - sz * 0.15, sz * 0.55, sz * 0.42, -0.7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#f2e6d0";
    ctx.lineWidth = sz * 0.22;
    ctx.beginPath();
    ctx.moveTo(x - sz * 0.15, y + sz * 0.15);
    ctx.lineTo(x - sz * 0.55, y + sz * 0.55);
    ctx.stroke();
  } else if (need === 1) {
    ctx.strokeStyle = "#3aa0e8";
    ctx.lineWidth = sz * 0.18;
    for (let k = 0; k < 3; k++) {
      const an = (k / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(an) * sz * 0.75, y - Math.sin(an) * sz * 0.75);
      ctx.lineTo(x + Math.cos(an) * sz * 0.75, y + Math.sin(an) * sz * 0.75);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#6a5acd";
    ctx.font = `700 ${sz * 1.5}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("z", x, y + sz * 0.5);
  }
}

function drawFx(ctx: CanvasRenderingContext2D, world: World, t: number): void {
  for (const f of world.fx) {
    const k = f.t / f.life;
    switch (f.kind) {
      case FX_STEAM: {
        for (let j = 0; j < 3; j++) {
          const kk = Math.min(1, k + j * 0.12);
          ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - kk)})`;
          ctx.beginPath();
          ctx.arc(f.x + Math.sin(kk * 6 + j) * 0.35, f.y - 0.6 - kk * 2.6, 0.25 + kk * 0.5, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case FX_BIRTH: {
        for (let j = 0; j < 6; j++) {
          const an = (j / 6) * TAU + t;
          const rr = 0.4 + k * 1.6;
          ctx.fillStyle = `rgba(255,170,210,${1 - k})`;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(an) * rr, f.y - 0.4 + Math.sin(an) * rr * 0.7 - k, 0.14, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case FX_SPLASH:
      case FX_FISH: {
        ctx.strokeStyle = `rgba(230,250,255,${0.8 * (1 - k)})`;
        ctx.lineWidth = 0.1;
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.ellipse(f.x, f.y + 0.2, 0.3 + (k + j * 0.3) * 1.4, (0.3 + (k + j * 0.3) * 1.4) * 0.5, 0, 0, TAU);
          ctx.stroke();
        }
        if (f.kind === FX_FISH) {
          // A fish flips out of the water.
          ctx.save();
          ctx.translate(f.x, f.y - Math.sin(k * Math.PI) * 1.6);
          ctx.rotate(k * 5);
          ctx.fillStyle = "#9fe3ff";
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.35, 0.16, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case FX_BUILD: {
        for (let j = 0; j < 5; j++) {
          const an = j * 1.3;
          ctx.fillStyle = `rgba(200,170,120,${0.6 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(an) * k * 1.4, f.y + 0.4 + Math.sin(an) * k * 0.6 - k * 0.4, 0.25 * (1 - k) + 0.05, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case FX_CRATE: {
        ctx.strokeStyle = `rgba(255,230,160,${1 - k})`;
        ctx.lineWidth = 0.15;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y + 0.4, k * 3, k * 1.6, 0, 0, TAU);
        ctx.stroke();
        break;
      }
      case FX_DISCOVER: {
        const def = TECHS[f.tech]!;
        ctx.globalCompositeOperation = "lighter";
        for (let j = 0; j < 12; j++) {
          const an = (j / 12) * TAU + k;
          const r0 = 0.6 + k * 1.5;
          const r1 = r0 + 1.4 * (1 - k);
          ctx.strokeStyle = def.color;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 0.16;
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(an) * r0, f.y + Math.sin(an) * r0);
          ctx.lineTo(f.x + Math.cos(an) * r1, f.y + Math.sin(an) * r1);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case FX_ELECT: {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = "#ffd34d";
        ctx.lineWidth = 0.15;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 0.8 + k * 3, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

/** Teaching arcs and floating tech glyphs drawn above the night overlay. */
function drawTeachOverlay(ctx: CanvasRenderingContext2D, world: World, s: number): void {
  for (const f of world.fx) {
    if (f.kind !== FX_TEACH && f.kind !== FX_DISCOVER) continue;
    const k = f.t / f.life;
    const def = TECHS[f.tech];
    if (!def) continue;
    if (f.kind === FX_TEACH) {
      const mx = (f.x + f.x2) / 2;
      const my = (f.y + f.y2) / 2 - 1.6 - Math.hypot(f.x2 - f.x, f.y2 - f.y) * 0.25;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.lineWidth = Math.max(0.12, 2.2 / s);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y - 0.4);
      ctx.quadraticCurveTo(mx, my, f.x2, f.y2 - 0.4);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.3, 6 / s);
      ctx.globalAlpha = 0.25 * (1 - k);
      ctx.stroke();
      // Travelling spark.
      const u = Math.min(1, k * 2.2);
      const px = (1 - u) * (1 - u) * f.x + 2 * (1 - u) * u * mx + u * u * f.x2;
      const py = (1 - u) * (1 - u) * (f.y - 0.4) + 2 * (1 - u) * u * my + u * u * (f.y2 - 0.4);
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.16, 2.5 / s), 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // Glyph rising over the learner.
      ctx.globalAlpha = Math.min(1, (1 - k) * 2);
      const gy = f.y2 - 1.7 - k * 1.2;
      const gr = Math.max(0.55, 8 / s);
      ctx.fillStyle = "rgba(8,16,24,0.82)";
      ctx.beginPath();
      ctx.arc(f.x2, gy, gr * 1.25, 0, TAU);
      ctx.fill();
      drawTechIcon(ctx, f.tech, f.x2, gy, gr * 0.85, def.color);
      ctx.globalAlpha = 1;
    } else {
      // Discovery: big glyph above the inventor.
      const a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const gr = Math.max(0.9, 14 / s);
      const gy = f.y - 2.4 - k * 1.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(8,16,24,0.85)";
      ctx.beginPath();
      ctx.arc(f.x, gy, gr * 1.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = Math.max(0.1, 2 / s);
      ctx.stroke();
      drawTechIcon(ctx, f.tech, f.x, gy, gr * 0.9, def.color);
      ctx.globalAlpha = 1;
    }
  }
}

function drawSky(ctx: CanvasRenderingContext2D, world: World, xf: ViewXf, o: DrawOpts): void {
  const { rect, s } = xf;
  const dark = world.darkness * nightScale;
  const tod = world.tod;
  // Warm dusk / pink dawn wash.
  let warm = 0;
  if (tod > 0.6 && tod < 0.86) warm = Math.sin(((tod - 0.6) / 0.26) * Math.PI);
  let dawn = 0;
  if (tod < 0.12) dawn = Math.sin((tod / 0.12) * Math.PI) * 0.8;
  if (warm > 0) {
    ctx.fillStyle = `rgba(255,120,40,${0.2 * warm})`;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  if (dawn > 0) {
    ctx.fillStyle = `rgba(255,150,170,${0.14 * dawn})`;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  const lights: { x: number; y: number; r: number; k: number; warmth: number }[] = [];
  for (const st of world.structs) {
    if ((st.kind === S_FIRE && st.progress >= 1 && st.fuel > 0) || (st.kind === S_WILDFIRE && st.fuel > 0)) {
      const fl = 1 + Math.sin(o.time * 11 + st.x) * 0.04 + Math.sin(o.time * 17 + st.y) * 0.03;
      lights.push({ x: st.x, y: st.y, r: (st.kind === S_WILDFIRE ? 13 : 8.5) * (0.6 + 0.4 * Math.min(1, st.fuel * 1.5)) * fl, k: 1, warmth: 1 });
    } else if (st.kind === S_HUT && st.progress >= 1 && st.occ > 0) {
      lights.push({ x: st.x, y: st.y + 0.4, r: 2.6, k: 0.8, warmth: 0.6 });
    } else if (st.kind === S_WORKSHOP && st.progress >= 1) {
      lights.push({ x: st.x, y: st.y, r: 3.2, k: 0.7, warmth: 0.6 });
    }
  }
  if (dark > 0.01) {
    const q = o.quality;
    const nc = nightCtx(rect.w * q, rect.h * q);
    nc.setTransform(1, 0, 0, 1, 0, 0);
    nc.globalCompositeOperation = "source-over";
    nc.clearRect(0, 0, nc.canvas.width, nc.canvas.height);
    const winter = world.snow;
    nc.fillStyle = `rgba(${8 + winter * 10},${16 + winter * 14},${52 + winter * 20},${0.52 * dark})`;
    nc.fillRect(0, 0, nc.canvas.width, nc.canvas.height);
    nc.globalCompositeOperation = "destination-out";
    for (const l of lights) {
      const px = (xf.ox + l.x * s - rect.x) * q;
      const py = (xf.oy + l.y * s - rect.y) * q;
      const rr = l.r * s * q;
      const g = nc.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(0,0,0,${0.95 * l.k})`);
      g.addColorStop(0.45, `rgba(0,0,0,${0.6 * l.k})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      nc.fillStyle = g;
      nc.beginPath();
      nc.arc(px, py, rr, 0, TAU);
      nc.fill();
    }
    ctx.drawImage(nc.canvas, 0, 0, nc.canvas.width, nc.canvas.height, rect.x, rect.y, rect.w, rect.h);
  }
  // Additive firelight glow (strongest at night, faint by day).
  ctx.globalCompositeOperation = "lighter";
  for (const l of lights) {
    const px = xf.ox + l.x * s;
    const py = xf.oy + l.y * s;
    const rr = l.r * s * 0.75;
    const a = (0.08 + 0.32 * dark) * l.warmth;
    const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, `rgba(255,150,60,${a})`);
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rr, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  // Vignette, deeper at night.
  {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const R = Math.hypot(rect.w, rect.h) / 2;
    const g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(2,6,16,${0.28 + dark * 0.4})`);
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  // Falling snow.
  const snow = world.snow;
  if (snow > 0.12) {
    const n = Math.floor(flakes.length * Math.min(1, snow));
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < n; i++) {
      const f = flakes[i]!;
      const yy = (f.y + o.time * f.v) % 1;
      const xx = (f.x + Math.sin(o.time * 0.7 + i) * 0.01 + o.time * 0.008) % 1;
      ctx.globalAlpha = 0.5 + 0.5 * (f.s / 2.2);
      ctx.beginPath();
      ctx.arc(rect.x + xx * rect.w, rect.y + yy * rect.h, f.s, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Lightning: bolt + white flash.
  for (const f of world.fx) {
    if (f.kind !== FX_LIGHTNING) continue;
    const k = f.t / f.life;
    if (k < 0.5) {
      const flash = Math.max(0, 1 - k * 3);
      ctx.fillStyle = `rgba(235,245,255,${0.75 * flash})`;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    const px = xf.ox + f.x * s;
    const py = xf.oy + f.y * s;
    if (k < 0.55) {
      ctx.globalAlpha = 1 - k / 0.55;
      ctx.strokeStyle = "#ffffff";
      ctx.shadowColor = "#9fd7ff";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      let x = px + (((f.x * 7) % 1) - 0.5) * 60;
      let y = rect.y;
      ctx.moveTo(x, y);
      const steps = 9;
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        const jit = Math.sin(i * 12.9898 + f.x * 78.233) * 43758.5453;
        const j = (jit - Math.floor(jit) - 0.5) * 34 * (1 - u);
        x = x + (px - x) * (1 / (steps - i + 1)) + j;
        y = rect.y + (py - rect.y) * u;
        ctx.lineTo(i === steps ? px : x, y);
      }
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#e8f6ff";
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
}
