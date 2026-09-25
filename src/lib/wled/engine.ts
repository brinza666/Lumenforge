import { mixRgb, sampleStops, stopsFor, type RGB } from "./palettes.ts";

export type AudioLevels = {
  active: boolean;
  energy: number;
  bass: number;
  mid: number;
  high: number;
  peak: boolean;
  synthetic: boolean;
};

export const SILENT_AUDIO: AudioLevels = {
  active: false,
  energy: 0,
  bass: 0,
  mid: 0,
  high: 0,
  peak: false,
  synthetic: true,
};

export type ForgeParams = {
  n: number;
  t: number;
  dt: number;
  speed: number;
  intensity: number;
  size: number;
  spark: number;
  colors: [RGB, RGB, RGB];
  paletteId: number;
  mirror: boolean;
  reverse: boolean;
  audio: AudioLevels;
};

export type EffectDef = {
  id: string;
  name: string;
  fxName: string;
  blurb: string;
  nativeName: string;
  audio: boolean;
  defaults: { speed: number; intensity: number; size: number; spark: number; paletteId: number };
};

type EngineState = {
  heat: Float32Array;
  px: Float32Array;
  pv: Float32Array;
  pl: Float32Array;
  ripX: Float32Array;
  ripA: Float32Array;
  seed: number;
  aux: number;
};

const MAX_P = 20;

function makeState(n: number): EngineState {
  const s: EngineState = {
    heat: new Float32Array(Math.max(1, n)),
    px: new Float32Array(MAX_P),
    pv: new Float32Array(MAX_P),
    pl: new Float32Array(MAX_P),
    ripX: new Float32Array(10),
    ripA: new Float32Array(10),
    seed: 1,
    aux: 0,
  };
  for (let i = 0; i < 10; i++) s.ripA[i] = 99;
  return s;
}

function rnd(s: EngineState): number {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}

function write(buf: Uint8ClampedArray, i: number, c: RGB, gain = 1) {
  const o = i * 3;
  const g = gain < 0 ? 0 : gain;
  buf[o] = c[0] * g;
  buf[o + 1] = c[1] * g;
  buf[o + 2] = c[2] * g;
}

function blendMax(buf: Uint8ClampedArray, n: number, i: number, c: RGB, gain: number) {
  if (i < 0 || i >= n) return;
  const o = i * 3;
  buf[o] = Math.max(buf[o], c[0] * gain);
  buf[o + 1] = Math.max(buf[o + 1], c[1] * gain);
  buf[o + 2] = Math.max(buf[o + 2], c[2] * gain);
}

function paintPalette(p: ForgeParams, buf: Uint8ClampedArray, pixel: (i: number, u: number) => { idx: number; gain: number }) {
  const { stops, discrete } = stopsFor(p.paletteId, p.colors, p.t);
  for (let i = 0; i < p.n; i++) {
    const u = p.n <= 1 ? 0 : i / (p.n - 1);
    const s = pixel(i, u);
    write(buf, i, sampleStops(stops, s.idx, discrete), s.gain);
  }
}

function env(p: ForgeParams): number {
  if (!p.audio.active) return 1;
  return 0.4 + Math.min(1, p.audio.energy) * 1.15;
}

function hash1(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}

function renderTide(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const spd = 0.35 + (p.speed / 255) * 2.4;
  const depth = 0.35 + (p.intensity / 255) * 0.65;
  const width = 0.15 + (p.size / 255) * 1.4;
  paintPalette(p, buf, (i, u) => {
    const a = Math.sin(u * Math.PI * (2 + width) + p.t * spd);
    const b = Math.sin(u * Math.PI * (1.2 + width * 0.4) - p.t * spd * 0.72 + 1.3);
    const crest = Math.pow(Math.max(0, a * 0.62 + b * 0.38), 1.15);
    const foam = Math.pow(hash1(i * 3 + Math.floor(p.t * (2 + p.spark / 40))), 8) * (p.spark / 255);
    return { idx: (u * 180 + p.t * 18 + crest * 40) % 256, gain: (0.12 + crest * depth + foam) * env(p) };
  });
}

function renderEmber(p: ForgeParams, s: EngineState, buf: Uint8ClampedArray) {
  const n = p.n;
  const cooling = (1.2 + ((255 - p.intensity) / 255) * 7) * (0.55 + p.speed / 280);
  for (let i = 0; i < n; i++) s.heat[i] = Math.max(0, s.heat[i] - rnd(s) * cooling);
  for (let i = n - 1; i >= 2; i--) {
    s.heat[i] = (s.heat[i - 1] + s.heat[i - 2] + s.heat[i - 2]) / 3;
  }
  const sparking = 30 + p.spark * 0.85;
  if (rnd(s) * 255 < sparking) {
    const y = Math.floor(rnd(s) * Math.max(1, Math.min(n, 2 + Math.round(p.size / 28))));
    s.heat[y] = Math.min(255, 170 + rnd(s) * 85);
  }
  const { stops, discrete } = stopsFor(p.paletteId, p.colors, p.t);
  const gain = env(p);
  for (let i = 0; i < n; i++) {
    const h = Math.min(1, s.heat[i] / 255);
    write(buf, i, sampleStops(stops, 12 + h * 240, discrete), Math.pow(h, 0.85) * gain);
  }
}

function renderComet(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const spd = 0.15 + (p.speed / 255) * 1.8;
  const tail = Math.max(3, (p.size / 255) * p.n * 0.55);
  const head = ((p.t * spd * p.n) % p.n + p.n) % p.n;
  const head2 = (head + p.n * 0.5) % p.n;
  const second = p.spark > 140;
  paintPalette(p, buf, (i) => {
    let d = (head - i + p.n) % p.n;
    if (second) d = Math.min(d, (head2 - i + p.n) % p.n);
    const body = d < tail ? Math.pow(1 - d / tail, 1.6 + (255 - p.intensity) / 180) : 0;
    return { idx: (i * 2 + p.t * 24) % 256, gain: (0.03 + body) * env(p) };
  });
}

function renderGlint(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const spd = 0.4 + p.speed / 70;
  const density = 0.02 + (p.spark / 255) * 0.2;
  paintPalette(p, buf, (i, u) => {
    const wash = 0.08 + 0.1 * Math.sin(u * Math.PI * 2 + p.t * 0.3);
    const cell = Math.floor(p.t * spd) * 17 + i * 13;
    const tw = hash1(cell);
    const on = tw > 1 - density ? Math.pow((tw - (1 - density)) / density, 0.4) : 0;
    const hold = hash1(cell + 3);
    const life = hold > 0.4 ? on * (0.5 + p.intensity / 400) : on * 0.3;
    return { idx: (u * 220 + hold * 30) % 256, gain: (wash + life) * env(p) };
  });
}

function renderPendulum(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const spd = 0.25 + (p.speed / 255) * 2.2;
  const phase = (Math.sin(p.t * spd) * 0.5 + 0.5) * (p.n - 1);
  const width = Math.max(1.2, (p.size / 255) * p.n * 0.18);
  paintPalette(p, buf, (i, u) => {
    const d = Math.abs(i - phase);
    const beam = Math.exp(-(d * d) / (2 * width * width));
    const echo = p.spark > 80 ? Math.exp(-(((i - (p.n - 1 - phase)) ** 2) / (2 * width * width))) * 0.45 : 0;
    return { idx: (u * 140 + beam * 80) % 256, gain: (0.04 + Math.max(beam, echo) * (0.45 + p.intensity / 400)) * env(p) };
  });
}

function renderWell(p: ForgeParams, s: EngineState, buf: Uint8ClampedArray) {
  const rate = 0.15 + (p.speed / 255) * 2.2;
  if (p.t - s.aux > 1 / rate) {
    s.aux = p.t;
    let slot = 0;
    for (let k = 1; k < s.ripA.length; k++) if (s.ripA[k] > s.ripA[slot]) slot = k;
    s.ripX[slot] = rnd(s) * p.n;
    s.ripA[slot] = 0;
  }
  for (let k = 0; k < s.ripA.length; k++) if (s.ripA[k] < 40) s.ripA[k] += p.dt * (0.7 + p.intensity / 180);
  const { stops, discrete } = stopsFor(p.paletteId, p.colors, p.t);
  const ring = 1.5 + (p.size / 255) * 6;
  for (let i = 0; i < p.n; i++) {
    let v = 0.035;
    for (let k = 0; k < s.ripA.length; k++) {
      const age = s.ripA[k];
      if (age > 8) continue;
      const radius = age * p.n * 0.12;
      const d = Math.abs(i - s.ripX[k]);
      const band = Math.exp(-((d - radius) ** 2) / (2 * ring * ring));
      v += band * Math.max(0, 1 - age / 6);
    }
    const spark = hash1(i * 9 + Math.floor(p.t * 4)) > 1 - p.spark / 900 ? 0.35 : 0;
    write(buf, i, sampleStops(stops, (i * 3 + p.t * 20) % 256, discrete), (v + spark) * env(p));
  }
}

function renderRiver(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const spd = 0.15 + (p.speed / 255) * 1.6;
  const scale = 0.08 + (p.size / 255) * 0.45;
  paintPalette(p, buf, (i, u) => {
    const n1 = noise1(i * scale + p.t * spd);
    const n2 = noise1(i * scale * 2.1 - p.t * spd * 0.6 + 8);
    const v = n1 * 0.7 + n2 * 0.3;
    const glitter = hash1(i + Math.floor(p.t * 12)) > 1 - p.spark / 800 ? 0.35 : 0;
    return {
      idx: (u * 90 + v * 140 + p.t * 10) % 256,
      gain: (0.08 + v * (0.35 + p.intensity / 300) + glitter) * env(p),
    };
  });
}

function renderThrob(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const spd = 0.4 + (p.speed / 255) * 1.8;
  const phase = (p.t * spd) % 1;
  const bump = (x: number, c: number) => {
    const d = Math.abs(x - c);
    return Math.exp(-((d * 18) ** 2));
  };
  const beat = bump(phase, 0.12) + 0.62 * bump(phase, 0.28);
  const audio = p.audio.active ? 0.45 + p.audio.bass * 1.3 : beat;
  paintPalette(p, buf, (i, u) => {
    const edge = 0.75 + 0.25 * Math.sin(u * Math.PI * (2 + p.size / 80) + p.t);
    return { idx: (u * 160 + audio * 40) % 256, gain: audio * edge * (0.35 + p.intensity / 400) * (p.audio.active ? 1 : 1) };
  });
}

function renderMarquee(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const block = Math.max(1, Math.round(1 + (p.size / 255) * 8));
  const gap = Math.max(1, Math.round(1 + ((255 - p.intensity) / 255) * 6));
  const spd = (p.speed / 255) * p.n * 0.8;
  const shift = Math.floor(p.t * spd);
  paintPalette(p, buf, (i) => {
    const x = (i + shift) % (block + gap);
    const on = x < block;
    const glint = on && hash1(i + shift) > 1 - p.spark / 500 ? 1 : 0.75;
    return { idx: ((i + shift) * 4) % 256, gain: (on ? glint : 0.025) * env(p) };
  });
}

function renderVeil(p: ForgeParams, _s: EngineState, buf: Uint8ClampedArray) {
  const bands = 2 + Math.round((p.intensity / 255) * 3);
  const spd = 0.12 + (p.speed / 255) * 0.9;
  paintPalette(p, buf, (_i, u) => {
    let v = 0;
    let shift = 0;
    for (let b = 0; b < bands; b++) {
      const width = 0.07 + (p.size / 255) * 0.16 + b * 0.015;
      const center = 0.5 + 0.42 * Math.sin(p.t * spd * (0.7 + b * 0.21) + b * 1.7);
      const d = u - center;
      const g = Math.exp(-(d * d) / (2 * width * width));
      v += g * (0.55 + 0.45 * Math.sin(p.t * 0.8 + b));
      shift += g * b * 36;
    }
    const dust = hash1(Math.floor(u * 80) + Math.floor(p.t * 2)) > 1 - p.spark / 700 ? 0.25 : 0;
    return { idx: (u * 150 + shift + p.t * 8) % 256, gain: (Math.min(1, v) * 0.85 + dust) * env(p) };
  });
}

function renderDrizzle(p: ForgeParams, s: EngineState, buf: Uint8ClampedArray) {
  const { stops, discrete } = stopsFor(p.paletteId, p.colors, p.t);
  const bg = sampleStops(stops, 18, discrete);
  for (let i = 0; i < p.n; i++) write(buf, i, bg, 0.05 * env(p));
  const count = 8 + Math.round((p.intensity / 255) * 10);
  const spawn = 0.15 + (p.spark / 255) * 1.4;
  for (let k = 0; k < count; k++) {
    if (s.pl[k] <= 0) {
      if (rnd(s) < spawn * p.dt) {
        s.px[k] = rnd(s) * (p.n - 1);
        s.pv[k] = (0.25 + p.speed / 255) * (0.35 + rnd(s));
        s.pl[k] = 0.6 + rnd(s) * 0.8;
      }
      continue;
    }
    s.px[k] += s.pv[k] * p.dt * 46;
    s.pl[k] -= p.dt * (0.45 + p.size / 500);
    if (s.px[k] >= p.n || s.pl[k] <= 0) {
      s.pl[k] = 0;
      continue;
    }
    const col = sampleStops(stops, 40 + k * 12 + s.pl[k] * 80, discrete);
    const head = Math.floor(s.px[k]);
    blendMax(buf, p.n, head, col, s.pl[k] * env(p));
    blendMax(buf, p.n, head - 1, col, s.pl[k] * 0.45 * env(p));
    blendMax(buf, p.n, head - 2, col, s.pl[k] * 0.2 * env(p));
  }
}

function renderRibbon(p: ForgeParams, s: EngineState, buf: Uint8ClampedArray) {
  const fallbackBass = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(p.t * Math.PI * 2 * (0.8 + p.speed / 400))), 10);
  const bass = p.audio.active ? p.audio.bass : fallbackBass;
  const mid = p.audio.active ? p.audio.mid : 0.28 + 0.22 * Math.sin(p.t * 2.2);
  const high = p.audio.active ? p.audio.high : 0.12 + 0.18 * Math.sin(p.t * 7.5);
  const peak = p.audio.active ? p.audio.peak : fallbackBass > 0.72;
  if (peak) s.aux = 0;
  s.aux += p.dt * (0.8 + p.speed / 180) * p.n;
  if (s.aux > p.n) s.aux = 0;
  paintPalette(p, buf, (i, u) => {
    const band = u < 0.34 ? bass : u < 0.67 ? mid : high;
    const flutter = 0.6 + 0.4 * Math.sin(u * (8 + p.size / 30) + p.t * (1 + p.speed / 80) + band * 5);
    const head = Math.exp(-((i - s.aux) ** 2) / (2 * (1.4 + p.spark / 40) ** 2));
    return {
      idx: (u * 200 + band * 50 + p.t * 16) % 256,
      gain: (0.08 + band * flutter * (0.4 + p.intensity / 280) + head * 0.85) * (p.audio.active ? 1 : 1),
    };
  });
}

const RENDERERS: Record<string, (p: ForgeParams, s: EngineState, buf: Uint8ClampedArray) => void> = {
  tide: renderTide,
  emberline: renderEmber,
  comet: renderComet,
  glint: renderGlint,
  pendulum: renderPendulum,
  well: renderWell,
  river: renderRiver,
  throb: renderThrob,
  marquee: renderMarquee,
  veil: renderVeil,
  drizzle: renderDrizzle,
  ribbon: renderRibbon,
};

export const EFFECTS: EffectDef[] = [
  {
    id: "veil",
    name: "Veil",
    fxName: "LF Veil",
    blurb: "Slow sheets of color crossing a dark room.",
    nativeName: "Aurora",
    audio: false,
    defaults: { speed: 42, intensity: 160, size: 110, spark: 40, paletteId: 50 },
  },
  {
    id: "tide",
    name: "Tide",
    fxName: "LF Tide",
    blurb: "Two seas moving through each other.",
    nativeName: "Pacifica",
    audio: false,
    defaults: { speed: 56, intensity: 170, size: 90, spark: 30, paletteId: 9 },
  },
  {
    id: "emberline",
    name: "Emberline",
    fxName: "LF Emberline",
    blurb: "Heat climbing the strip and cooling as it goes.",
    nativeName: "Fire 2012",
    audio: false,
    defaults: { speed: 90, intensity: 140, size: 40, spark: 160, paletteId: 35 },
  },
  {
    id: "comet",
    name: "Comet",
    fxName: "LF Comet",
    blurb: "A bright head with a long fading tail.",
    nativeName: "Sinelon",
    audio: false,
    defaults: { speed: 80, intensity: 180, size: 90, spark: 40, paletteId: 11 },
  },
  {
    id: "glint",
    name: "Glint",
    fxName: "LF Glint",
    blurb: "A dim wash pricked with hard sparks.",
    nativeName: "Glitter",
    audio: false,
    defaults: { speed: 70, intensity: 140, size: 80, spark: 90, paletteId: 65 },
  },
  {
    id: "pendulum",
    name: "Pendulum",
    fxName: "LF Pendulum",
    blurb: "A soft bar that swings end to end.",
    nativeName: "Scanner",
    audio: false,
    defaults: { speed: 70, intensity: 200, size: 70, spark: 20, paletteId: 44 },
  },
  {
    id: "well",
    name: "Well",
    fxName: "LF Well",
    blurb: "Rings expanding from random strikes.",
    nativeName: "Ripple",
    audio: false,
    defaults: { speed: 60, intensity: 150, size: 80, spark: 20, paletteId: 51 },
  },
  {
    id: "river",
    name: "River",
    fxName: "LF River",
    blurb: "A noisy current scrolling down the rail.",
    nativeName: "Colorwaves",
    audio: false,
    defaults: { speed: 50, intensity: 160, size: 100, spark: 40, paletteId: 46 },
  },
  {
    id: "throb",
    name: "Throb",
    fxName: "LF Throb",
    blurb: "A double pulse, like a resting heart.",
    nativeName: "Heartbeat",
    audio: true,
    defaults: { speed: 48, intensity: 200, size: 40, spark: 0, paletteId: 66 },
  },
  {
    id: "marquee",
    name: "Marquee",
    fxName: "LF Marquee",
    blurb: "Blocks of color chasing a dark gap.",
    nativeName: "Theater",
    audio: false,
    defaults: { speed: 90, intensity: 180, size: 70, spark: 20, paletteId: 48 },
  },
  {
    id: "drizzle",
    name: "Drizzle",
    fxName: "LF Drizzle",
    blurb: "Short drops running along the strip.",
    nativeName: "Rain",
    audio: false,
    defaults: { speed: 80, intensity: 140, size: 80, spark: 120, paletteId: 37 },
  },
  {
    id: "ribbon",
    name: "Ribbon",
    fxName: "LF Ribbon",
    blurb: "Three bands that follow bass, mids, and air.",
    nativeName: "Bpm",
    audio: true,
    defaults: { speed: 70, intensity: 180, size: 90, spark: 80, paletteId: 57 },
  },
];

const byId = new Map(EFFECTS.map((e) => [e.id, e]));

export function effectById(id: string): EffectDef {
  return byId.get(id) ?? EFFECTS[0];
}

const states = new Map<string, { n: number; s: EngineState }>();

export function resetEngine() {
  states.clear();
}

function borrow(key: string, n: number): EngineState {
  const hit = states.get(key);
  if (!hit || hit.n !== n) {
    const s = makeState(n);
    states.set(key, { n, s });
    return s;
  }
  return hit.s;
}

function applyMirror(buf: Uint8ClampedArray, n: number) {
  const half = n >> 1;
  for (let i = 0; i < half; i++) {
    const a = i * 3;
    const b = (n - 1 - i) * 3;
    buf[b] = buf[a];
    buf[b + 1] = buf[a + 1];
    buf[b + 2] = buf[a + 2];
  }
}

function applyReverse(buf: Uint8ClampedArray, n: number) {
  for (let i = 0; i < n >> 1; i++) {
    const a = i * 3;
    const b = (n - 1 - i) * 3;
    for (let k = 0; k < 3; k++) {
      const tmp = buf[a + k];
      buf[a + k] = buf[b + k];
      buf[b + k] = tmp;
    }
  }
}

export function renderForge(id: string, params: ForgeParams, buf: Uint8ClampedArray) {
  const fx = RENDERERS[id] ?? renderVeil;
  const state = borrow(`forge:${id}`, params.n);
  fx(params, state, buf);
  if (params.mirror) applyMirror(buf, params.n);
  if (params.reverse) applyReverse(buf, params.n);
}

export type SketchKind = "solid" | "pulse" | "chase" | "flow" | "spark" | "fire" | "ripple";

export function renderSketch(kind: SketchKind, params: ForgeParams, buf: Uint8ClampedArray) {
  const state = borrow(`sketch:${kind}`, params.n);
  if (kind === "fire") renderEmber(params, state, buf);
  else if (kind === "spark") renderGlint(params, state, buf);
  else if (kind === "chase") renderComet({ ...params, spark: 20 }, state, buf);
  else if (kind === "ripple") renderWell(params, state, buf);
  else if (kind === "pulse") renderThrob(params, state, buf);
  else if (kind === "solid") {
    const { stops, discrete } = stopsFor(params.paletteId, params.colors, params.t);
    const col = sampleStops(stops, 40, discrete);
    for (let i = 0; i < params.n; i++) write(buf, i, mixRgb(params.colors[0], col, 0.35), env(params));
  } else renderRiver(params, state, buf);
  if (params.mirror) applyMirror(buf, params.n);
  if (params.reverse) applyReverse(buf, params.n);
}

/** Collapse a preview buffer into WLED range pairs. Stop index is exclusive. */
export function groupPixels(
  src: Uint8ClampedArray,
  srcN: number,
  dstN: number,
  bri: number,
  maxGroups = 150,
): (number | string)[] {
  const groups = Math.max(1, Math.min(dstN, maxGroups));
  const gain = Math.max(0, Math.min(255, bri)) / 255;
  const out: (number | string)[] = [];
  for (let g = 0; g < groups; g++) {
    const start = Math.floor((g * dstN) / groups);
    const end = Math.max(start + 1, Math.floor(((g + 1) * dstN) / groups));
    const sampleAt = Math.min(srcN - 1, Math.floor((((start + end) / 2) / dstN) * srcN));
    const o = Math.max(0, sampleAt) * 3;
    const hex =
      byte(src[o] * gain) + byte(src[o + 1] * gain) + byte(src[o + 2] * gain);
    out.push(start, Math.min(dstN, end), hex);
  }
  return out;
}

function byte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n || 0)))
    .toString(16)
    .padStart(2, "0");
}

export function frameMean(buf: Uint8ClampedArray): number {
  if (buf.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i];
  return s / buf.length;
}
