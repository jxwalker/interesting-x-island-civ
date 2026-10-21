import "./styles.css";
import {
  COL_OFF,
  COL_ON,
  drawRace,
  drawSparkline,
  drawTechTree,
  makeTreeState,
  renderFollow,
  renderLog,
} from "./hud";
import { drawIsland, makeXf, toWorld, type Cam, type Rect, type ViewXf } from "./render";
import { DAY, DT, TECHS, World, runSelfTest, type Check } from "./sim";
import { H, W, generateTerrain, regionAt, type Terrain } from "./terrain";

declare global {
  interface Window {
    __islandSelfTest?: () => Promise<{ ok: boolean; checks: Check[]; ms: number }>;
    __island?: Record<string, unknown>;
  }
}

const CREDIT_URL = "https://x.com/Blackwellboy/status/2105850448951578714";
const DEFAULT_SEED = 20261016;
const RECORD_SEED = 20261017;
const DEFAULT_SPEED = 3;
const TWIN_SPEED = 20;
const MAX_STEPS_PER_FRAME = 420;

type GiftType = "lightning" | "food" | "stone";

function mustEl<T extends HTMLElement>(root: ParentNode, selector: string, ctor: new () => T): T {
  const el = root.querySelector(selector);
  if (!(el instanceof ctor)) throw new Error(`Missing or wrong element: ${selector}`);
  return el;
}

function setText(el: HTMLElement, next: string): void {
  if (el.textContent !== next) el.textContent = next;
}

function harshLabel(v: number): string {
  if (v < 0.2) return "mild";
  if (v < 0.45) return "temperate";
  if (v < 0.75) return "harsh";
  return "brutal";
}

function teachLabel(v: number): string {
  if (v <= 0.001) return "teaching off";
  return `teaching ${v.toFixed(2)}`;
}

function partOfDay(tod: number): string {
  if (tod < 0.04) return "dawn";
  if (tod < 0.3) return "morning";
  if (tod < 0.5) return "midday";
  if (tod < 0.68) return "afternoon";
  if (tod < 0.8) return "dusk";
  return "night";
}

function mount(): void {
  const root = document.getElementById("app");
  if (!(root instanceof HTMLElement)) throw new Error("Missing #app");
  const params = new URLSearchParams(window.location.search);
  const recordMode = params.has("record");
  if (recordMode) document.documentElement.classList.add("ix-record");
  const seedParam = Number(params.get("seed"));
  let seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : recordMode ? RECORD_SEED : DEFAULT_SEED;

  root.innerHTML = `
    <div class="grain" aria-hidden="true"></div>
    <div class="wash" aria-hidden="true"></div>

    <header class="hero">
      <div class="hero-row">
        <p class="brand">Interesting X</p>
        <h1 class="title">Island civilization sim</h1>
      </div>
      <p class="hint">
        <span class="hint-dot" aria-hidden="true"></span>
        <span id="hint">Watch them discover fire and teach it — then turn teaching off and see culture stall.</span>
      </p>
    </header>

    <main class="layout">
      <section class="stage" id="stage" aria-label="The island">
        <canvas id="canvas" role="img" aria-label="A top-down island where small creatures forage, discover techs, teach each other, build huts and elect chiefs. Click a creature to follow it."></canvas>
        <div class="stage-chip" id="stage-chip" aria-live="off">Day 1 · spring · morning</div>
        <div class="stage-help" id="stage-help" aria-hidden="true">click a creature to follow</div>
        <div class="follow-card" id="follow-card" hidden aria-live="polite"></div>
        <canvas id="race-chart" class="race-chart" hidden aria-label="Race chart: techs per head on the teaching island versus the no-teaching island"></canvas>
      </section>

      <aside class="panel" aria-label="Controls and island statistics">
        <div class="controls">
          <div class="row-2">
            <div class="field">
              <div class="field-head"><label for="speed">Speed</label><span id="speed-val" class="val">${DEFAULT_SPEED}×</span></div>
              <input id="speed" type="range" min="1" max="20" step="1" value="${DEFAULT_SPEED}" />
            </div>
            <button type="button" class="btn btn-pause" id="btn-pause" aria-pressed="false">Pause</button>
          </div>
          <div class="field">
            <div class="field-head"><label for="teach">Teaching <span class="unit">off → wildfire</span></label><span id="teach-val" class="val val-amber">teaching 0.40</span></div>
            <input id="teach" type="range" min="0" max="1" step="0.01" value="0.4" />
          </div>
          <div class="field">
            <div class="field-head"><label for="harsh">Season harshness <span class="unit">mild → brutal</span></label><span id="harsh-val" class="val val-ice">temperate</span></div>
            <input id="harsh" type="range" min="0" max="1" step="0.01" value="0.35" />
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-primary" id="btn-new">New island</button>
            <button type="button" class="btn btn-gift" id="btn-gift" aria-pressed="false">Drop a gift</button>
            <select id="gift-type" aria-label="Gift type">
              <option value="lightning" selected>⚡ Lightning</option>
              <option value="food">🍓 Food crate</option>
              <option value="stone">🪨 Flint crate</option>
            </select>
          </div>
          <details class="adv" id="advanced">
            <summary>Advanced · the cultural ratchet</summary>
            <div class="adv-body">
              <button type="button" class="btn btn-twin" id="btn-twin" aria-pressed="false">Twin islands</button>
              <div class="twin-sliders">
                <div class="field">
                  <div class="field-head"><label for="teach-left">Left <span class="unit" style="color:${COL_ON}">on</span></label><span id="teach-left-val" class="val">0.60</span></div>
                  <input id="teach-left" type="range" min="0" max="1" step="0.01" value="0.6" />
                </div>
                <div class="field">
                  <div class="field-head"><label for="teach-right">Right <span class="unit" style="color:${COL_OFF}">off</span></label><span id="teach-right-val" class="val val-coral">0.00</span></div>
                  <input id="teach-right" type="range" min="0" max="1" step="0.01" value="0" />
                </div>
              </div>
              <p class="adv-note">Identical seed, terrain and creatures — only the teaching rate differs.</p>
            </div>
          </details>
        </div>

        <div class="stats" aria-live="off">
          <div class="stat"><span class="stat-k">Population</span><span class="stat-v v-teal" id="stat-pop">—</span></div>
          <div class="stat"><span class="stat-k">Day</span><span class="stat-v" id="stat-day">1</span></div>
          <div class="stat"><span class="stat-k">Techs known</span><span class="stat-v v-amber" id="stat-techs">1 / 10</span></div>
        </div>

        <div class="card card-tree">
          <div class="card-head">
            <span class="card-title">Tech tree <span class="unit">ring = share who know it</span></span>
            <span class="legend" id="tree-legend"></span>
          </div>
          <canvas id="tech-tree" aria-label="Tech tree with the share of the population knowing each tech"></canvas>
        </div>

        <div class="card card-log">
          <div class="card-head">
            <span class="card-title">Chronicle</span>
            <span class="legend"><i class="lg-pop"></i>pop<i class="lg-tech"></i>techs</span>
          </div>
          <canvas id="sparkline" aria-label="Population and tech count over time"></canvas>
          <ul class="event-log" id="event-log" aria-live="polite"></ul>
        </div>

        <p class="credit${recordMode ? " record-hide" : ""}">
          Agent-based: needs, utility AI, stochastic invention, teaching, forgetting, chiefs — no LLMs. Inspired by
          <a href="${CREDIT_URL}" target="_blank" rel="noreferrer">Little Chits by @Blackwellboy</a>.
        </p>
      </aside>
    </main>
  `;

  const stage = mustEl(root, "#stage", HTMLElement);
  const canvas = mustEl(root, "#canvas", HTMLCanvasElement);
  const ctx = canvas.getContext("2d")!;
  const chip = mustEl(root, "#stage-chip", HTMLElement);
  const stageHelp = mustEl(root, "#stage-help", HTMLElement);
  const followCard = mustEl(root, "#follow-card", HTMLElement);
  const raceCanvas = mustEl(root, "#race-chart", HTMLCanvasElement);
  const speedIn = mustEl(root, "#speed", HTMLInputElement);
  const speedVal = mustEl(root, "#speed-val", HTMLElement);
  const btnPause = mustEl(root, "#btn-pause", HTMLButtonElement);
  const teachIn = mustEl(root, "#teach", HTMLInputElement);
  const teachVal = mustEl(root, "#teach-val", HTMLElement);
  const harshIn = mustEl(root, "#harsh", HTMLInputElement);
  const harshVal = mustEl(root, "#harsh-val", HTMLElement);
  const btnNew = mustEl(root, "#btn-new", HTMLButtonElement);
  const btnGift = mustEl(root, "#btn-gift", HTMLButtonElement);
  const giftSel = mustEl(root, "#gift-type", HTMLSelectElement);
  const advanced = mustEl(root, "#advanced", HTMLDetailsElement);
  const btnTwin = mustEl(root, "#btn-twin", HTMLButtonElement);
  const teachLeft = mustEl(root, "#teach-left", HTMLInputElement);
  const teachLeftVal = mustEl(root, "#teach-left-val", HTMLElement);
  const teachRight = mustEl(root, "#teach-right", HTMLInputElement);
  const teachRightVal = mustEl(root, "#teach-right-val", HTMLElement);
  const statPop = mustEl(root, "#stat-pop", HTMLElement);
  const statDay = mustEl(root, "#stat-day", HTMLElement);
  const statTechs = mustEl(root, "#stat-techs", HTMLElement);
  const treeCanvas = mustEl(root, "#tech-tree", HTMLCanvasElement);
  const treeLegend = mustEl(root, "#tree-legend", HTMLElement);
  const spark = mustEl(root, "#sparkline", HTMLCanvasElement);
  const logEl = mustEl(root, "#event-log", HTMLElement);

  if (window.matchMedia("(min-width: 960px)").matches) advanced.open = true;

  // ------------------------------------------------------------------ state
  let terrain: Terrain = generateTerrain(seed, true);
  const settings = () => ({ teach: Number(teachIn.value), harsh: Number(harshIn.value) });
  let worlds: World[] = [new World(seed, settings(), { terrain })];
  let twin = false;
  let speed = DEFAULT_SPEED;
  let paused = false;
  let followId = -1;
  let giftArmed = false;
  let acc = 0;
  const cams: Cam[] = [
    { cx: W / 2, cy: H / 2, zoom: 1 },
    { cx: W / 2, cy: H / 2, zoom: 1 },
  ];
  let xfs: ViewXf[] = [];
  let ripple: { x: number; y: number; t: number } | null = null;
  let banner: { text: string; tech: number; t: number } | null = null;
  let bannerSeen = 0;
  const tree = makeTreeState();
  const logStamp = { n: -1, last: null as World["log"][number] | null };
  const frameTimes: number[] = [];

  const resetBannerWatch = (): void => {
    bannerSeen = worlds[0]!.log.length;
    banner = null;
  };

  function newIsland(nextSeed: number, withRipple: boolean): void {
    seed = nextSeed >>> 0;
    terrain = generateTerrain(seed, true);
    if (twin) {
      worlds = [
        new World(seed, { teach: Number(teachLeft.value), harsh: Number(harshIn.value) }, { terrain }),
        new World(seed, { teach: Number(teachRight.value), harsh: Number(harshIn.value) }, { terrain }),
      ];
    } else {
      worlds = [new World(seed, settings(), { terrain })];
    }
    followId = -1;
    acc = 0;
    tree.prevKnown = worlds[0]!.known;
    logStamp.n = -1;
    resetBannerWatch();
    if (withRipple) ripple = { x: sizes.w / 2, y: sizes.h / 2, t: 0 };
  }

  // ------------------------------------------------------------------ controls
  const syncSpeed = (): void => {
    speed = Number(speedIn.value);
    setText(speedVal, `${speed}×`);
  };
  speedIn.addEventListener("input", syncSpeed);

  const syncPause = (): void => {
    setText(btnPause, paused ? "Play" : "Pause");
    btnPause.setAttribute("aria-pressed", String(paused));
    btnPause.classList.toggle("is-paused", paused);
  };
  btnPause.addEventListener("click", () => {
    paused = !paused;
    syncPause();
  });

  const syncTeach = (): void => {
    const v = Number(teachIn.value);
    setText(teachVal, teachLabel(v));
    if (twin) {
      teachLeft.value = String(v);
      syncTwinTeach();
    } else {
      worlds[0]!.settings.teach = v;
    }
  };
  teachIn.addEventListener("input", syncTeach);

  const syncHarsh = (): void => {
    const v = Number(harshIn.value);
    setText(harshVal, harshLabel(v));
    for (const w of worlds) w.settings.harsh = v;
  };
  harshIn.addEventListener("input", syncHarsh);

  const syncTwinTeach = (): void => {
    const l = Number(teachLeft.value);
    const r = Number(teachRight.value);
    setText(teachLeftVal, l.toFixed(2));
    setText(teachRightVal, r.toFixed(2));
    if (twin) {
      worlds[0]!.settings.teach = l;
      worlds[1]!.settings.teach = r;
    }
  };
  teachLeft.addEventListener("input", syncTwinTeach);
  teachRight.addEventListener("input", syncTwinTeach);

  btnNew.addEventListener("click", () => {
    const next = recordMode ? seed + 1 : (Math.random() * 0xffffffff) >>> 0;
    newIsland(next, true);
  });

  const syncGift = (): void => {
    btnGift.classList.toggle("is-armed", giftArmed);
    btnGift.setAttribute("aria-pressed", String(giftArmed));
    setText(btnGift, giftArmed ? "Click the map…" : "Drop a gift");
    canvas.classList.toggle("gift-armed", giftArmed);
    setText(stageHelp, giftArmed ? `click the island to drop ${giftSel.value === "lightning" ? "lightning" : "a crate"}` : "click a creature to follow");
  };
  btnGift.addEventListener("click", () => {
    giftArmed = !giftArmed;
    syncGift();
  });
  giftSel.addEventListener("change", () => {
    giftArmed = true;
    syncGift();
  });

  const setTwin = (on: boolean): void => {
    twin = on;
    btnTwin.setAttribute("aria-pressed", String(on));
    btnTwin.classList.toggle("is-on", on);
    setText(btnTwin, on ? "Back to one island" : "Twin islands");
    raceCanvas.hidden = !on;
    stage.classList.toggle("is-twin", on);
    if (on) {
      teachIn.value = teachLeft.value;
      setText(teachVal, teachLabel(Number(teachIn.value)));
      speedIn.value = String(Math.max(Number(speedIn.value), TWIN_SPEED));
    } else {
      speedIn.value = String(DEFAULT_SPEED);
    }
    syncSpeed();
    newIsland(seed, true);
  };
  btnTwin.addEventListener("click", () => setTwin(!twin));

  // ------------------------------------------------------------------ pointer
  const viewAt = (px: number, py: number): number => {
    for (let i = 0; i < xfs.length; i++) {
      const r = xfs[i]!.rect;
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
  };
  canvas.addEventListener("pointerdown", (ev) => {
    const b = canvas.getBoundingClientRect();
    const px = ev.clientX - b.left;
    const py = ev.clientY - b.top;
    const vi = viewAt(px, py);
    if (vi < 0) return;
    const p = toWorld(xfs[vi]!, px, py);
    if (giftArmed) {
      const kind = giftSel.value as GiftType;
      // Twin mode: the gift lands on both islands so the comparison stays fair.
      for (const w of worlds) w.dropGift(kind, p.x, p.y);
      ripple = { x: px, y: py, t: 0 };
      giftArmed = false;
      syncGift();
      return;
    }
    const w = worlds[vi]!;
    let best = -1;
    let bd = Math.max(1.8, 14 / xfs[vi]!.s);
    for (const a of w.agents) {
      if (!a.alive || a.hut >= 0) continue;
      const d = Math.hypot(a.x - p.x, a.y - 0.3 - p.y);
      if (d < bd) {
        bd = d;
        best = a.id;
      }
    }
    if (best >= 0) {
      followId = best;
      followCard.hidden = false;
      renderFollow(followCard, w, followId);
    } else if (regionAt(w.terrain, p.x, p.y) === 0) {
      followId = -1;
    }
  });
  followCard.addEventListener("click", (ev) => {
    if ((ev.target as HTMLElement).closest("#fc-close")) followId = -1;
  });

  // ------------------------------------------------------------------ sizing
  const sizes = { w: 0, h: 0 };
  const measure = (): void => {
    sizes.w = canvas.clientWidth;
    sizes.h = canvas.clientHeight;
  };
  new ResizeObserver(measure).observe(stage);
  measure();

  // ------------------------------------------------------------------ loop
  let last = performance.now();
  let clock = 0;
  let hudAcc = 1;
  let followAcc = 1;

  function step(realDt: number): void {
    if (paused) return;
    acc += realDt * speed;
    const maxSim = MAX_STEPS_PER_FRAME * DT;
    if (acc > maxSim) acc = maxSim;
    while (acc >= DT) {
      for (const w of worlds) w.step(DT);
      acc -= DT;
    }
  }

  function frame(now: number): void {
    const t0 = performance.now();
    const realDt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    clock += realDt;
    step(realDt);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.round(sizes.w * dpr));
    const bh = Math.max(1, Math.round(sizes.h * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b3d5c";
    ctx.fillRect(0, 0, sizes.w, sizes.h);

    // View rects.
    const rects: Rect[] = [];
    if (twin) {
      const raceH = sizes.w < 600 ? 108 : 132;
      const top = sizes.w < 600 ? 0 : 0;
      const hh = Math.max(80, sizes.h - raceH - top);
      if (sizes.w < 600) {
        // Narrow: stack the islands.
        const half = hh / 2;
        rects.push({ x: 0, y: 0, w: sizes.w, h: half - 1 }, { x: 0, y: half + 1, w: sizes.w, h: half - 1 });
      } else {
        rects.push({ x: 0, y: top, w: sizes.w / 2 - 1, h: hh }, { x: sizes.w / 2 + 1, y: top, w: sizes.w / 2 - 1, h: hh });
      }
    } else {
      rects.push({ x: 0, y: 0, w: sizes.w, h: sizes.h });
    }

    // Camera: follow emphasis on the main island.
    const fa = followId >= 0 ? worlds[0]!.agentById(followId) : undefined;
    if (followId >= 0 && (!fa || (!fa.alive && fa.dying <= 0))) followId = -1;
    for (let i = 0; i < rects.length; i++) {
      const cam = cams[i]!;
      let tx = W / 2;
      let ty = H / 2;
      let tz = 1;
      if (i === 0 && fa && !twin) {
        tz = 1.85;
        tx = fa.x;
        ty = fa.y;
      }
      // Keep the view inside the world.
      if (tz > 1) {
        const base = Math.max(Math.min(rects[i]!.w / (W * 0.86), rects[i]!.h / (H * 0.86)), rects[i]!.w / W, rects[i]!.h / H);
        const hw = rects[i]!.w / (2 * base * tz);
        const hh = rects[i]!.h / (2 * base * tz);
        tx = Math.min(W - hw, Math.max(hw, tx));
        ty = Math.min(H - hh, Math.max(hh, ty));
      }
      const k = 1 - Math.exp(-realDt * 3.2);
      cam.cx += (tx - cam.cx) * k;
      cam.cy += (ty - cam.cy) * k;
      cam.zoom += (tz - cam.zoom) * k;
    }
    xfs = rects.map((r, i) => makeXf(r, cams[i]!, twin));

    // Discovery banner from the main island's log.
    const w0 = worlds[0]!;
    if (w0.log.length < bannerSeen) bannerSeen = w0.log.length;
    while (bannerSeen < w0.log.length) {
      const e = w0.log[bannerSeen++]!;
      if (e.kind === "discover" || e.kind === "rediscover" || e.kind === "lost") {
        const tech = TECHS.findIndex((d) => e.text.includes(d.glyph) || e.text.toLowerCase().includes(d.name.toLowerCase()));
        banner = { text: `Day ${e.day} · ${e.text}`, tech: Math.max(0, tech), t: 0 };
      }
    }
    if (banner) {
      banner.t += realDt;
      if (banner.t > 3.4) banner = null;
    }
    if (ripple) {
      ripple.t += realDt / 1.1;
      if (ripple.t >= 1) ripple = null;
    }

    for (let i = 0; i < xfs.length; i++) {
      const w = worlds[i]!;
      drawIsland(ctx, w, xfs[i]!, {
        time: clock,
        followId: i === 0 ? followId : -1,
        twinLabel: twin ? (i === 0 ? `TEACHING ON · ${w.settings.teach.toFixed(2)}` : w.settings.teach > 0 ? `TEACHING ${w.settings.teach.toFixed(2)}` : "TEACHING OFF") : null,
        twinColor: i === 0 ? COL_ON : COL_OFF,
        hover: null,
        giftArmed,
        ripple: i === 0 ? ripple : null,
        dpr,
        banner: i === 0 ? banner : null,
        quality: 0.5,
      });
    }
    if (twin) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "rgba(6,14,22,0.9)";
      if (sizes.w < 600) ctx.fillRect(0, rects[0]!.h, sizes.w, 2);
      else ctx.fillRect(sizes.w / 2 - 1, 0, 2, rects[0]!.h);
      ctx.fillStyle = "#050a12";
      ctx.fillRect(0, rects[0]!.y + Math.max(rects[0]!.h, rects[1]!.y + rects[1]!.h), sizes.w, sizes.h);
    }

    // HUD (throttled).
    hudAcc += realDt;
    if (hudAcc > 0.1) {
      hudAcc = 0;
      const w = worlds[0]!;
      setText(statPop, twin ? `${w.alivePop()} | ${worlds[1]!.alivePop()}` : String(w.alivePop()));
      setText(statDay, String(w.dayNum));
      setText(statTechs, twin ? `${w.techsKnown()} | ${worlds[1]!.techsKnown()}` : `${w.techsKnown()} / ${TECHS.length}`);
      const chiefTxt = w.chiefName ? ` · chief ${w.chiefName} 👑` : "";
      setText(chip, `Day ${w.dayNum} · ${w.seasonName} · ${partOfDay(w.tod)}${chiefTxt}${paused ? " · paused" : ""}`);
      setText(treeLegend, twin ? "outer = left · inner = right" : `${w.totalBirths} born · ${w.totalDeaths} died`);
      drawTechTree(treeCanvas, dpr, w, twin ? worlds[1]! : null, tree, clock);
      drawSparkline(spark, dpr, w.history);
      renderLog(logEl, w.log, logStamp);
      if (twin) drawRace(raceCanvas, dpr, worlds[0]!, worlds[1]!, "teaching on", worlds[1]!.settings.teach > 0 ? "teaching low" : "teaching off");
    }
    followAcc += realDt;
    if (followId >= 0) {
      followCard.hidden = false;
      if (followAcc > 0.2) {
        followAcc = 0;
        if (!renderFollow(followCard, worlds[0]!, followId)) followId = -1;
      }
    } else if (!followCard.hidden) {
      followCard.hidden = true;
    }
    stageHelp.hidden = followId >= 0 || twin;

    frameTimes.push(performance.now() - t0);
    if (frameTimes.length > 120) frameTimes.shift();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ hooks
  window.__islandSelfTest = async () => {
    await new Promise((r) => setTimeout(r, 0));
    const r = runSelfTest();
    console.table(r.checks);
    return r;
  };
  window.__island = {
    get day() {
      return worlds[0]!.day;
    },
    get pop() {
      return worlds[0]!.alivePop();
    },
    get techs() {
      return worlds[0]!.techsKnown();
    },
    get twin() {
      return twin;
    },
    get twinTechs() {
      return worlds.map((w) => w.techsKnown());
    },
    get twinAvg() {
      return worlds.map((w) => w.avgTechs());
    },
    get speed() {
      return speed;
    },
    get paused() {
      return paused;
    },
    get following() {
      return followId;
    },
    get seed() {
      return seed;
    },
    get log() {
      return worlds[0]!.log.map((e) => `Day ${e.day}: ${e.text}`);
    },
    get frameMs() {
      return frameTimes.length ? frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length : 0;
    },
    get agents() {
      return worlds[0]!.agents.filter((a) => a.alive && a.hut < 0).map((a) => ({ id: a.id, x: a.x, y: a.y }));
    },
    /** Camp position as a fraction of the canvas box (for record plans). */
    get campFrac() {
      const xf = xfs[0];
      const c = worlds[0]!.camp;
      if (!xf) return null;
      return { x: (xf.ox + c.x * xf.s) / sizes.w, y: (xf.oy + c.y * xf.s) / sizes.h };
    },
    /** Screen position (CSS px, relative to the canvas) of a creature on the main island. */
    screenOf(id: number) {
      const a = worlds[0]!.agentById(id);
      const xf = xfs[0];
      if (!a || !xf) return null;
      return { x: xf.ox + a.x * xf.s, y: xf.oy + (a.y - 0.3) * xf.s };
    },
    fastForward(days: number) {
      const n = Math.round((days * DAY) / DT);
      for (let i = 0; i < n; i++) for (const w of worlds) w.step(DT);
    },
  };

  syncSpeed();
  syncPause();
  syncHarsh();
  syncTwinTeach();
  syncGift();
  resetBannerWatch();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}

mount();
