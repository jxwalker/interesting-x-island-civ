import { Rng, subSeed } from "./rng";
import {
  H,
  T_FOREST,
  T_GRASS,
  T_HILL,
  T_ROCK,
  T_SAND,
  T_SHALLOW,
  W,
  generateTerrain,
  regionAt,
  tileAt,
  type Terrain,
} from "./terrain";

// =====================================================================
// Techs
// =====================================================================

export const FORAGE = 0;
export const TOOLS = 1;
export const FIRE = 2;
export const SPEAR = 3;
export const FISHING = 4;
export const COOKING = 5;
export const HUT = 6;
export const STORY = 7;
export const WORKSHOP = 8;
export const BOAT = 9;
export const NTECH = 10;

export interface TechDef {
  id: number;
  name: string;
  glyph: string;
  color: string;
  prereq: number;
  /** Column in the tech-tree layout and row inside it. */
  col: number;
  row: number;
  /** Base invention rate per creature per sim-second in the right context. */
  rate: number;
  blurb: string;
}

const bit = (t: number): number => 1 << t;

export const TECHS: TechDef[] = [
  { id: FORAGE, name: "Forage", glyph: "🫐", color: "#ff5f8f", prereq: 0, col: 0, row: 1.5, rate: 0, blurb: "instinct" },
  { id: TOOLS, name: "Stone tools", glyph: "🪨", color: "#d9c4a0", prereq: bit(FORAGE), col: 1, row: 1.5, rate: 0.0016, blurb: "faster gathering" },
  { id: FIRE, name: "Fire", glyph: "🔥", color: "#ff8a3c", prereq: bit(TOOLS), col: 2, row: 0.8, rate: 0.0011, blurb: "warmth at night" },
  { id: SPEAR, name: "Spear", glyph: "🗡️", color: "#b4a0ff", prereq: bit(TOOLS), col: 2, row: 2.4, rate: 0.0009, blurb: "hunt goats" },
  { id: COOKING, name: "Cooking", glyph: "🍖", color: "#ffb347", prereq: bit(FIRE), col: 3, row: 0, rate: 0.0016, blurb: "food ×1.6" },
  { id: HUT, name: "Huts", glyph: "🛖", color: "#e0a060", prereq: bit(FIRE), col: 3, row: 1, rate: 0.0008, blurb: "shelter" },
  { id: STORY, name: "Storytelling", glyph: "💬", color: "#7ee8ff", prereq: bit(FIRE), col: 3, row: 2, rate: 0.0014, blurb: "teach ×2" },
  { id: FISHING, name: "Fishing", glyph: "🐟", color: "#4fd1c5", prereq: bit(SPEAR), col: 3, row: 3, rate: 0.0012, blurb: "fish the shallows" },
  { id: WORKSHOP, name: "Workshop", glyph: "⚙️", color: "#fbbf24", prereq: bit(HUT) | bit(TOOLS), col: 4, row: 1.2, rate: 0.0007, blurb: "invent ×3 nearby" },
  { id: BOAT, name: "Rafts", glyph: "🛶", color: "#5eead4", prereq: bit(WORKSHOP) | bit(FISHING), col: 5, row: 2, rate: 0.0009, blurb: "reach the islet" },
].sort((a, b) => a.id - b.id);

export const ALL_TECH_MASK = (1 << NTECH) - 1;

export function popcount(m: number): number {
  let c = 0;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
}

/** Highest-"depth" tech in a mask (for the chief's bias). */
function bestTech(mask: number): number {
  let best = FORAGE;
  let bc = -1;
  for (let t = 0; t < NTECH; t++) {
    if (mask & bit(t) && TECHS[t]!.col > bc) {
      bc = TECHS[t]!.col;
      best = t;
    }
  }
  return best;
}

// =====================================================================
// Parameters
// =====================================================================

/** Sim seconds per day. */
export const DAY = 24;
export const YEAR_DAYS = 12;
export const DT = 0.05;
export const POP_CAP = 64;
const START_POP = 42;
const SPEED = 2.6;
const VISION = 11;
const TEACH_R = 3.4;
const TEACH_TICK = 0.4;
const DECIDE = 0.55;
/** Day starts at this time-of-day so the island opens in a sunny morning. */
const START_TOD = 0.06;

// Actions
export const A_IDLE = 0;
export const A_WANDER = 1;
export const A_FORAGE = 2;
export const A_FISH = 3;
export const A_HUNT = 4;
export const A_SAIL = 5;
export const A_WOOD = 6;
export const A_BUILD = 7;
export const A_WARM = 8;
export const A_SLEEP = 9;
export const A_PLAY = 10;
export const A_SOCIAL = 11;
export const A_COOK = 12;
export const A_FOLLOW = 13;
export const A_CRATE = 14;

export const ACTION_LABEL = [
  "idling",
  "exploring",
  "foraging",
  "fishing",
  "hunting",
  "rafting to the islet",
  "fetching wood",
  "building",
  "warming up",
  "sleeping",
  "tinkering",
  "chatting",
  "cooking",
  "following a parent",
  "raiding a gift crate",
];

// Resources
export const R_BERRY = 0;
export const R_FISH = 1;
export const R_STONE = 2;

export interface Res {
  kind: number;
  x: number;
  y: number;
  amt: number;
  max: number;
  region: number;
  regen: number;
  /** Where a creature stands to use it (shore point for fish). */
  ax: number;
  ay: number;
}

// Structures
export const S_FIRE = 0;
export const S_HUT = 1;
export const S_WORKSHOP = 2;
export const S_WILDFIRE = 3;
export const S_CRATE = 4;

export interface Struct {
  kind: number;
  x: number;
  y: number;
  progress: number;
  wood: number;
  woodNeed: number;
  fuel: number;
  occ: number;
  /** Crate contents (food units) or stone. */
  amt: number;
  crateKind: number;
  builtDay: number;
  builder: string;
  born: number;
}

export interface Grave {
  x: number;
  y: number;
  t: number;
  name: string;
}

export interface Goat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  respawn: number;
  timer: number;
}

export interface Agent {
  id: number;
  name: string;
  hue: number;
  x: number;
  y: number;
  fx: number;
  fy: number;
  age: number;
  lifespan: number;
  curiosity: number;
  food: number;
  warmth: number;
  energy: number;
  starve: number;
  freeze: number;
  techs: number;
  /** Who taught each tech: agent name, "invented", or "". */
  src: string[];
  learnedDay: Float32Array;
  taught: number;
  children: number;
  parent: number;
  act: number;
  phase: number;
  tx: number;
  ty: number;
  ti: number;
  timer: number;
  decide: number;
  mem: Uint8Array;
  carry: number;
  carryWood: number;
  sawFire: number;
  hut: number;
  alive: boolean;
  dying: number;
  cause: string;
  walk: number;
  moving: boolean;
  learnFx: number;
  learnTech: number;
  teachCool: number;
  wading: boolean;
  onBoat: boolean;
  region: number;
  prog: number;
  stuck: number;
  ptx: number;
  pty: number;
  nearFire: boolean;
  huddle: number;
}

export interface Fx {
  kind: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  t: number;
  life: number;
  tech: number;
}

export const FX_TEACH = 0;
export const FX_STEAM = 1;
export const FX_DISCOVER = 2;
export const FX_BIRTH = 3;
export const FX_LIGHTNING = 4;
export const FX_SPLASH = 5;
export const FX_BUILD = 6;
export const FX_CRATE = 7;
export const FX_FISH = 8;
export const FX_ELECT = 9;

export interface LogEntry {
  day: number;
  text: string;
  kind: string;
}

export interface Sample {
  day: number;
  pop: number;
  techs: number;
  avg: number;
}

export interface Settings {
  teach: number;
  harsh: number;
}

// =====================================================================
// Names
// =====================================================================

const SYL_A = ["Mi", "Ta", "O", "Ka", "Lu", "Ne", "Ba", "Ri", "Su", "Po", "Ze", "Fen", "Ash", "Wen", "Pip", "Ro", "Ya", "Do", "Ilo", "Kes", "Mo", "Tu", "Ve", "Ari", "Bo", "Ny"];
const SYL_B = ["ra", "vi", "ak", "lo", "na", "ri", "ko", "mi", "ta", "lu", "ni", "sa", "el", "ro", "ka", "be", "do", "fi", "", "", ""];

function makeName(rng: Rng): string {
  let n = rng.pick(SYL_A) + rng.pick(SYL_B);
  if (n === "O") n = "Oak";
  if (n.length < 3) n += rng.pick(["k", "n", "x", "l"]);
  return n;
}

// =====================================================================
// World
// =====================================================================

const GC = 4;
const GW = Math.ceil(W / GC);
const GH = Math.ceil(H / GC);
const MAX_AGENTS = 160;

export class World {
  readonly seed: number;
  readonly terrain: Terrain;
  rng: Rng;
  settings: Settings;
  t = START_TOD * DAY;
  steps = 0;
  agents: Agent[] = [];
  res: Res[] = [];
  structs: Struct[] = [];
  graves: Grave[] = [];
  goats: Goat[] = [];
  fx: Fx[] = [];
  log: LogEntry[] = [];
  history: Sample[] = [];
  camp = { x: W / 2, y: H / 2 };
  chief = -1;
  chiefName = "";
  nextId = 1;
  everKnown = 0;
  known = 0;
  techCount = new Int32Array(NTECH);
  totalBirths = 0;
  totalDeaths = 0;
  causes: Record<string, number> = {};
  onDeath: ((a: Agent) => void) | null = null;
  lastElectionDay = 0;
  launch = { x: 0, y: 0 };
  landing = { x: 0, y: 0 };
  hasIslet = false;
  wood: { x: number; y: number }[] = [];
  /** Fraction known milestones logged per tech. */
  private halfLogged = 0;
  private teachAcc = 0;
  private lastDay = -1;
  private winterLogged = false;
  private grid = new Int32Array(GW * GH);
  private gnext = new Int32Array(MAX_AGENTS);
  private near = new Int32Array(MAX_AGENTS);
  private nextLightning: number;
  private flows = new Map<number, Uint16Array>();
  private flowQ = new Int32Array(W * H * 2);
  private sampleAcc = 0;
  private envAcc = 0;

  constructor(seed: number, settings: Settings, opts: { render?: boolean; terrain?: Terrain } = {}) {
    this.seed = seed >>> 0;
    this.settings = { ...settings };
    this.terrain = opts.terrain ?? generateTerrain(this.seed, opts.render ?? false);
    this.rng = new Rng(subSeed(this.seed, 101));
    this.nextLightning = DAY * this.rng.range(5, 9);
    this.setup();
  }

  // ------------------------------------------------------------- setup

  private landOK(x: number, y: number, region = 1): boolean {
    return regionAt(this.terrain, x, y) === region;
  }

  private setup(): void {
    const t = this.terrain;
    const rng = new Rng(subSeed(this.seed, 202));
    // Camp: grassland near the river, not too far from the coast.
    let best = -Infinity;
    for (let k = 0; k < 500; k++) {
      const x = rng.range(4, W - 4);
      const y = rng.range(4, H - 4);
      if (!this.landOK(x, y)) continue;
      const ty = tileAt(t, x, y);
      if (ty !== T_GRASS && ty !== T_SAND) continue;
      let river = 99;
      let coast = 99;
      let forest = 99;
      for (let dy = -10; dy <= 10; dy += 2) {
        for (let dx = -10; dx <= 10; dx += 2) {
          const xx = x + dx;
          const yy = y + dy;
          const d = Math.hypot(dx, dy);
          const tt = tileAt(t, xx, yy);
          if (t.river[(yy | 0) * W + (xx | 0)]) river = Math.min(river, d);
          if (tt <= T_SHALLOW) coast = Math.min(coast, d);
          if (tt === T_FOREST) forest = Math.min(forest, d);
        }
      }
      const s =
        (river < 9 ? 3 - Math.abs(river - 4) * 0.3 : 0) +
        (coast < 12 ? 1.5 : 0) +
        (forest < 10 ? 1.5 : 0) -
        Math.hypot(x - t.peak.x, y - t.peak.y) / 40 +
        rng.next() * 0.5;
      if (s > best) {
        best = s;
        this.camp = { x, y };
      }
    }

    // Resources.
    const addRes = (kind: number, x: number, y: number, max: number, region: number, regen: number): void => {
      this.res.push({ kind, x, y, amt: Math.round(max * rng.range(0.5, 1)), max, region, regen, ax: x, ay: y });
    };
    let berries = 0;
    for (let k = 0; k < 6000 && berries < 88; k++) {
      const x = rng.range(2, W - 2);
      const y = rng.range(2, H - 2);
      if (!this.landOK(x, y)) continue;
      const ty = tileAt(t, x, y);
      if (ty !== T_GRASS && ty !== T_FOREST) continue;
      if (rng.chance(ty === T_FOREST ? 0.5 : 0.8)) {
        addRes(R_BERRY, x, y, 5, 1, rng.range(0.7, 1.3));
        berries++;
      }
    }
    // Islet: lush berry patch.
    let ib = 0;
    for (let k = 0; k < 3000 && ib < 14; k++) {
      const x = t.isletCenter.x + rng.range(-7, 7);
      const y = t.isletCenter.y + rng.range(-6, 6);
      if (!this.landOK(x, y, 2)) continue;
      addRes(R_BERRY, x, y, 7, 2, 1.6);
      ib++;
    }
    this.hasIslet = ib > 3;
    // Fish: shallows next to sand.
    let fish = 0;
    for (let k = 0; k < 8000 && fish < 26; k++) {
      const x = rng.range(2, W - 2);
      const y = rng.range(2, H - 2);
      if (tileAt(t, x, y) !== T_SHALLOW) continue;
      let sx = -1;
      let sy = -1;
      for (const [dx, dy] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]] as const) {
        if (regionAt(t, x + dx, y + dy) === 1 && regionAt(t, x + dx * 1.6, y + dy * 1.6) === 1) {
          sx = x + dx * 1.3;
          sy = y + dy * 1.3;
          break;
        }
      }
      if (sx < 0) continue;
      addRes(R_FISH, x, y, 4, 1, rng.range(0.8, 1.2));
      this.res[this.res.length - 1]!.ax = sx;
      this.res[this.res.length - 1]!.ay = sy;
      fish++;
    }
    // Stone outcrops: hills / rock / riverbed.
    let stone = 0;
    for (let k = 0; k < 6000 && stone < 16; k++) {
      const x = rng.range(2, W - 2);
      const y = rng.range(2, H - 2);
      if (!this.landOK(x, y)) continue;
      const ty = tileAt(t, x, y);
      const riverbed = t.river[(y | 0) * W + (x | 0)] === 1;
      if (ty !== T_HILL && ty !== T_ROCK && !riverbed) continue;
      addRes(R_STONE, x, y, 9, 1, 1);
      stone++;
    }
    // Wood spots: trees on the main island.
    for (const tr of t.trees) {
      if (this.landOK(tr.x, tr.y)) this.wood.push({ x: tr.x, y: tr.y });
    }
    // Raft route: main-island coast tile nearest the islet, and the islet beach nearest that.
    if (this.hasIslet) {
      let bd = Infinity;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (t.region[y * W + x] !== 1) continue;
          const d = Math.hypot(x - t.isletCenter.x, y - t.isletCenter.y);
          if (d < bd) {
            bd = d;
            this.launch = { x: x + 0.5, y: y + 0.5 };
          }
        }
      }
      bd = Infinity;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (t.region[y * W + x] !== 2) continue;
          const d = Math.hypot(x + 0.5 - this.launch.x, y + 0.5 - this.launch.y);
          if (d < bd) {
            bd = d;
            this.landing = { x: x + 0.5, y: y + 0.5 };
          }
        }
      }
    }
    // Goats.
    for (let k = 0; k < 9; k++) this.goats.push(this.spawnGoat(rng));

    // Creatures wake up scattered around the camp.
    for (let k = 0; k < START_POP; k++) {
      let x = this.camp.x;
      let y = this.camp.y;
      for (let g = 0; g < 60; g++) {
        const a = rng.range(0, Math.PI * 2);
        const r = Math.sqrt(rng.next()) * 16;
        const xx = this.camp.x + Math.cos(a) * r;
        const yy = this.camp.y + Math.sin(a) * r * 0.8;
        if (this.landOK(xx, yy)) {
          x = xx;
          y = yy;
          break;
        }
      }
      const ag = this.makeAgent(rng, x, y, rng.range(5, 34), -1);
      ag.food = rng.range(0.55, 0.95);
      ag.energy = rng.range(0.6, 1);
      ag.decide = rng.range(0, DECIDE);
      this.agents.push(ag);
    }
    this.recount();
    this.addLog(0, `${START_POP} creatures wake up on the island, knowing nothing`, "start");
    this.sample();
  }

  private spawnGoat(rng: Rng): Goat {
    for (let g = 0; g < 200; g++) {
      const x = rng.range(3, W - 3);
      const y = rng.range(3, H - 3);
      const ty = tileAt(this.terrain, x, y);
      if (this.landOK(x, y) && (ty === T_HILL || ty === T_GRASS)) {
        return { x, y, vx: 0, vy: 0, alive: true, respawn: 0, timer: 0 };
      }
    }
    return { x: this.camp.x, y: this.camp.y, vx: 0, vy: 0, alive: false, respawn: DAY, timer: 0 };
  }

  private makeAgent(rng: Rng, x: number, y: number, age: number, parent: number): Agent {
    const src: string[] = [];
    for (let i = 0; i < NTECH; i++) src.push("");
    src[FORAGE] = "instinct";
    const ld = new Float32Array(NTECH);
    return {
      id: this.nextId++,
      name: makeName(rng),
      hue: rng.range(0, 360),
      x,
      y,
      fx: 1,
      fy: 0,
      age,
      lifespan: rng.range(42, 66),
      curiosity: rng.range(0.55, 1.6),
      food: 0.8,
      warmth: 0.8,
      energy: 0.9,
      starve: 0,
      freeze: 0,
      techs: bit(FORAGE),
      src,
      learnedDay: ld,
      taught: 0,
      children: 0,
      parent,
      act: A_IDLE,
      phase: 0,
      tx: x,
      ty: y,
      ti: -1,
      timer: 0,
      decide: 0,
      mem: new Uint8Array(this.res.length + 4),
      carry: 0,
      carryWood: 0,
      sawFire: 0,
      hut: -1,
      alive: true,
      dying: 0,
      cause: "",
      walk: rng.range(0, 6),
      moving: false,
      learnFx: 0,
      learnTech: 0,
      teachCool: 0,
      wading: false,
      onBoat: false,
      region: 1,
      prog: Infinity,
      stuck: 0,
      ptx: 0,
      pty: 0,
      nearFire: false,
      huddle: 0,
    };
  }

  // ------------------------------------------------------------- time

  get day(): number {
    return this.t / DAY;
  }

  get dayNum(): number {
    return Math.floor(this.t / DAY) + 1;
  }

  /** Time of day in [0,1): 0 = midnight-ish dawn start, ~0.68 dusk. */
  get tod(): number {
    return (this.t / DAY) % 1;
  }

  /** 0 = full day, 1 = full night. */
  get darkness(): number {
    const d = this.tod;
    if (d < 0.05) return 1 - d / 0.05;
    if (d < 0.7) return 0;
    if (d < 0.8) return (d - 0.7) / 0.1;
    return 1;
  }

  get isNight(): boolean {
    const d = this.tod;
    return d > 0.77 || d < 0.03;
  }

  get yearPhase(): number {
    return (this.t / DAY / YEAR_DAYS + 0.08) % 1;
  }

  /** 0..1 winter intensity. */
  get winter(): number {
    const h = this.settings.harsh;
    const w = 0.1 + 0.13 * h;
    let d = Math.abs(this.yearPhase - 0.72);
    d = Math.min(d, 1 - d);
    return 1 - smoothstep(w * 0.55, w * 1.35, d);
  }

  get snow(): number {
    const h = this.settings.harsh;
    return clamp01((this.winter * (0.55 + 0.6 * h) + h * h * 0.32 - 0.12) / 0.6);
  }

  get seasonName(): string {
    const p = this.yearPhase;
    if (this.winter > 0.4) return "winter";
    if (p < 0.3) return "spring";
    if (p < 0.55) return "summer";
    if (p < 0.9) return "autumn";
    return "spring";
  }

  private ambient(): number {
    const h = this.settings.harsh;
    const night = this.darkness;
    return clamp01(0.98 - night * (0.22 + 0.2 * h) - this.winter * (0.5 + 0.45 * h) - h * 0.14);
  }

  // ------------------------------------------------------------- queries

  private buildGrid(): void {
    this.grid.fill(-1);
    const as = this.agents;
    for (let i = 0; i < as.length; i++) {
      const a = as[i]!;
      if (!a.alive || a.onBoat || a.hut >= 0) {
        this.gnext[i] = -1;
        continue;
      }
      const cx = Math.min(GW - 1, Math.max(0, (a.x / GC) | 0));
      const cy = Math.min(GH - 1, Math.max(0, (a.y / GC) | 0));
      const c = cy * GW + cx;
      this.gnext[i] = this.grid[c]!;
      this.grid[c] = i;
    }
  }

  /** Fill this.near with agent indices within r of (x,y); returns count. */
  queryNear(x: number, y: number, r: number): number {
    const x0 = Math.max(0, ((x - r) / GC) | 0);
    const x1 = Math.min(GW - 1, ((x + r) / GC) | 0);
    const y0 = Math.max(0, ((y - r) / GC) | 0);
    const y1 = Math.min(GH - 1, ((y + r) / GC) | 0);
    const r2 = r * r;
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let i = this.grid[cy * GW + cx]!;
        while (i >= 0) {
          const a = this.agents[i]!;
          const dx = a.x - x;
          const dy = a.y - y;
          if (dx * dx + dy * dy <= r2 && n < MAX_AGENTS) this.near[n++] = i;
          i = this.gnext[i]!;
        }
      }
    }
    return n;
  }

  nearIdx(k: number): number {
    return this.near[k]!;
  }

  private litFireNear(x: number, y: number, r: number): number {
    let best = -1;
    let bd = r * r;
    for (let i = 0; i < this.structs.length; i++) {
      const s = this.structs[i]!;
      if ((s.kind !== S_FIRE && s.kind !== S_WILDFIRE) || s.fuel <= 0 || s.progress < 1) continue;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  private structNear(kind: number, x: number, y: number, r: number, built = true): number {
    let best = -1;
    let bd = r * r;
    for (let i = 0; i < this.structs.length; i++) {
      const s = this.structs[i]!;
      if (s.kind !== kind) continue;
      if (built && s.progress < 1) continue;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  private countStructs(kind: number, x: number, y: number, r: number): number {
    let n = 0;
    const r2 = r * r;
    for (const s of this.structs) {
      if (s.kind === kind && (s.x - x) ** 2 + (s.y - y) ** 2 < r2) n++;
    }
    return n;
  }

  private nearTile(x: number, y: number, r: number, test: (ty: number) => boolean): boolean {
    for (let dy = -r; dy <= r; dy += 1.5) {
      for (let dx = -r; dx <= r; dx += 1.5) {
        if (test(tileAt(this.terrain, x + dx, y + dy))) return true;
      }
    }
    return false;
  }

  private stoneNear(x: number, y: number, r: number): boolean {
    const r2 = r * r;
    for (const s of this.res) {
      if (s.kind === R_STONE && (s.x - x) ** 2 + (s.y - y) ** 2 < r2) return true;
    }
    for (const s of this.structs) {
      if (s.kind === S_CRATE && s.crateKind === R_STONE && s.amt > 0 && (s.x - x) ** 2 + (s.y - y) ** 2 < r2) return true;
    }
    const ty = tileAt(this.terrain, x, y);
    return ty === T_HILL || ty === T_ROCK;
  }

  // ------------------------------------------------------------- logging

  addLog(day: number, text: string, kind: string): void {
    this.log.push({ day, text, kind });
    if (this.log.length > 60) this.log.splice(0, this.log.length - 60);
  }

  private fxPush(kind: number, x: number, y: number, x2: number, y2: number, life: number, tech: number): void {
    if (this.fx.length > 220) this.fx.shift();
    this.fx.push({ kind, x, y, x2, y2, t: 0, life, tech });
  }

  // ------------------------------------------------------------- learning

  private learn(a: Agent, tech: number, src: string): void {
    if (a.techs & bit(tech)) return;
    a.techs |= bit(tech);
    a.src[tech] = src;
    a.learnedDay[tech] = this.day;
    a.learnFx = 1.2;
    a.learnTech = tech;
    const wasKnown = (this.known & bit(tech)) !== 0;
    this.techCount[tech]!++;
    this.known |= bit(tech);
    if (src === "invented" && !wasKnown) {
      const again = (this.everKnown & bit(tech)) !== 0;
      const def = TECHS[tech]!;
      this.addLog(
        this.dayNum,
        again ? `${a.name} rediscovered ${def.name.toLowerCase()} ${def.glyph}` : `${a.name} discovered ${def.name.toLowerCase()} ${def.glyph}`,
        again ? "rediscover" : "discover",
      );
      this.everKnown |= bit(tech);
      this.fxPush(FX_DISCOVER, a.x, a.y, 0, 0, 2.2, tech);
    }
  }

  private canLearn(a: Agent, tech: number): boolean {
    const d = TECHS[tech]!;
    return (a.techs & bit(tech)) === 0 && (a.techs & d.prereq) === d.prereq;
  }

  /** Per-sim-second invention rates in the creature's current context. */
  private tryInvent(a: Agent, dt: number): void {
    if (a.age < 3) return;
    const rng = this.rng;
    const play = a.act === A_PLAY ? 3.2 : 1;
    const ws = this.structNear(S_WORKSHOP, a.x, a.y, 12) >= 0 ? 3 : 1;
    const base = a.curiosity * play * ws * dt;
    for (let t = 1; t < NTECH; t++) {
      if (!this.canLearn(a, t)) continue;
      let ctx = 0;
      switch (t) {
        case TOOLS:
          ctx = this.stoneNear(a.x, a.y, 7) ? 1 : 0.08;
          break;
        case FIRE: {
          const trees = this.nearTile(a.x, a.y, 4, (ty) => ty === T_FOREST) ? 1 : 0.35;
          const dry = this.winter < 0.2 ? 1.3 : 0.6;
          const seen = a.sawFire > 0 ? (a.sawFire > DAY * 0.6 ? 14 : 2.2) : 1;
          ctx = trees * dry * seen * (this.stoneNear(a.x, a.y, 9) ? 1.4 : 1);
          break;
        }
        case SPEAR:
          ctx = this.nearTile(a.x, a.y, 4, (ty) => ty === T_FOREST) ? 1 : 0.3;
          break;
        case FISHING:
          ctx = this.nearTile(a.x, a.y, 3, (ty) => ty === T_SHALLOW) || a.act === A_FISH ? 1.4 : 0.05;
          break;
        case COOKING:
          ctx = this.litFireNear(a.x, a.y, 6) >= 0 ? (a.carry > 0 || a.food < 0.6 ? 1.5 : 0.6) : 0;
          break;
        case HUT:
          ctx = (this.structNear(S_HUT, a.x, a.y, 14) >= 0 ? 7 : 1) * (this.winter > 0.3 ? 1.6 : 1);
          break;
        case STORY:
          ctx = this.isNight && this.litFireNear(a.x, a.y, 6) >= 0 ? 1.4 : 0.1;
          break;
        case WORKSHOP:
          ctx = (this.structNear(S_WORKSHOP, a.x, a.y, 16) >= 0 ? 7 : 1) * (this.structNear(S_HUT, a.x, a.y, 10) >= 0 ? 1 : 0.25);
          break;
        case BOAT:
          ctx = this.hasIslet ? (this.nearTile(a.x, a.y, 3, (ty) => ty === T_SHALLOW) ? 1.2 : 0.25) : 0;
          break;
      }
      if (ctx > 0 && rng.next() < TECHS[t]!.rate * ctx * base) {
        this.learn(a, t, "invented");
        return;
      }
    }
  }

  private teachStep(dt: number): void {
    const rate = this.settings.teach;
    if (rate <= 0) return;
    const as = this.agents;
    for (let i = 0; i < as.length; i++) {
      const a = as[i]!;
      if (!a.alive || a.techs === bit(FORAGE) || a.onBoat || a.hut >= 0 || a.age < 3) continue;
      const n = this.queryNear(a.x, a.y, TEACH_R);
      if (n <= 1) continue;
      const storyMul = a.techs & bit(STORY) ? 2.2 : 1;
      const p = rate * 0.09 * storyMul * dt;
      for (let k = 0; k < n; k++) {
        const b = as[this.near[k]!]!;
        if (b === a || b.teachCool > 0 || b.dying > 0) continue;
        const lack = a.techs & ~b.techs;
        if (!lack) continue;
        if (this.rng.next() >= p) continue;
        // Teach the most basic teachable tech first (a "curriculum").
        let pick = -1;
        let pc = 99;
        for (let t = 1; t < NTECH; t++) {
          if (lack & bit(t) && this.canLearn(b, t) && TECHS[t]!.col < pc) {
            pc = TECHS[t]!.col;
            pick = t;
          }
        }
        if (pick < 0) continue;
        this.learn(b, pick, a.name);
        b.teachCool = 1.6;
        a.taught++;
        this.fxPush(FX_TEACH, a.x, a.y, b.x, b.y, 1.1, pick);
        break;
      }
    }
  }

  // ------------------------------------------------------------- steering

  private walkable(a: Agent, x: number, y: number): boolean {
    if (x < 1 || y < 1 || x > W - 1 || y > H - 1) return false;
    const r = regionAt(this.terrain, x, y);
    if (r === a.region) return true;
    if (a.wading && r === 0 && tileAt(this.terrain, x, y) === T_SHALLOW) {
      // Wade only a couple of tiles from shore.
      return regionAt(this.terrain, x + 1.6, y) === a.region ||
        regionAt(this.terrain, x - 1.6, y) === a.region ||
        regionAt(this.terrain, x, y + 1.6) === a.region ||
        regionAt(this.terrain, x, y - 1.6) === a.region;
    }
    return false;
  }

  /** Move toward (tx,ty); returns true when arrived. */
  private moveTo(a: Agent, tx: number, ty: number, speed: number, dt: number, arrive = 0.6): boolean {
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    if (d < arrive) {
      a.moving = false;
      return true;
    }
    // Give up on targets we cannot get closer to (around water, crowds…).
    if (Math.abs(tx - a.ptx) + Math.abs(ty - a.pty) > 2) {
      a.ptx = tx;
      a.pty = ty;
      a.prog = Infinity;
    }
    if (d < a.prog - 0.4) {
      a.prog = d;
      a.stuck = 0;
    } else {
      a.stuck += dt;
      if (a.stuck > 4.5) {
        if ((a.act === A_FORAGE || a.act === A_FISH) && a.ti >= 0) a.mem[a.ti] = 0;
        a.stuck = 0;
        a.prog = Infinity;
        this.done(a);
        return false;
      }
    }
    const step = Math.min(d, speed * dt);
    let ux = dx / d;
    let uy = dy / d;
    if (a.onBoat) {
      a.x += ux * step;
      a.y += uy * step;
      a.fx = ux;
      a.fy = uy;
      a.moving = true;
      return false;
    }
    // Far targets: follow the cached BFS flow field toward the target tile,
    // unless the straight line ahead is clear and heading downhill anyway.
    if (d > 1.5 && !(this.walkable(a, a.x + ux * 1.3, a.y + uy * 1.3) && this.walkable(a, a.x + ux * 2.6, a.y + uy * 2.6))) {
      const field = this.flow(tx, ty, a.region);
      if (field) {
        const cx = a.x | 0;
        const cy = a.y | 0;
        const here = field[cy * W + cx] ?? 65535;
        const ax = (a.x + ux * 1.3) | 0;
        const ay = (a.y + uy * 1.3) | 0;
        const ahead = field[ay * W + ax] ?? 65535;
        if (!(ahead < 65535 && ahead <= here && this.walkable(a, a.x + ux * 1.3, a.y + uy * 1.3))) {
          let best = here;
          let bx = -1;
          let by = -1;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (!ox && !oy) continue;
              const nx = cx + ox;
              const ny = cy + oy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const v = field[ny * W + nx]!;
              if (v < best) {
                best = v;
                bx = nx;
                by = ny;
              }
            }
          }
          if (bx >= 0) {
            const gx = bx + 0.5 - a.x;
            const gy = by + 0.5 - a.y;
            const gd = Math.hypot(gx, gy) || 1;
            ux = gx / gd;
            uy = gy / gd;
          }
        }
      }
    }
    const nx = a.x + ux * step;
    const ny = a.y + uy * step;
    if (this.walkable(a, nx, ny)) {
      a.x = nx;
      a.y = ny;
    } else if (this.walkable(a, nx, a.y)) {
      a.x = nx;
    } else if (this.walkable(a, a.x, ny)) {
      a.y = ny;
    }
    a.fx += (ux - a.fx) * 0.3;
    a.fy += (uy - a.fy) * 0.3;
    a.moving = true;
    a.walk += step * 2.2;
    return false;
  }

  /** BFS distance field (in tile steps) to the tile containing (tx,ty), cached per tile. */
  private flow(tx: number, ty: number, region: number): Uint16Array | null {
    let ix = Math.min(W - 1, Math.max(0, tx | 0));
    let iy = Math.min(H - 1, Math.max(0, ty | 0));
    const reg = this.terrain.region;
    if (reg[iy * W + ix] !== region) {
      // Snap to the nearest tile of the region.
      let bd = Infinity;
      let bi = -1;
      for (let oy = -3; oy <= 3; oy++) {
        for (let ox = -3; ox <= 3; ox++) {
          const nx = ix + ox;
          const ny = iy + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || reg[ny * W + nx] !== region) continue;
          const dd = ox * ox + oy * oy;
          if (dd < bd) {
            bd = dd;
            bi = ny * W + nx;
          }
        }
      }
      if (bi < 0) return null;
      ix = bi % W;
      iy = (bi - ix) / W;
    }
    const key = iy * W + ix;
    const hit = this.flows.get(key);
    if (hit) return hit;
    const f = new Uint16Array(W * H).fill(65535);
    const q = this.flowQ;
    let head = 0;
    let tail = 0;
    f[key] = 0;
    q[tail++] = key;
    while (head < tail) {
      const i = q[head++]!;
      const x = i % W;
      const y = (i - x) / W;
      const nd = f[i]! + 1;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= H) continue;
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const xx = x + ox;
          if (xx < 0 || xx >= W) continue;
          const j = yy * W + xx;
          if (reg[j] !== region || f[j]! <= nd) continue;
          // No corner cutting across water.
          if (ox && oy && (reg[y * W + xx] !== region || reg[yy * W + x] !== region)) continue;
          f[j] = nd;
          q[tail++] = j;
        }
      }
    }
    if (this.flows.size > 600) {
      const first = this.flows.keys().next().value;
      if (first !== undefined) this.flows.delete(first);
    }
    this.flows.set(key, f);
    return f;
  }

  private randomLandNear(x: number, y: number, r: number, region = 1): { x: number; y: number } {
    for (let g = 0; g < 24; g++) {
      const a = this.rng.range(0, Math.PI * 2);
      const rr = this.rng.range(0.3, 1) * r;
      const xx = x + Math.cos(a) * rr;
      const yy = y + Math.sin(a) * rr;
      if (this.landOK(xx, yy, region)) return { x: xx, y: yy };
    }
    return { x, y };
  }

  // ------------------------------------------------------------- decisions

  private nearestMemRes(a: Agent, kind: number, region: number): number {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < this.res.length; i++) {
      const r = this.res[i]!;
      if (r.kind !== kind || r.region !== region || !a.mem[i]) continue;
      if (r.amt < 1) continue;
      const d = Math.hypot(r.x - a.x, r.y - a.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  private nearestWood(x: number, y: number): number {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < this.wood.length; i++) {
      const w = this.wood[i]!;
      const d = (w.x - x) ** 2 + (w.y - y) ** 2 + ((i * 7919) % 13);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  private look(a: Agent): void {
    const r2 = VISION * VISION;
    for (let i = 0; i < this.res.length; i++) {
      const r = this.res[i]!;
      if ((r.x - a.x) ** 2 + (r.y - a.y) ** 2 < r2) a.mem[i] = 1;
    }
    for (const s of this.structs) {
      if ((s.kind === S_FIRE || s.kind === S_WILDFIRE) && s.fuel > 0 && s.progress >= 1) {
        const d2 = (s.x - a.x) ** 2 + (s.y - a.y) ** 2;
        if (d2 < 100) {
          const strong = s.kind === S_WILDFIRE ? DAY * 1.6 : DAY * 0.3;
          if (a.sawFire < strong) a.sawFire = strong;
        }
      }
    }
  }

  /** Current action finished: think again on the next step. */
  private done(a: Agent): void {
    if (a.act === A_SAIL && a.onBoat) return;
    a.act = A_IDLE;
    a.phase = 0;
    a.timer = 0;
    a.wading = false;
    a.moving = false;
  }

  /** Interrupt the current plan when something urgent comes up. */
  private shouldRethink(a: Agent): boolean {
    const act = a.act;
    if (act === A_FOLLOW) return true;
    if (act === A_SAIL && a.phase > 0) return false;
    const eating = act === A_FORAGE || act === A_FISH || act === A_HUNT || act === A_SAIL || act === A_CRATE || act === A_COOK;
    if (a.food < 0.22 && !eating) return true;
    const sheltering = act === A_SLEEP || act === A_WARM;
    if (a.warmth < 0.22 && !sheltering && act !== A_SAIL && a.food > 0.25) return true;
    if (this.isNight && !sheltering && !eating && act !== A_BUILD && act !== A_WOOD) return true;
    if (act === A_SLEEP && a.phase === 1 && !this.isNight && a.energy > 0.7) return true;
    if ((act === A_WANDER || act === A_SOCIAL) && this.rng.next() < 0.08) return true;
    return false;
  }

  private setAct(a: Agent, act: number, tx: number, ty: number, ti = -1): void {
    if (a.hut >= 0) this.leaveHut(a);
    a.act = act;
    a.phase = 0;
    a.tx = tx;
    a.ty = ty;
    a.ti = ti;
    a.timer = 0;
    a.wading = false;
    a.prog = Infinity;
    a.stuck = 0;
  }

  private leaveHut(a: Agent): void {
    const s = this.structs[a.hut];
    if (s) s.occ = Math.max(0, s.occ - 1);
    a.hut = -1;
  }

  /** Find or create a construction job this creature can work on. */
  private findJob(a: Agent): number {
    const c = this.camp;
    // Existing sites first.
    let best = -1;
    let bd = 40 * 40;
    for (let i = 0; i < this.structs.length; i++) {
      const s = this.structs[i]!;
      if (s.progress >= 1) continue;
      const need = s.kind === S_FIRE ? FIRE : s.kind === S_HUT ? HUT : s.kind === S_WORKSHOP ? WORKSHOP : -1;
      if (need < 0 || !(a.techs & bit(need))) continue;
      const d = (s.x - a.x) ** 2 + (s.y - a.y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) return best;
    const pop = this.agents.length;
    if (a.techs & bit(FIRE) && this.structNear(S_FIRE, c.x, c.y, 7, false) < 0) {
      return this.newSite(S_FIRE, a, 0, 2.5);
    }
    if (a.techs & bit(FIRE) && pop > 34 && this.countStructs(S_FIRE, c.x, c.y, 9) < 2 && this.rng.chance(0.3)) {
      return this.newSite(S_FIRE, a, 3.5, 6);
    }
    if (a.techs & bit(HUT)) {
      const huts = this.countStructs(S_HUT, c.x, c.y, 14);
      if (huts * 4 < pop + 4 && huts < 16) return this.newSite(S_HUT, a, 4.5, 11);
    }
    if (a.techs & bit(WORKSHOP) && this.countStructs(S_WORKSHOP, c.x, c.y, 16) < 1) {
      return this.newSite(S_WORKSHOP, a, 5, 10);
    }
    return -1;
  }

  private newSite(kind: number, a: Agent, r0: number, r1: number): number {
    const c = this.camp;
    for (let g = 0; g < 40; g++) {
      const ang = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(r0, r1);
      const x = c.x + Math.cos(ang) * r;
      const y = c.y + Math.sin(ang) * r * 0.8;
      if (!this.landOK(x, y) || !this.landOK(x + 1.2, y) || !this.landOK(x - 1.2, y) || !this.landOK(x, y + 1)) continue;
      if (this.terrain.river[(y | 0) * W + (x | 0)]) continue;
      let clash = false;
      for (const s of this.structs) {
        const minD = s.kind === S_WORKSHOP || kind === S_WORKSHOP ? 4 : 2.6;
        if (s.kind !== S_CRATE && (s.x - x) ** 2 + (s.y - y) ** 2 < minD * minD) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      const woodNeed = kind === S_FIRE ? 1 : kind === S_HUT ? 3 : 4;
      this.structs.push({
        kind,
        x,
        y,
        progress: 0,
        wood: 0,
        woodNeed,
        fuel: 0,
        occ: 0,
        amt: 0,
        crateKind: 0,
        builtDay: 0,
        builder: a.name,
        born: this.t,
      });
      return this.structs.length - 1;
    }
    return -1;
  }

  private decide(a: Agent): void {
    const night = this.isNight;
    const dusk = this.tod > 0.66 && this.tod < 0.79;
    const rng = this.rng;
    const chiefBias = this.chief >= 0 ? bestTech(this.agents.find((x) => x.id === this.chief)?.techs ?? 0) : -1;

    // Babies tag along with a parent.
    if (a.age < 2.5) {
      const p = this.agents.find((x) => x.id === a.parent && x.alive);
      if (p && !p.onBoat) {
        this.setAct(a, A_FOLLOW, p.x, p.y, p.id);
        return;
      }
    }


    const hunger = 1 - a.food;
    let uEat = a.food < 0.6 ? 0.85 + (0.6 - a.food) * 2.2 : hunger * 1.2;
    if (a.carry > 0 && hunger > 0.25) uEat += 0.4;
    const ambient = this.ambient();
    const cold = 1 - a.warmth;
    let uWarm = cold * (ambient < 0.5 ? 1.7 : 0.7);
    let uSleep = night ? 0.85 + (1 - a.energy) * 0.8 : a.energy < 0.18 ? 1.3 : 0;
    if (dusk) uSleep += 0.25;
    let uJob = 0;
    let job = -1;
    if (a.techs & (bit(FIRE) | bit(HUT) | bit(WORKSHOP)) && a.age > 4) {
      job = this.findJob(a);
      if (job >= 0) uJob = 0.62 + (chiefBias === HUT || chiefBias === WORKSHOP ? 0.2 : 0);
    }
    let uFuel = 0;
    let fuelTarget = -1;
    if (a.techs & bit(FIRE) && a.age > 4) {
      for (let i = 0; i < this.structs.length; i++) {
        const s = this.structs[i]!;
        if (s.kind !== S_FIRE || s.progress < 1) continue;
        if ((s.x - this.camp.x) ** 2 + (s.y - this.camp.y) ** 2 > 14 * 14) continue;
        if (s.fuel < 0.5) {
          const u = (dusk || night || this.winter > 0.3 ? 1.05 : 0.45) + (0.5 - s.fuel);
          if (u > uFuel) {
            uFuel = u;
            fuelTarget = i;
          }
        }
      }
    }
    let uCook = 0;
    let cookFire = -1;
    if (a.techs & bit(COOKING) && a.carry > 0) {
      cookFire = this.litFireNear(a.x, a.y, 30);
      if (cookFire >= 0) uCook = 0.75 + hunger;
    }
    const uPlay = night ? 0.05 : 0.3 + a.curiosity * 0.18;
    const uSocial = night ? 0.1 : 0.24;
    const uWander = night ? 0 : 0.2;

    let best = "wander";
    let bu = uWander + rng.next() * 0.12;
    const consider = (name: string, u: number): void => {
      const v = u + rng.next() * 0.12;
      if (v > bu) {
        bu = v;
        best = name;
      }
    };
    consider("eat", uEat);
    consider("warm", uWarm);
    consider("sleep", uSleep);
    if (job >= 0) consider("job", uJob);
    if (fuelTarget >= 0) consider("fuel", uFuel);
    if (cookFire >= 0) consider("cook", uCook);
    consider("play", uPlay);
    consider("social", uSocial);

    switch (best) {
      case "eat":
        this.chooseFood(a, chiefBias);
        return;
      case "warm": {
        const f = this.litFireNear(a.x, a.y, 40);
        if (f >= 0) {
          const s = this.structs[f]!;
          const p = this.ringPoint(s.x, s.y, 1.6, 2.6);
          this.setAct(a, A_WARM, p.x, p.y, f);
        } else {
          const p = this.randomLandNear(this.camp.x, this.camp.y, 3);
          this.setAct(a, A_WARM, p.x, p.y, -1);
        }
        return;
      }
      case "sleep": {
        let hut = -1;
        let bd = 30 * 30;
        for (let i = 0; i < this.structs.length; i++) {
          const s = this.structs[i]!;
          if (s.kind !== S_HUT || s.progress < 1 || s.occ >= 4) continue;
          const d = (s.x - a.x) ** 2 + (s.y - a.y) ** 2;
          if (d < bd) {
            bd = d;
            hut = i;
          }
        }
        if (hut >= 0) {
          const s = this.structs[hut]!;
          this.setAct(a, A_SLEEP, s.x, s.y + 0.6, hut);
        } else {
          const f = this.litFireNear(this.camp.x, this.camp.y, 14);
          const p = f >= 0 ? this.ringPoint(this.structs[f]!.x, this.structs[f]!.y, 1.6, 3.4) : this.randomLandNear(this.camp.x, this.camp.y, 4);
          this.setAct(a, A_SLEEP, p.x, p.y, -1);
        }
        return;
      }
      case "job": {
        const s = this.structs[job]!;
        this.setAct(a, A_BUILD, s.x, s.y, job);
        return;
      }
      case "fuel": {
        const w = this.nearestWood(a.x, a.y);
        this.setAct(a, A_WOOD, this.wood[w]!.x, this.wood[w]!.y + 0.8, fuelTarget);
        return;
      }
      case "cook": {
        const s = this.structs[cookFire]!;
        const p = this.ringPoint(s.x, s.y, 1.4, 2);
        this.setAct(a, A_COOK, p.x, p.y, cookFire);
        return;
      }
      case "play": {
        // Tinker near interesting materials: stone outcrops, forest edges, the shore.
        let tx = a.x;
        let ty = a.y;
        const pickR = rng.int(3);
        if (pickR === 0) {
          const s = this.nearestMemRes(a, R_STONE, 1);
          if (s >= 0 && Math.hypot(this.res[s]!.x - a.x, this.res[s]!.y - a.y) < 30) {
            tx = this.res[s]!.x + rng.range(-1.5, 1.5);
            ty = this.res[s]!.y + rng.range(-1.5, 1.5);
          }
        } else if (pickR === 1) {
          const w = this.wood[this.nearestWood(a.x + rng.range(-8, 8), a.y + rng.range(-8, 8))]!;
          tx = w.x + 1;
          ty = w.y + 1;
        } else {
          const p = this.randomLandNear(a.x, a.y, 5);
          tx = p.x;
          ty = p.y;
        }
        if (!this.landOK(tx, ty)) {
          tx = a.x;
          ty = a.y;
        }
        this.setAct(a, A_PLAY, tx, ty, -1);
        return;
      }
      case "social": {
        const n = this.queryNear(a.x, a.y, 14);
        let pick = -1;
        if (n > 1) {
          const k = rng.int(n);
          const idx = this.near[k]!;
          if (this.agents[idx] !== a) pick = idx;
        }
        if (pick >= 0) {
          const b = this.agents[pick]!;
          this.setAct(a, A_SOCIAL, b.x, b.y, b.id);
        } else {
          const p = this.randomLandNear(this.camp.x, this.camp.y, 8);
          this.setAct(a, A_SOCIAL, p.x, p.y, -1);
        }
        return;
      }
      default: {
        // Roam: mostly onward from here, sometimes back toward camp.
        const home = rng.chance(0.3);
        const p = home ? this.randomLandNear(this.camp.x, this.camp.y, 16) : this.randomLandNear(a.x, a.y, 30);
        this.setAct(a, A_WANDER, p.x, p.y, -1);
      }
    }
  }

  private ringPoint(x: number, y: number, r0: number, r1: number): { x: number; y: number } {
    for (let g = 0; g < 10; g++) {
      const ang = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(r0, r1);
      const xx = x + Math.cos(ang) * r;
      const yy = y + Math.sin(ang) * r * 0.75;
      if (this.landOK(xx, yy)) return { x: xx, y: yy };
    }
    return { x, y: y + r0 };
  }

  private chooseFood(a: Agent, chiefBias: number): void {
    const rng = this.rng;
    if (a.carry > 0) {
      this.eat(a, 1, false);
      a.carry--;
      this.setAct(a, A_IDLE, a.x, a.y);
      a.timer = 0.6;
      return;
    }
    // Gift crates nearby.
    for (let i = 0; i < this.structs.length; i++) {
      const s = this.structs[i]!;
      if (s.kind === S_CRATE && s.crateKind === R_BERRY && s.amt > 0 && Math.hypot(s.x - a.x, s.y - a.y) < 26) {
        this.setAct(a, A_CRATE, s.x, s.y, i);
        return;
      }
    }
    const opts: { act: number; ti: number; d: number }[] = [];
    const berry = this.nearestMemRes(a, R_BERRY, 1);
    if (berry >= 0) opts.push({ act: A_FORAGE, ti: berry, d: Math.hypot(this.res[berry]!.x - a.x, this.res[berry]!.y - a.y) });
    if (a.techs & bit(FISHING)) {
      const f = this.nearestMemRes(a, R_FISH, 1);
      if (f >= 0) opts.push({ act: A_FISH, ti: f, d: Math.hypot(this.res[f]!.x - a.x, this.res[f]!.y - a.y) * (chiefBias === FISHING ? 0.5 : 0.8) });
    }
    if (a.techs & bit(SPEAR)) {
      let g = -1;
      let gd = 30;
      for (let i = 0; i < this.goats.length; i++) {
        const go = this.goats[i]!;
        if (!go.alive) continue;
        const d = Math.hypot(go.x - a.x, go.y - a.y);
        if (d < gd) {
          gd = d;
          g = i;
        }
      }
      if (g >= 0) opts.push({ act: A_HUNT, ti: g, d: gd * (chiefBias === SPEAR ? 0.6 : 1.1) });
    }
    if (a.techs & bit(BOAT) && this.hasIslet) {
      const d = Math.hypot(this.launch.x - a.x, this.launch.y - a.y) + 14;
      opts.push({ act: A_SAIL, ti: -1, d: d * (chiefBias === BOAT ? 0.45 : 0.75) * (berry < 0 ? 0.4 : 1) });
    }
    if (!opts.length || (opts.length === 1 && opts[0]!.d > 26 && rng.chance(0.5))) {
      // Nothing (close) remembered: strike out and explore for food.
      const p = this.randomLandNear(a.x, a.y, 30);
      this.setAct(a, A_WANDER, p.x, p.y, -1);
      return;
    }
    let best = opts[0]!;
    for (const o of opts) if (o.d < best.d) best = o;
    if (best.act === A_HUNT) {
      const go = this.goats[best.ti]!;
      this.setAct(a, A_HUNT, go.x, go.y, best.ti);
    } else if (best.act === A_SAIL) {
      this.setAct(a, A_SAIL, this.launch.x, this.launch.y, -1);
    } else {
      const r = this.res[best.ti]!;
      this.setAct(a, best.act, r.x, r.y + (best.act === A_FORAGE ? 0.7 : 0), best.ti);
    }
  }

  private eat(a: Agent, units: number, cookedHere: boolean): void {
    const cooked = cookedHere ? 1.6 : 1;
    a.food = Math.min(1, a.food + 0.26 * units * cooked);
    a.starve = 0;
    // Feed toddlers close by.
    const n = this.queryNear(a.x, a.y, 4);
    for (let k = 0; k < n; k++) {
      const b = this.agents[this.near[k]!]!;
      if (b.age < 2.5 && b.alive) b.food = Math.min(1, b.food + 0.18 * cooked);
    }
  }

  // ------------------------------------------------------------- acting

  private act(a: Agent, dt: number): void {
    const toolMul = a.techs & bit(TOOLS) ? 1.7 : 1;
    const speed = SPEED * (a.age < 2.5 ? 0.85 : a.age > a.lifespan * 0.8 ? 0.7 : 1) * (a.food < 0.15 ? 0.7 : 1);
    switch (a.act) {
      case A_IDLE:
        a.moving = false;
        a.timer -= dt;
        if (a.timer <= 0) this.decide(a);
        break;
      case A_WANDER:
        if (this.moveTo(a, a.tx, a.ty, speed * 0.8, dt, 0.8)) this.done(a);
        break;
      case A_FOLLOW: {
        const p = this.agents.find((x) => x.id === a.ti && x.alive);
        if (!p) {
          this.done(a);
          break;
        }
        const dd = Math.hypot(p.x - a.x, p.y - a.y);
        if (dd > 1.6) this.moveTo(a, p.x - p.fx * 1.2, p.y - p.fy * 1.2 + 0.4, speed * 1.15, dt, 1);
        else a.moving = false;
        if (p.hut >= 0 && dd < 2) {
          // Toddlers sleep inside with their parent.
          a.act = A_SLEEP;
          a.hut = p.hut;
          a.ti = p.hut;
          a.phase = 1;
        }
        break;
      }
      case A_FORAGE: {
        const r = this.res[a.ti];
        if (!r) {
          this.done(a);
          break;
        }
        if (a.phase === 0) {
          if (this.moveTo(a, a.tx, a.ty, speed, dt)) {
            a.phase = 1;
            a.timer = 0.9 / toolMul;
          }
        } else {
          // Pick berries one by one until full (or the bush is bare).
          a.timer -= dt;
          a.moving = false;
          if (a.timer <= 0) {
            if (r.amt >= 1) {
              r.amt -= 1;
              const cookLater = a.techs & bit(COOKING) && a.food > 0.45 && a.carry < 3 && this.litFireNear(a.x, a.y, 30) >= 0;
              if (cookLater) a.carry++;
              else this.eat(a, 1, false);
              a.timer = 0.9 / toolMul;
              if ((a.food > 0.93 && !cookLater) || a.carry >= 3) this.done(a);
            } else {
              a.mem[a.ti] = 0;
              this.done(a);
            }
          }
        }
        break;
      }
      case A_CRATE: {
        const s = this.structs[a.ti];
        if (!s || s.amt <= 0) {
          this.done(a);
          break;
        }
        if (this.moveTo(a, s.x, s.y + 0.9, speed * 1.1, dt, 0.9)) {
          s.amt -= 1;
          this.eat(a, 1.4, false);
          a.carry = Math.min(2, a.carry + (s.amt > 4 ? 1 : 0));
          this.done(a);
        }
        break;
      }
      case A_FISH: {
        const r = this.res[a.ti];
        if (!r) {
          this.done(a);
          break;
        }
        if (a.phase === 0) {
          if (this.moveTo(a, r.ax, r.ay, speed, dt, 0.7)) {
            a.phase = 1;
            a.timer = 2.4;
          }
        } else {
          a.moving = false;
          a.timer -= dt;
          if (a.timer <= 0) {
            if (r.amt >= 1) {
              r.amt -= 1;
              this.fxPush(FX_FISH, a.x, a.y, 0, 0, 0.9, FISHING);
              if (a.techs & bit(COOKING) && this.litFireNear(a.x, a.y, 34) >= 0) a.carry = Math.min(3, a.carry + 2);
              else this.eat(a, 1.7, false);
            } else {
              a.mem[a.ti] = 0;
            }
            this.done(a);
            a.wading = false;
          }
        }
        break;
      }
      case A_HUNT: {
        const g = this.goats[a.ti];
        if (!g || !g.alive) {
          this.done(a);
          break;
        }
        a.timer += dt;
        if (this.moveTo(a, g.x, g.y, speed * 1.25, dt, 1.0)) {
          g.alive = false;
          g.respawn = DAY * this.rng.range(1.5, 3);
          this.fxPush(FX_SPLASH, g.x, g.y, 0, 0, 0.7, SPEAR);
          if (a.techs & bit(COOKING)) a.carry = Math.min(3, a.carry + 2);
          this.eat(a, 1.8, false);
          this.done(a);
        } else if (a.timer > 14) {
          this.done(a);
        }
        break;
      }
      case A_SAIL:
        this.sail(a, speed, dt);
        break;
      case A_WOOD: {
        // Fetch wood for a fire (ti = fire struct index).
        if (a.phase === 0) {
          if (this.moveTo(a, a.tx, a.ty, speed, dt, 0.9)) {
            a.phase = 1;
            a.timer = 1.6 / toolMul;
          }
        } else if (a.phase === 1) {
          a.moving = false;
          a.timer -= dt;
          if (a.timer <= 0) {
            a.carryWood = 1;
            a.phase = 2;
          }
        } else {
          const s = this.structs[a.ti];
          if (!s) {
            this.done(a);
            break;
          }
          if (this.moveTo(a, s.x, s.y + 1, speed, dt, 1.2)) {
            a.carryWood = 0;
            s.fuel = Math.min(1, s.fuel + 0.55);
            this.fxPush(FX_BUILD, s.x, s.y, 0, 0, 0.6, FIRE);
            this.done(a);
          }
        }
        break;
      }
      case A_BUILD:
        this.build(a, speed, dt, toolMul);
        break;
      case A_COOK: {
        const s = this.structs[a.ti];
        if (!s || s.fuel <= 0) {
          this.done(a);
          break;
        }
        if (a.phase === 0) {
          if (this.moveTo(a, a.tx, a.ty, speed, dt, 0.6)) {
            a.phase = 1;
            a.timer = 1.8;
          }
        } else {
          a.moving = false;
          a.timer -= dt;
          if (this.rng.next() < dt * 2.5) this.fxPush(FX_STEAM, s.x + this.rng.range(-0.5, 0.5), s.y - 0.4, 0, 0, 1.6, COOKING);
          if (a.timer <= 0) {
            const n = a.carry;
            a.carry = 0;
            this.eat(a, n, true);
            this.done(a);
          }
        }
        break;
      }
      case A_WARM:
      case A_SOCIAL:
      case A_PLAY: {
        let tx = a.tx;
        let ty = a.ty;
        if (a.act === A_SOCIAL && a.ti >= 0) {
          const b = this.agents.find((x) => x.id === a.ti && x.alive);
          if (b) {
            tx = b.x + (a.x > b.x ? 1.1 : -1.1);
            ty = b.y;
            if (a.phase === 0 && Math.hypot(b.x - a.x, b.y - a.y) < 1.8 && this.rng.next() < dt) {
              // Gossip shares the location of one remembered place.
              const k = this.rng.int(this.res.length);
              if (b.mem[k]) a.mem[k] = 1;
              if (a.mem[k]) b.mem[k] = 1;
            }
          }
        }
        if (a.phase === 0) {
          if (this.moveTo(a, tx, ty, speed * (a.act === A_PLAY ? 0.8 : 1), dt, 0.8)) {
            a.phase = 1;
            a.timer = a.act === A_PLAY ? 4.5 : a.act === A_WARM ? 6 : 3.5;
          }
        } else {
          a.moving = false;
          a.timer -= dt;
          if (a.timer <= 0) this.done(a);
        }
        break;
      }
      case A_SLEEP: {
        if (a.phase === 0) {
          if (this.moveTo(a, a.tx, a.ty, speed, dt, 0.7)) {
            a.phase = 1;
            if (a.ti >= 0) {
              const s = this.structs[a.ti]!;
              if (s.occ < 4) {
                s.occ++;
                a.hut = a.ti;
              }
            }
          }
        } else {
          a.moving = false;
          if (!this.isNight && a.energy > 0.7) this.done(a);
        }
        break;
      }
    }
  }

  private sail(a: Agent, speed: number, dt: number): void {
    switch (a.phase) {
      case 0:
        if (this.moveTo(a, this.launch.x, this.launch.y, speed, dt, 1.2)) {
          a.phase = 1;
          a.onBoat = true;
          this.fxPush(FX_SPLASH, a.x, a.y, 0, 0, 0.8, BOAT);
        }
        break;
      case 1:
        if (this.moveTo(a, this.landing.x, this.landing.y, speed * 1.2, dt, 0.8)) {
          a.onBoat = false;
          a.region = 2;
          a.phase = 2;
          a.timer = 0;
          for (let i = 0; i < this.res.length; i++) if (this.res[i]!.region === 2) a.mem[i] = 1;
        }
        break;
      case 2: {
        // Feast on the islet, then fill the raft.
        a.timer += dt;
        const r = this.nearestMemRes(a, R_BERRY, 2);
        if (r < 0 || a.timer > 16 || (a.food > 0.92 && a.carry >= 3)) {
          a.phase = 4;
          break;
        }
        const rs = this.res[r]!;
        if (this.moveTo(a, rs.x, rs.y + 0.6, speed, dt, 0.8)) {
          rs.amt -= 1;
          if (a.food < 0.92) this.eat(a, 1.2, false);
          else a.carry = Math.min(4, a.carry + 1);
        }
        break;
      }
      case 4:
        if (this.moveTo(a, this.landing.x, this.landing.y, speed, dt, 0.9)) {
          a.onBoat = true;
          a.phase = 5;
        }
        break;
      case 5:
        if (this.moveTo(a, this.launch.x, this.launch.y, speed * 1.2, dt, 0.8)) {
          a.onBoat = false;
          a.region = 1;
          this.fxPush(FX_SPLASH, a.x, a.y, 0, 0, 0.8, BOAT);
          a.phase = 0;
          a.act = A_IDLE;
          this.done(a);
        }
        break;
      default:
        a.phase = 4;
    }
  }

  private build(a: Agent, speed: number, dt: number, toolMul: number): void {
    const s = this.structs[a.ti];
    if (!s || s.progress >= 1) {
      a.carryWood = 0;
      this.done(a);
      return;
    }
    if (a.phase === 0) {
      // Need wood? fetch it; else work on site.
      if (s.wood < s.woodNeed && !a.carryWood) {
        const w = this.wood[this.nearestWood(s.x + this.rng.range(-4, 4), s.y + this.rng.range(-4, 4))]!;
        a.tx = w.x;
        a.ty = w.y + 0.8;
        a.phase = 1;
      } else {
        a.phase = 3;
      }
      return;
    }
    if (a.phase === 1) {
      if (this.moveTo(a, a.tx, a.ty, speed, dt, 0.9)) {
        a.phase = 2;
        a.timer = 1.4 / toolMul;
      }
      return;
    }
    if (a.phase === 2) {
      a.moving = false;
      a.timer -= dt;
      if (a.timer <= 0) {
        a.carryWood = 1;
        a.phase = 3;
      }
      return;
    }
    // phase 3: at the site.
    if (this.moveTo(a, s.x + ((a.id % 3) - 1) * 1.2, s.y + 1.1, speed, dt, 0.9)) {
      a.moving = false;
      if (a.carryWood) {
        a.carryWood = 0;
        s.wood++;
        this.fxPush(FX_BUILD, s.x, s.y, 0, 0, 0.6, -1);
      }
      if (s.wood >= s.woodNeed) {
        const ws = this.structNear(S_WORKSHOP, s.x, s.y, 14) >= 0 ? 1.8 : 1;
        const time = s.kind === S_FIRE ? 2.5 : s.kind === S_HUT ? 9 : 14;
        s.progress = Math.min(1, s.progress + (dt / time) * toolMul * ws);
        if (s.progress >= 1) {
          s.builtDay = this.dayNum;
          s.builder = a.name;
          if (s.kind === S_FIRE) s.fuel = 0.9;
          this.fxPush(FX_BUILD, s.x, s.y, 0, 0, 1.2, s.kind === S_FIRE ? FIRE : s.kind === S_HUT ? HUT : WORKSHOP);
          const first = this.countStructs(s.kind, -1e6, -1e6, 1e9);
          if (s.kind !== S_FIRE && first === 1) {
            this.addLog(this.dayNum, s.kind === S_HUT ? `${a.name} built the first hut 🛖` : `${a.name} raised a workshop ⚙️`, "build");
          } else if (s.kind === S_FIRE && this.countStructs(S_FIRE, -1e6, -1e6, 1e9) === 1) {
            this.addLog(this.dayNum, `${a.name} lit the first campfire 🔥`, "build");
          }
          this.done(a);
        }
      } else {
        a.phase = 0;
      }
    }
  }

  // ------------------------------------------------------------- lifecycle

  private die(a: Agent, cause: string): void {
    if (!a.alive) return;
    a.alive = false;
    a.dying = 1.5;
    a.cause = cause;
    if (a.hut >= 0) this.leaveHut(a);
    this.totalDeaths++;
    this.causes[cause] = (this.causes[cause] ?? 0) + 1;
    if (this.onDeath) this.onDeath(a);
    this.graves.push({ x: a.x, y: a.y, t: this.t, name: a.name });
    if (this.graves.length > 70) this.graves.shift();
    for (let t = 0; t < NTECH; t++) {
      if (a.techs & bit(t)) {
        this.techCount[t]!--;
        if (t > 0 && this.techCount[t]! <= 0) {
          this.techCount[t] = 0;
          this.known &= ~bit(t);
          this.addLog(this.dayNum, `${TECHS[t]!.name} was forgotten — ${a.name} was the last who knew`, "lost");
        }
      }
    }
    if (a.id === this.chief) {
      this.addLog(this.dayNum, `Chief ${a.name} died of ${cause}`, "death");
      this.chief = -1;
      this.chiefName = "";
    } else if (a.taught >= 6) {
      this.addLog(this.dayNum, `${a.name}, who taught ${a.taught}, died of ${cause}`, "death");
    }
  }

  private births(dt: number): void {
    const pop = this.agents.length;
    if (pop >= POP_CAP) return;
    const room = 1 - pop / POP_CAP;
    for (let i = 0, n = this.agents.length; i < n; i++) {
      const a = this.agents[i]!;
      if (!a.alive || a.age < 9 || a.age > a.lifespan * 0.78 || a.act !== A_SLEEP || a.phase !== 1) continue;
      if (a.food < 0.4 || a.warmth < 0.4) continue;
      const shelter = a.hut >= 0 ? 1.7 : this.litFireNear(a.x, a.y, 6) >= 0 ? 1.3 : 1;
      const p = 0.032 * room * shelter * dt * (a.children > 3 ? 0.4 : 1);
      if (this.rng.next() < p) {
        const kid = this.makeAgent(this.rng, a.x + 0.5, a.y + 0.3, 0, a.id);
        kid.hue = (a.hue + this.rng.range(-30, 30) + 360) % 360;
        kid.food = 0.8;
        kid.warmth = a.warmth;
        kid.region = a.region;
        if (a.hut >= 0) {
          kid.act = A_SLEEP;
          kid.phase = 1;
          kid.hut = a.hut;
          kid.ti = a.hut;
          this.structs[a.hut]!.occ++;
        }
        a.children++;
        this.totalBirths++;
        this.techCount[FORAGE]!++;
        this.agents.push(kid);
        this.fxPush(FX_BIRTH, kid.x, kid.y, 0, 0, 1.4, -1);
      }
    }
  }

  private election(): void {
    const as = this.agents;
    if (as.length < 3) return;
    const votes = new Map<number, number>();
    const score = (b: Agent): number => popcount(b.techs) * 1.5 + b.taught * 0.35 + Math.min(b.age, 40) / 9 + (b.id === this.chief ? 1 : 0);
    for (const a of as) {
      if (!a.alive || a.age < 4) continue;
      let best = -1;
      let bs = -Infinity;
      for (const b of as) {
        if (!b.alive || b.age < 8 || b === a) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 30) continue;
        const s = score(b) + this.rng.next() * 1.2 - d * 0.02;
        if (s > bs) {
          bs = s;
          best = b.id;
        }
      }
      if (best >= 0) votes.set(best, (votes.get(best) ?? 0) + 1);
    }
    let win = -1;
    let wv = 0;
    for (const [id, v] of votes) {
      if (v > wv || (v === wv && id < win)) {
        wv = v;
        win = id;
      }
    }
    if (win < 0) return;
    const w = as.find((x) => x.id === win)!;
    const re = win === this.chief;
    this.chief = win;
    this.chiefName = w.name;
    this.addLog(this.dayNum, re ? `${w.name} re-elected chief 👑 (${wv} votes)` : `${w.name} elected chief 👑 (${wv} votes)`, "chief");
    this.fxPush(FX_ELECT, w.x, w.y, 0, 0, 2.4, -1);
    // The chief chooses where the camp is: drift toward them if they live far away.
    if (w.region === 1 && Math.hypot(w.x - this.camp.x, w.y - this.camp.y) > 12) {
      const ty = tileAt(this.terrain, w.x, w.y);
      if (ty === T_GRASS || ty === T_SAND || ty === T_FOREST) {
        this.camp = { x: this.camp.x * 0.35 + w.x * 0.65, y: this.camp.y * 0.35 + w.y * 0.65 };
        if (!this.landOK(this.camp.x, this.camp.y)) this.camp = { x: w.x, y: w.y };
        this.addLog(this.dayNum, `${w.name} moved the camp`, "chief");
      }
    }
  }

  // ------------------------------------------------------------- gifts

  dropGift(kind: "lightning" | "food" | "stone", x: number, y: number): boolean {
    let lx = x;
    let ly = y;
    let onLand = regionAt(this.terrain, x, y) > 0;
    if (!onLand) {
      // Snap to the nearest land within a few tiles.
      let bd = 7 * 7;
      for (let dy = -6; dy <= 6; dy++) {
        for (let dx = -6; dx <= 6; dx++) {
          const d = dx * dx + dy * dy;
          if (d < bd && regionAt(this.terrain, x + dx, y + dy) > 0) {
            bd = d;
            lx = x + dx;
            ly = y + dy;
            onLand = true;
          }
        }
      }
    }
    if (kind === "lightning") {
      this.fxPush(FX_LIGHTNING, x, y, 0, 0, 1.3, FIRE);
      if (!onLand) {
        this.fxPush(FX_SPLASH, x, y, 0, 0, 1, -1);
        return false;
      }
      this.structs.push({
        kind: S_WILDFIRE, x: lx, y: ly, progress: 1, wood: 0, woodNeed: 0, fuel: 1, occ: 0, amt: 0, crateKind: 0,
        builtDay: this.dayNum, builder: "", born: this.t,
      });
      this.addLog(this.dayNum, `Lightning struck — a wildfire burns ⚡`, "gift");
      const n = this.queryNear(lx, ly, 16);
      for (let k = 0; k < n; k++) {
        const a = this.agents[this.near[k]!]!;
        a.sawFire = DAY * 2;
      }
      return true;
    }
    if (!onLand) {
      this.fxPush(FX_SPLASH, x, y, 0, 0, 1, -1);
      return false;
    }
    this.structs.push({
      kind: S_CRATE, x: lx, y: ly, progress: 1, wood: 0, woodNeed: 0, fuel: 0, occ: 0,
      amt: kind === "food" ? 18 : 12, crateKind: kind === "food" ? R_BERRY : R_STONE,
      builtDay: this.dayNum, builder: "", born: this.t,
    });
    this.fxPush(FX_CRATE, lx, ly, 0, 0, 1.2, -1);
    this.addLog(this.dayNum, kind === "food" ? "A crate of food fell from the sky 🎁" : "A crate of flint fell from the sky 🎁", "gift");
    if (kind === "stone") {
      // Flint near tinkerers: a strong nudge toward tools.
      const n = this.queryNear(lx, ly, 14);
      for (let k = 0; k < n; k++) {
        const a = this.agents[this.near[k]!]!;
        if (a.act !== A_SLEEP) this.setAct(a, A_PLAY, lx + this.rng.range(-2, 2), ly + this.rng.range(-1.5, 2), -1);
      }
    }
    return true;
  }

  // ------------------------------------------------------------- main step

  step(dt = DT): void {
    this.t += dt;
    this.steps++;
    const rng = this.rng;
    const day = Math.floor(this.t / DAY);
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.onNewDay(day);
    }

    this.buildGrid();

    // Environment (every 0.25 s): berries regrow / wither; fish regenerate; fires burn down.
    this.envAcc += dt;
    if (this.envAcc >= 0.25) {
      const edt = this.envAcc;
      this.envAcc = 0;
      const harsh = this.settings.harsh;
      const winter = this.winter;
      const berryCap = Math.max(0.15, 1 - 0.5 * harsh - 0.42 * winter * (0.6 + harsh));
      const grow = ((0.6 - 0.32 * harsh) * (1 - winter * (0.45 + 0.5 * harsh)) * 3.4) / DAY;
      for (const r of this.res) {
        if (r.kind === R_BERRY) {
          const cap = r.max * (r.region === 2 ? Math.max(0.5, berryCap) : berryCap);
          if (r.amt < cap) r.amt = Math.min(cap, r.amt + edt * r.regen * grow);
          else if (r.amt > cap + 0.01) r.amt = Math.max(cap, r.amt - edt * 0.5);
        } else if (r.kind === R_FISH) {
          if (r.amt < r.max) r.amt = Math.min(r.max, r.amt + (edt * r.regen * 4) / DAY);
        }
      }
      for (const s of this.structs) {
        if (s.kind === S_FIRE && s.progress >= 1 && s.fuel > 0) s.fuel = Math.max(0, s.fuel - edt / (DAY * 0.9));
        else if (s.kind === S_WILDFIRE && s.fuel > 0) s.fuel = Math.max(0, s.fuel - edt / (DAY * 1.4));
      }
    }
    for (const g of this.goats) this.stepGoat(g, dt);

    // Natural lightning in summer: rare.
    if (this.t > this.nextLightning) {
      this.nextLightning = this.t + DAY * rng.range(7, 14);
      if (this.winter < 0.2) {
        const p = this.randomLandNear(this.terrain.peak.x, this.terrain.peak.y, 26);
        this.dropGift("lightning", p.x, p.y);
        this.log[this.log.length - 1]!.text = "A storm: lightning sets the hills alight ⚡";
      }
    }

    const amb = this.ambient();
    const winterBurn = 1 + this.winter * 0.25;
    const as = this.agents;
    for (let i = 0; i < as.length; i++) {
      const a = as[i]!;
      if (!a.alive) {
        a.dying -= dt;
        continue;
      }
      a.age += dt / DAY;
      if (a.teachCool > 0) a.teachCool -= dt;
      if (a.learnFx > 0) a.learnFx -= dt;
      if (a.sawFire > 0) a.sawFire -= dt;

      // Needs.
      const baby = a.age < 2.5 ? 0.5 : 1;
      const burn = (a.act === A_SLEEP && a.phase === 1 ? 0.55 : 1) * winterBurn;
      a.food = Math.max(0, a.food - (dt / (DAY * 3)) * burn * baby);
      let target = amb;
      if (a.hut >= 0) target = Math.max(target, 0.88);
      else if (a.nearFire) target = 1;
      // Huddling: bodies keep each other warm.
      if (a.huddle >= 2) target = Math.min(1, target + 0.07 * Math.min(4, a.huddle));
      a.warmth += (target - a.warmth) * Math.min(1, dt / (DAY * 0.35));
      if (a.act === A_SLEEP && a.phase === 1) {
        a.energy = Math.min(1, a.energy + (dt / (DAY * 0.22)) * (a.hut >= 0 ? 1.5 : 1));
      } else {
        a.energy = Math.max(0, a.energy - dt / (DAY * 1.7));
      }
      if (a.food <= 0) a.starve += dt;
      else a.starve = Math.max(0, a.starve - dt);
      if (a.warmth < 0.1) a.freeze += dt * (0.1 - a.warmth) * 10;
      else a.freeze = Math.max(0, a.freeze - dt);
      if (a.starve > DAY * 1.3) {
        this.die(a, "hunger");
        continue;
      }
      if (a.freeze > DAY * 0.8) {
        this.die(a, "cold");
        continue;
      }
      if (a.age > a.lifespan) {
        this.die(a, "old age");
        continue;
      }

      a.decide -= dt;
      if (a.decide <= 0) {
        a.decide = DECIDE + rng.next() * 0.3;
        this.look(a);
        a.nearFire = a.hut < 0 && this.litFireNear(a.x, a.y, 5) >= 0;
        a.huddle = a.onBoat || a.hut >= 0 ? 0 : this.queryNear(a.x, a.y, 2.2) - 1;
        this.tryInvent(a, DECIDE);
        if (a.act !== A_IDLE && this.shouldRethink(a)) this.decide(a);
      }
      this.act(a, dt);
    }

    // Gentle separation so crowds don't overlap (every other step).
    for (let i = this.steps & 1 ? as.length : 0; i < as.length; i++) {
      const a = as[i]!;
      if (!a.alive || a.onBoat || a.hut >= 0) continue;
      const n = this.queryNear(a.x, a.y, 1.25);
      for (let k = 0; k < n; k++) {
        const b = as[this.near[k]!]!;
        if (b === a) continue;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-4) {
          dx = ((a.id * 37) % 7) - 3;
          dy = ((a.id * 13) % 5) - 2;
          d = Math.hypot(dx, dy) || 1;
        }
        const push = (1.25 - d) * dt * 4;
        const nx = a.x + (dx / d) * push;
        const ny = a.y + (dy / d) * push;
        if (this.walkable(a, nx, ny)) {
          a.x = nx;
          a.y = ny;
        }
      }
    }

    this.teachAcc += dt;
    if (this.teachAcc >= TEACH_TICK) {
      this.teachAcc -= TEACH_TICK;
      this.buildGrid();
      this.teachStep(TEACH_TICK);
      this.births(TEACH_TICK);
    }

    // Remove faded corpses.
    let w = 0;
    for (let i = 0; i < as.length; i++) {
      const a = as[i]!;
      if (a.alive || a.dying > 0) as[w++] = a;
    }
    as.length = w;

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]!;
      f.t += dt;
      if (f.t > f.life) this.fx.splice(i, 1);
    }
    this.sampleAcc += dt;
    if (this.sampleAcc >= DAY / 6) {
      this.sampleAcc -= DAY / 6;
      this.sample();
    }
  }

  private stepGoat(g: Goat, dt: number): void {
    if (!g.alive) {
      g.respawn -= dt;
      if (g.respawn <= 0) Object.assign(g, this.spawnGoat(this.rng));
      return;
    }
    g.timer -= dt;
    // Flee from nearby hunters.
    let fx = 0;
    let fy = 0;
    const n = this.queryNear(g.x, g.y, 5);
    for (let k = 0; k < n; k++) {
      const a = this.agents[this.near[k]!]!;
      if (a.act !== A_HUNT) continue;
      fx += g.x - a.x;
      fy += g.y - a.y;
    }
    if (fx || fy) {
      const d = Math.hypot(fx, fy);
      g.vx = (fx / d) * 2.3;
      g.vy = (fy / d) * 2.3;
    } else if (g.timer <= 0) {
      g.timer = this.rng.range(1.5, 4);
      const ang = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.chance(0.4) ? 0 : this.rng.range(0.4, 1);
      g.vx = Math.cos(ang) * sp;
      g.vy = Math.sin(ang) * sp;
    }
    const nx = g.x + g.vx * dt;
    const ny = g.y + g.vy * dt;
    if (this.landOK(nx, ny)) {
      g.x = nx;
      g.y = ny;
    } else {
      g.vx = -g.vx;
      g.vy = -g.vy;
    }
  }

  private onNewDay(day: number): void {
    // Keep the island alive: a raft of castaways arrives if almost everyone is gone.
    if (day > 0 && this.alivePop() < 5) {
      const p = this.hasIslet ? this.launch : this.camp;
      for (let k = 0; k < 7; k++) {
        const q = this.randomLandNear(p.x, p.y, 5);
        const a = this.makeAgent(this.rng, q.x, q.y, this.rng.range(8, 20), -1);
        a.food = 0.8;
        this.agents.push(a);
        this.techCount[FORAGE]!++;
      }
      this.addLog(this.dayNum, "Castaways wash ashore, knowing nothing 🛶", "start");
    }
    if (day % 5 === 1 && this.agents.length > 2) this.election();
    const w = this.winter;
    if (w > 0.5 && !this.winterLogged) {
      this.winterLogged = true;
      this.addLog(this.dayNum, this.settings.harsh > 0.6 ? "A brutal winter sets in ❄" : "Winter comes ❄", "season");
    } else if (w < 0.2 && this.winterLogged) {
      this.winterLogged = false;
      this.addLog(this.dayNum, "Spring returns 🌱", "season");
    }
    // Milestone: half the island knows a tech.
    const pop = this.agents.length;
    for (let t = 1; t < NTECH; t++) {
      if (this.halfLogged & bit(t)) continue;
      if (pop > 4 && this.techCount[t]! >= pop * 0.5) {
        this.halfLogged |= bit(t);
        this.addLog(this.dayNum, `Half the island now knows ${TECHS[t]!.name.toLowerCase()} ${TECHS[t]!.glyph}`, "spread");
      }
    }
  }

  private recount(): void {
    this.techCount.fill(0);
    this.known = 0;
    for (const a of this.agents) {
      if (!a.alive) continue;
      for (let t = 0; t < NTECH; t++) {
        if (a.techs & bit(t)) {
          this.techCount[t]!++;
          this.known |= bit(t);
        }
      }
    }
    this.everKnown |= this.known;
  }

  private sample(): void {
    const pop = this.alivePop();
    let sum = 0;
    for (const a of this.agents) if (a.alive) sum += popcount(a.techs);
    this.history.push({ day: this.day, pop, techs: popcount(this.known), avg: pop ? sum / pop : 0 });
    if (this.history.length > 720) {
      // Thin out old samples to keep memory bounded.
      this.history = this.history.filter((_, i) => i % 2 === 0 || i > this.history.length - 200);
    }
  }

  alivePop(): number {
    let n = 0;
    for (const a of this.agents) if (a.alive) n++;
    return n;
  }

  techsKnown(): number {
    return popcount(this.known);
  }

  avgTechs(): number {
    let s = 0;
    let n = 0;
    for (const a of this.agents) {
      if (!a.alive) continue;
      s += popcount(a.techs);
      n++;
    }
    return n ? s / n : 0;
  }

  agentById(id: number): Agent | undefined {
    for (const a of this.agents) if (a.id === id) return a;
    return undefined;
  }

  /** FNV-1a over the essential state, for determinism checks. */
  hash(): string {
    let h = 0x811c9dc5;
    const mix = (v: number): void => {
      h ^= v | 0;
      h = Math.imul(h, 0x01000193);
    };
    mix(this.agents.length);
    mix(this.known);
    mix(this.rng.state());
    for (const a of this.agents) {
      mix(a.id);
      mix(Math.round(a.x * 1000));
      mix(Math.round(a.y * 1000));
      mix(Math.round(a.food * 1e5));
      mix(a.techs);
      mix(a.act);
    }
    for (const s of this.structs) {
      mix(s.kind);
      mix(Math.round(s.progress * 1e4));
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  /** Every living creature knows the prerequisites of each tech it knows. */
  prereqsOK(): boolean {
    for (const a of this.agents) {
      for (let t = 0; t < NTECH; t++) {
        if (a.techs & bit(t) && (a.techs & TECHS[t]!.prereq) !== TECHS[t]!.prereq) return false;
      }
    }
    return true;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

// =====================================================================
// Self-test (headless)
// =====================================================================

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export function runSelfTest(days = 25): { ok: boolean; checks: Check[]; ms: number } {
  const t0 = performance.now();
  const checks: Check[] = [];
  const steps = Math.round((days * DAY) / (DT * 2));
  const seeds = [11, 2026, 777];
  let lowSum = 0;
  let highSum = 0;
  let popOK = true;
  let prereqOK = true;
  let popDetail = "";
  for (const seed of seeds) {
    const terrain = generateTerrain(seed, false);
    const lo = new World(seed, { teach: 0, harsh: 0.35 }, { terrain });
    const hi = new World(seed, { teach: 0.8, harsh: 0.35 }, { terrain });
    let minPop = Infinity;
    let maxPop = 0;
    for (let i = 0; i < steps; i++) {
      lo.step(DT * 2);
      hi.step(DT * 2);
      if (i % 100 === 0) {
        const p = hi.alivePop();
        minPop = Math.min(minPop, p);
        maxPop = Math.max(maxPop, p);
        if (!lo.prereqsOK() || !hi.prereqsOK()) prereqOK = false;
      }
    }
    lowSum += lo.techsKnown();
    highSum += hi.techsKnown();
    if (!(minPop > 0 && maxPop <= POP_CAP)) popOK = false;
    popDetail += `seed ${seed}: pop ${minPop}–${maxPop}; `;
  }
  checks.push({
    name: "ratchet: teaching 0.8 > teaching 0 (techs known after " + days + " days, mean of 3 seeds)",
    ok: highSum / 3 > lowSum / 3,
    detail: `teach 0.8 → ${(highSum / 3).toFixed(2)}, teach 0 → ${(lowSum / 3).toFixed(2)}`,
  });
  {
    const a = new World(4242, { teach: 0.4, harsh: 0.35 });
    const b = new World(4242, { teach: 0.4, harsh: 0.35 });
    const n = Math.round((8 * DAY) / DT);
    for (let i = 0; i < n; i++) {
      a.step();
      b.step();
    }
    const ha = a.hash();
    const hb = b.hash();
    checks.push({ name: "determinism: same seed + settings → same state hash", ok: ha === hb, detail: `${ha} vs ${hb}` });
  }
  checks.push({ name: `population stays in (0, ${POP_CAP}]`, ok: popOK, detail: popDetail.trim() });
  checks.push({ name: "tech prerequisites respected", ok: prereqOK, detail: prereqOK ? "no creature knows a tech without its prereqs" : "violation found" });
  const ms = performance.now() - t0;
  return { ok: checks.every((c) => c.ok), checks, ms };
}
