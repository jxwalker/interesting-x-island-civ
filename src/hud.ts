import { drawTechIcon } from "./render";
import {
  ACTION_LABEL,
  FORAGE,
  NTECH,
  POP_CAP,
  TECHS,
  popcount,
  type LogEntry,
  type Sample,
  type World,
} from "./sim";

const TAU = Math.PI * 2;
export const COL_ON = "#5ee0ff";
export const COL_OFF = "#ff7a59";

export function fitCanvas(canvas: HTMLCanvasElement, dpr: number): { w: number; h: number; ctx: CanvasRenderingContext2D } {
  const w = Math.max(1, canvas.clientWidth);
  const h = Math.max(1, canvas.clientHeight);
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, ctx };
}

// ===================================================================== tech tree

export interface TreeState {
  /** Wall-clock time each tech was last discovered (for a pulse). */
  litAt: number[];
  prevKnown: number;
}

export function makeTreeState(): TreeState {
  return { litAt: new Array(NTECH).fill(-99), prevKnown: 0 };
}

export function drawTechTree(canvas: HTMLCanvasElement, dpr: number, world: World, twin: World | null, st: TreeState, time: number): void {
  const { w, h, ctx } = fitCanvas(canvas, dpr);
  ctx.clearRect(0, 0, w, h);
  const known = world.known;
  for (let t = 0; t < NTECH; t++) {
    if (known & (1 << t) && !(st.prevKnown & (1 << t))) st.litAt[t] = time;
  }
  st.prevKnown = known;
  const padX = 30;
  const padTop = 14;
  const padBot = 22;
  const cols = 5;
  const rows = 3;
  const px = (c: number): number => padX + (c / cols) * (w - padX * 2);
  const py = (r: number): number => padTop + (r / rows) * (h - padTop - padBot);
  const R = Math.max(8, Math.min(12, (w - padX * 2) / cols / 3.6, (h - padTop - padBot) / rows / 3.1));
  const pop = Math.max(1, world.alivePop());

  // Edges.
  for (const d of TECHS) {
    for (let p = 0; p < NTECH; p++) {
      if (!(d.prereq & (1 << p))) continue;
      const a = TECHS[p]!;
      const x0 = px(a.col);
      const y0 = py(a.row);
      const x1 = px(d.col);
      const y1 = py(d.row);
      const lit = known & (1 << d.id) && known & (1 << p);
      ctx.strokeStyle = lit ? d.color : "rgba(138,163,184,0.22)";
      ctx.globalAlpha = lit ? 0.7 : 1;
      ctx.lineWidth = lit ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(x0 + R, y0);
      const mx = (x0 + x1) / 2;
      ctx.bezierCurveTo(mx, y0, mx, y1, x1 - R, y1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Nodes.
  ctx.textAlign = "center";
  for (const d of TECHS) {
    const x = px(d.col);
    const y = py(d.row);
    const isKnown = (known & (1 << d.id)) !== 0;
    const lost = !isKnown && (world.everKnown & (1 << d.id)) !== 0;
    const frac = world.techCount[d.id]! / pop;
    const pulse = Math.max(0, 1 - (time - st.litAt[d.id]!) / 2.2);
    if (pulse > 0) {
      ctx.strokeStyle = d.color;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, R + (1 - pulse) * 14, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (isKnown) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.9);
      g.addColorStop(0, hexA(d.color, 0.32));
      g.addColorStop(1, hexA(d.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R * 1.9, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#0a1520";
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    // Track + share-of-population arc.
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = "rgba(138,163,184,0.2)";
    ctx.setLineDash(lost ? [2, 3] : []);
    if (lost) ctx.strokeStyle = "rgba(255,107,74,0.7)";
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (frac > 0) {
      ctx.strokeStyle = d.color;
      ctx.beginPath();
      ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, frac));
      ctx.stroke();
    }
    if (twin) {
      const f2 = twin.techCount[d.id]! / Math.max(1, twin.alivePop());
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(138,163,184,0.15)";
      ctx.beginPath();
      ctx.arc(x, y, R - 4, 0, TAU);
      ctx.stroke();
      if (f2 > 0) {
        ctx.strokeStyle = COL_OFF;
        ctx.beginPath();
        ctx.arc(x, y, R - 4, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, f2));
        ctx.stroke();
      }
    }
    drawTechIcon(ctx, d.id, x, y, R * 0.55, isKnown ? d.color : lost ? "rgba(255,140,110,0.6)" : "rgba(138,163,184,0.45)");
    const label = d.name === "Stone tools" ? "Tools" : d.name === "Storytelling" ? "Stories" : d.name;
    const pct = lost ? "lost" : d.id === FORAGE ? "all" : `${Math.round(frac * 100)}%`;
    ctx.font = `600 9px "Space Grotesk", sans-serif`;
    const lw = ctx.measureText(label + " ").width;
    ctx.font = `600 8.5px "IBM Plex Mono", monospace`;
    const pw = ctx.measureText(pct).width;
    const lx = x - (lw + pw) / 2;
    ctx.textAlign = "left";
    ctx.font = `600 9px "Space Grotesk", sans-serif`;
    ctx.fillStyle = isKnown ? "#e8f0f5" : "rgba(138,163,184,0.75)";
    ctx.fillText(label, lx, y + R + 10);
    ctx.font = `600 8.5px "IBM Plex Mono", monospace`;
    ctx.fillStyle = lost ? "#ff8a6a" : isKnown ? hexA(d.color, 0.95) : "rgba(138,163,184,0.5)";
    ctx.fillText(pct, lx + lw, y + R + 10);
    ctx.textAlign = "center";
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ===================================================================== sparkline

export function drawSparkline(canvas: HTMLCanvasElement, dpr: number, hist: Sample[]): void {
  const { w, h, ctx } = fitCanvas(canvas, dpr);
  ctx.clearRect(0, 0, w, h);
  if (hist.length < 2) return;
  const d0 = hist[0]!.day;
  const d1 = Math.max(d0 + 1, hist[hist.length - 1]!.day);
  const padR = 64;
  const X = (d: number): number => 2 + ((d - d0) / (d1 - d0)) * (w - padR - 4);
  const plot = (val: (s: Sample) => number, max: number, color: string, fill: boolean): void => {
    ctx.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const s = hist[i]!;
      const y = h - 4 - (val(s) / max) * (h - 10);
      if (i === 0) ctx.moveTo(X(s.day), y);
      else ctx.lineTo(X(s.day), y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (fill) {
      ctx.lineTo(X(hist[hist.length - 1]!.day), h);
      ctx.lineTo(X(d0), h);
      ctx.closePath();
      ctx.fillStyle = hexA(color, 0.1);
      ctx.fill();
    }
  };
  ctx.strokeStyle = "rgba(138,163,184,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - 4);
  ctx.lineTo(w - padR, h - 4);
  ctx.stroke();
  plot((s) => s.pop, POP_CAP, "#5eead4", true);
  plot((s) => s.techs, NTECH, "#fbbf24", false);
  const last = hist[hist.length - 1]!;
  ctx.font = `600 10px "IBM Plex Mono", monospace`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#cfe0ea";
  const yp = h - 4 - (last.pop / POP_CAP) * (h - 10);
  const yt = h - 4 - (last.techs / NTECH) * (h - 10);
  let a = yp;
  let b = yt;
  if (Math.abs(a - b) < 11) {
    if (a < b) b = a + 11;
    else a = b + 11;
  }
  ctx.fillStyle = "#5eead4";
  ctx.fillRect(w - padR + 4, Math.min(h - 6, Math.max(6, a)) - 4, 6, 2);
  ctx.fillStyle = "#cfe0ea";
  ctx.fillText(`pop ${last.pop}`, w - padR + 13, Math.min(h - 2, Math.max(9, a + 3)));
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(w - padR + 4, Math.min(h - 6, Math.max(6, b)) - 4, 6, 2);
  ctx.fillStyle = "#cfe0ea";
  ctx.fillText(`techs ${last.techs}`, w - padR + 13, Math.min(h - 2, Math.max(9, b + 3)));
}

// ===================================================================== race chart

export function drawRace(canvas: HTMLCanvasElement, dpr: number, a: World, b: World, labelA: string, labelB: string): void {
  const { w, h, ctx } = fitCanvas(canvas, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(6,14,22,0.82)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,190,210,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  const padL = 26;
  const padR = 92;
  const padT = 22;
  const padB = 18;
  const ha = a.history;
  const hb = b.history;
  const dMax = Math.max(4, ha.length ? ha[ha.length - 1]!.day : 0, hb.length ? hb[hb.length - 1]!.day : 0);
  const X = (d: number): number => padL + (d / dMax) * (w - padL - padR);
  const Y = (v: number): number => h - padB - (v / NTECH) * (h - padT - padB);
  ctx.font = `600 10px "Space Grotesk", sans-serif`;
  ctx.fillStyle = "#cfe0ea";
  ctx.textAlign = "left";
  ctx.fillText("The cultural ratchet — techs known per head (solid) · on island (faint)", 10, 14);
  // Grid.
  ctx.font = `500 9px "IBM Plex Mono", monospace`;
  ctx.fillStyle = "rgba(138,163,184,0.7)";
  ctx.textAlign = "right";
  for (const v of [0, 5, 10]) {
    ctx.strokeStyle = "rgba(138,163,184,0.12)";
    ctx.beginPath();
    ctx.moveTo(padL, Y(v));
    ctx.lineTo(w - padR, Y(v));
    ctx.stroke();
    ctx.fillText(String(v), padL - 5, Y(v) + 3);
  }
  ctx.textAlign = "center";
  ctx.fillText(`day ${Math.floor(dMax)}`, w - padR, h - 5);
  ctx.fillText("0", padL, h - 5);
  const line = (hist: Sample[], key: "avg" | "techs", color: string, width: number, alpha: number): number => {
    if (hist.length < 1) return 0;
    ctx.beginPath();
    for (let i = 0; i < hist.length; i++) {
      const s = hist[i]!;
      const x = X(s.day);
      const y = Y(s[key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
    return Y(hist[hist.length - 1]![key]);
  };
  line(ha, "techs", COL_ON, 1.5, 0.35);
  line(hb, "techs", COL_OFF, 1.5, 0.35);
  let ya = line(ha, "avg", COL_ON, 2.4, 1);
  let yb = line(hb, "avg", COL_OFF, 2.4, 1);
  // End markers + direct labels (nudged apart).
  const ex = w - padR;
  const lastA = ha[ha.length - 1];
  const lastB = hb[hb.length - 1];
  for (const [y, c, l] of [[ya, COL_ON, lastA], [yb, COL_OFF, lastB]] as const) {
    if (!l) continue;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(X(l.day), y, 3.5, 0, TAU);
    ctx.fill();
  }
  if (Math.abs(ya - yb) < 22) {
    const mid = (ya + yb) / 2;
    if (ya <= yb) {
      ya = mid - 11;
      yb = mid + 11;
    } else {
      ya = mid + 11;
      yb = mid - 11;
    }
  }
  ctx.textAlign = "left";
  const lab = (y: number, color: string, name: string, s: Sample | undefined): void => {
    if (!s) return;
    ctx.fillStyle = color;
    ctx.fillRect(ex + 6, y - 5, 3, 10);
    ctx.font = `700 9.5px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "#e8f0f5";
    ctx.fillText(name, ex + 13, y - 1);
    ctx.font = `500 9px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "#cfe0ea";
    ctx.fillText(`${s.avg.toFixed(1)}/head · ${s.techs}`, ex + 13, y + 9);
  };
  lab(Math.max(padT + 4, Math.min(h - padB, ya)), COL_ON, labelA, lastA);
  lab(Math.max(padT + 4, Math.min(h - padB, yb)), COL_OFF, labelB, lastB);
}

// ===================================================================== event log

export function renderLog(el: HTMLElement, log: LogEntry[], stamp: { n: number; last: LogEntry | null }): void {
  const last = log[log.length - 1] ?? null;
  if (stamp.last === last && stamp.n === log.length) return;
  stamp.last = last;
  stamp.n = log.length;
  const items: string[] = [];
  for (let i = log.length - 1, k = 0; i >= 0 && k < 30; i--, k++) {
    const e = log[i]!;
    items.push(`<li class="ev ev-${e.kind}${k === 0 ? " ev-new" : ""}"><span class="ev-day">Day ${e.day}</span><span class="ev-text">${escapeHtml(e.text)}</span></li>`);
  }
  el.innerHTML = items.join("");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// ===================================================================== follow card

export function renderFollow(el: HTMLElement, world: World, id: number): boolean {
  const a = world.agentById(id);
  if (!a) {
    return false;
  }
  const bar = (label: string, v: number, cls: string): string =>
    `<div class="need"><span class="need-k">${label}</span><span class="need-bar"><i class="${cls}" style="width:${Math.round(v * 100)}%"></i></span></div>`;
  const techs: string[] = [];
  for (let t = 0; t < NTECH; t++) {
    if (!(a.techs & (1 << t))) continue;
    const d = TECHS[t]!;
    const src = a.src[t];
    const how = src === "invented" ? `<b class="inv">invented</b>` : src === "instinct" ? "instinct" : `taught by ${escapeHtml(src ?? "?")}`;
    techs.push(`<li><span class="tg" style="color:${d.color}">${d.glyph}</span>${d.name}<span class="src">${how}</span></li>`);
  }
  const roles: string[] = [];
  if (a.id === world.chief) roles.push("👑 chief");
  if (a.taught >= 3) roles.push(`✨ teacher of ${a.taught}`);
  if (a.age < 2.5) roles.push("🍼 newborn");
  else if (a.age > a.lifespan * 0.8) roles.push("elder");
  const known = a.mem.reduce((s, v) => s + v, 0);
  const status = a.alive ? ACTION_LABEL[a.act] ?? "" : `died of ${a.cause}`;
  el.innerHTML = `
    <div class="fc-head">
      <span class="fc-dot" style="background:hsl(${a.hue.toFixed(0)},68%,62%)"></span>
      <span class="fc-name">${escapeHtml(a.name)}</span>
      <span class="fc-age">age ${a.age.toFixed(1)} d</span>
      <button type="button" class="fc-close" id="fc-close" aria-label="Stop following">×</button>
    </div>
    <div class="fc-status">${status}${roles.length ? " · " + roles.join(" · ") : ""}</div>
    ${bar("food", a.food, "n-food")}${bar("warm", a.warmth, "n-warm")}${bar("energy", a.energy, "n-energy")}
    <ul class="fc-techs">${techs.join("")}</ul>
    <div class="fc-foot">remembers ${known} places · ${popcount(a.techs)}/${NTECH} techs · ${a.children} kids</div>`;
  return true;
}
