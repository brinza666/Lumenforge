import { fxIndexByName, STOCK_EFFECTS } from "./catalog.ts";
import { effectById, EFFECTS, type EffectDef } from "./engine.ts";
import { PALETTES, stopsFor, type RGB } from "./palettes.ts";
import type { ParsedEffectPreset } from "./presets.ts";

export type ForgeLook = {
  uid: string;
  name: string;
  effect: string;
  speed: number;
  intensity: number;
  size: number;
  spark: number;
  paletteId: number;
  colors: [RGB, RGB, RGB];
  reverse: boolean;
  mirror: boolean;
  audio: boolean;
};

export type LampLook = {
  fxName: string;
  speed: number;
  intensity: number;
  paletteId: number;
  colors: [RGB, RGB, RGB];
  reverse: boolean;
  mirror: boolean;
};

export type PlaylistItem = {
  uid: string;
  name: string;
  hold: number;
  fade: number;
  forge?: ForgeLook;
  lamp?: LampLook;
};

export type Mix = {
  name: string;
  seed: number;
  mode: "forge" | "lamp";
  hold: number;
  fade: number;
  items: PlaylistItem[];
};

const ADJ = [
  "slow",
  "glass",
  "night",
  "brass",
  "wet",
  "quiet",
  "iron",
  "amber",
  "salt",
  "pale",
  "deep",
  "thin",
  "warm",
  "late",
  "dim",
  "wild",
  "soft",
  "hard",
  "low",
  "still",
];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)] ?? list[0];
}

function uid(rng: () => number): string {
  return Math.floor(rng() * 1e9).toString(36) + Math.floor(rng() * 1e9).toString(36);
}

export const DEFAULT_COLORS: [RGB, RGB, RGB] = [
  [186, 232, 198],
  [18, 28, 48],
  [232, 196, 140],
];

export function defaultLook(): ForgeLook {
  const fx = effectById("veil");
  return {
    uid: "look",
    name: "First veil",
    effect: fx.id,
    speed: fx.defaults.speed,
    intensity: fx.defaults.intensity,
    size: fx.defaults.size,
    spark: fx.defaults.spark,
    paletteId: fx.defaults.paletteId,
    colors: DEFAULT_COLORS,
    reverse: false,
    mirror: true,
    audio: false,
  };
}

export function lookFromEffect(fx: EffectDef, rng: () => number = Math.random): ForgeLook {
  const paletteId = rng() > 0.45 ? fx.defaults.paletteId : pick(rng, PALETTES.filter((p) => p.id >= 6)).id;
  const { stops } = stopsFor(paletteId, DEFAULT_COLORS, rng() * 20);
  const color = () => stops[Math.floor(rng() * stops.length)] ?? stops[0];
  return {
    uid: uid(rng),
    name: `${pick(rng, ADJ)} ${fx.name.toLowerCase()}`,
    effect: fx.id,
    speed: clampByte(fx.defaults.speed + Math.floor((rng() - 0.5) * 80)),
    intensity: clampByte(fx.defaults.intensity + Math.floor((rng() - 0.5) * 70)),
    size: clampByte(fx.defaults.size + Math.floor((rng() - 0.5) * 90)),
    spark: clampByte(fx.defaults.spark + Math.floor((rng() - 0.5) * 90)),
    paletteId,
    colors: [color(), color(), color()],
    reverse: rng() > 0.82,
    mirror: rng() > 0.55,
    audio: fx.audio ? rng() > 0.25 : rng() > 0.88,
  };
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function randomForgeLook(rng: () => number): ForgeLook {
  return lookFromEffect(pick(rng, EFFECTS), rng);
}

export function randomLampLook(rng: () => number, names: string[]): LampLook {
  const pool = names.length > 0 ? names : STOCK_EFFECTS;
  const fxName = pick(rng, pool.filter((n) => n !== "Solid")) || pool[0];
  const paletteId = pick(rng, PALETTES.filter((p) => p.id >= 6)).id;
  const { stops } = stopsFor(paletteId, DEFAULT_COLORS, 0);
  const color = () => stops[Math.floor(rng() * stops.length)] ?? DEFAULT_COLORS[0];
  return {
    fxName,
    speed: clampByte(40 + rng() * 200),
    intensity: clampByte(30 + rng() * 210),
    paletteId,
    colors: [color(), color(), color()],
    reverse: rng() > 0.8,
    mirror: rng() > 0.75,
  };
}

export function buildMix(opts: {
  mode: "forge" | "lamp";
  count: number;
  seed: number;
  hold: number;
  fade: number;
  varied: boolean;
  names?: string[];
}): Mix {
  const count = Math.max(1, Math.min(100, Math.round(opts.count)));
  const rng = mulberry32(opts.seed || 1);
  const items: PlaylistItem[] = [];
  for (let i = 0; i < count; i++) {
    const hold = opts.varied ? Math.round(opts.hold * (0.65 + rng() * 0.7) * 10) / 10 : opts.hold;
    if (opts.mode === "lamp") {
      const lamp = randomLampLook(rng, opts.names ?? STOCK_EFFECTS);
      items.push({
        uid: uid(rng),
        name: lamp.fxName,
        hold,
        fade: opts.fade,
        lamp,
      });
    } else {
      const look = randomForgeLook(rng);
      items.push({ uid: uid(rng), name: look.name, hold, fade: opts.fade, forge: look });
    }
  }
  return {
    name: opts.mode === "forge" ? "Forge mix" : "Lamp mix",
    seed: opts.seed || 1,
    mode: opts.mode,
    hold: opts.hold,
    fade: opts.fade,
    items,
  };
}

export type SlotPlan = { id: number; occupiedName?: string };

export function planSlots(used: Map<number, string>, start: number, count: number): SlotPlan[] {
  const slots: SlotPlan[] = [];
  let id = Math.max(1, Math.min(250, Math.round(start)));
  while (slots.length < count && id <= 250) {
    slots.push({ id, occupiedName: used.get(id) });
    id++;
  }
  return slots;
}

export function usedPresetNames(keys: Iterable<string>, names: Map<number, string>): Map<number, string> {
  const used = new Map<number, string>();
  for (const key of keys) {
    const id = Number(key);
    if (!Number.isFinite(id) || id <= 0) continue;
    used.set(id, names.get(id) || `Preset ${id}`);
  }
  return used;
}

function tenths(seconds: number): number {
  return Math.max(1, Math.min(65000, Math.round(seconds * 10)));
}

export type ResolvedItem = {
  slot: number;
  name: string;
  hold: number;
  fade: number;
  body: Record<string, unknown>;
  missing?: string;
};

export function resolveForgeCousin(
  look: ForgeLook,
  effects: string[],
): { fx: number; missing?: string } {
  const native = effectById(look.effect).nativeName;
  if (effects.length === 0) {
    const fx = STOCK_EFFECTS.findIndex((n) => n.toLowerCase() === native.toLowerCase());
    return { fx: fx >= 0 ? fx : 0 };
  }
  const fx = fxIndexByName(effects, native);
  if (fx < 0) return { fx: 0, missing: native };
  return { fx };
}

export function resolveLfEffect(effectId: string, effects: string[]): { fx: number; missing?: string } {
  const name = effectById(effectId).fxName;
  const fx = fxIndexByName(effects, name);
  if (fx < 0) return { fx: 0, missing: name };
  return { fx };
}

function segBody(opts: {
  fx: number;
  sx: number;
  ix: number;
  pal: number;
  colors: [RGB, RGB, RGB];
  rev: boolean;
  mi: boolean;
  c1?: number;
  c2?: number;
  ledCount?: number;
  includeBounds: boolean;
}): Record<string, unknown> {
  const seg: Record<string, unknown> = {
    id: 0,
    fx: opts.fx,
    sx: opts.sx,
    ix: opts.ix,
    pal: opts.pal,
    col: opts.colors,
    rev: opts.rev,
    mi: opts.mi,
    sel: true,
    on: true,
  };
  if (opts.c1 !== undefined) seg.c1 = opts.c1;
  if (opts.c2 !== undefined) seg.c2 = opts.c2;
  if (opts.includeBounds) {
    seg.start = 0;
    seg.stop = Math.max(1, opts.ledCount ?? 60);
    seg.grp = 1;
    seg.spc = 0;
    seg.of = 0;
  }
  return seg;
}

export function stateForLook(
  item: PlaylistItem,
  effects: string[],
  target: "cousin" | "lumenforge",
  ledCount: number,
  includeBounds: boolean,
): { body: Record<string, unknown>; missing?: string } | null {
  if (item.lamp) {
    const fx = effects.length ? fxIndexByName(effects, item.lamp.fxName) : STOCK_EFFECTS.findIndex((n) => n === item.lamp?.fxName);
    if (fx < 0) return { body: {}, missing: item.lamp.fxName };
    return {
      body: {
        on: true,
        transition: tenths(item.fade),
        seg: [
          segBody({
            fx,
            sx: item.lamp.speed,
            ix: item.lamp.intensity,
            pal: item.lamp.paletteId,
            colors: item.lamp.colors,
            rev: item.lamp.reverse,
            mi: item.lamp.mirror,
            ledCount,
            includeBounds,
          }),
        ],
      },
    };
  }
  if (!item.forge) return null;
  const resolved =
    target === "lumenforge" ? resolveLfEffect(item.forge.effect, effects) : resolveForgeCousin(item.forge, effects);
  if (resolved.missing && target === "lumenforge") return { body: {}, missing: resolved.missing };
  return {
    body: {
      on: true,
      transition: tenths(item.fade),
      seg: [
        segBody({
          fx: resolved.fx,
          sx: item.forge.speed,
          ix: item.forge.intensity,
          pal: item.forge.paletteId,
          colors: item.forge.colors,
          rev: item.forge.reverse,
          mi: item.forge.mirror,
          c1: target === "lumenforge" ? item.forge.size : undefined,
          c2: target === "lumenforge" ? item.forge.spark : undefined,
          ledCount,
          includeBounds,
        }),
      ],
    },
    missing: resolved.missing,
  };
}

export function presetsFile(items: ResolvedItem[], playlistSlot: number, name: string, bri: number, shuffle: boolean): string {
  const root: Record<string, unknown> = {};
  for (const item of items) {
    root[String(item.slot)] = {
      n: item.name,
      on: true,
      bri,
      transition: tenths(item.fade),
      mainseg: 0,
      ...(item.body as object),
    };
  }
  root[String(playlistSlot)] = {
    n: name,
    on: true,
    playlist: {
      ps: items.map((i) => i.slot),
      dur: items.map((i) => tenths(i.hold)),
      transition: items.map((i) => tenths(i.fade)),
      repeat: 0,
      end: 0,
      r: shuffle,
    },
  };
  return JSON.stringify(root, null, 2);
}

export function playlistPayload(slots: number[], holds: number[], fades: number[], shuffle: boolean) {
  return {
    playlist: {
      ps: slots,
      dur: holds.map(tenths),
      transition: fades.map(tenths),
      repeat: 0,
      end: 0,
      r: shuffle,
    },
    on: true,
  };
}

export function effectPresetPayload(p: ParsedEffectPreset, includeBri: boolean) {
  return {
    on: true,
    ...(includeBri ? { bri: p.bri, transition: p.transition } : {}),
    seg: [
      {
        id: 0,
        fx: p.fx,
        sx: p.sx,
        ix: p.ix,
        pal: p.pal,
        col: p.colors,
        rev: p.rev,
        mi: p.mi,
        sel: true,
      },
    ],
  };
}
