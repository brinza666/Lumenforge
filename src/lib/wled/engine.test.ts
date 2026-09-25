import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildAllUsermod, buildArti } from "./codegen.ts";
import { EFFECTS, frameMean, groupPixels, renderForge, resetEngine, type ForgeParams } from "./engine.ts";
import { buildMix, planSlots } from "./playlist.ts";
import { parsePresets } from "./presets.ts";

const colors: ForgeParams["colors"] = [
  [186, 232, 198],
  [18, 28, 48],
  [232, 196, 140],
];

function run(id: string, seconds = 3) {
  resetEngine();
  const fx = EFFECTS.find((e) => e.id === id)!;
  const params: ForgeParams = {
    n: 48,
    t: 0,
    dt: 1 / 30,
    speed: fx.defaults.speed,
    intensity: fx.defaults.intensity,
    size: fx.defaults.size,
    spark: fx.defaults.spark,
    colors,
    paletteId: fx.defaults.paletteId,
    mirror: false,
    reverse: false,
    audio: { active: false, energy: 0, bass: 0, mid: 0, high: 0, peak: false, synthetic: true },
  };
  const buf = new Uint8ClampedArray(params.n * 3);
  let early = 0;
  let late = 0;
  for (let frame = 0; frame < seconds * 30; frame++) {
    params.t += params.dt;
    renderForge(id, params, buf);
    if (frame === 8) early = frameMean(buf);
    late = frameMean(buf);
    for (let i = 0; i < buf.length; i++) {
      assert.ok(buf[i] >= 0 && buf[i] <= 255, `${id} pixel ${i} out of range`);
      assert.ok(Number.isFinite(buf[i]), `${id} NaN`);
    }
  }
  assert.ok(late > 1, `${id} stayed dark (${late})`);
  assert.ok(Math.abs(late - early) > 0.4 || late > 8, `${id} did not move (${early} -> ${late})`);
}

test("every forge effect paints and moves", () => {
  for (const fx of EFFECTS) run(fx.id);
});

test("reverse flips a stateless marquee", () => {
  resetEngine();
  const base: ForgeParams = {
    n: 24,
    t: 1.25,
    dt: 0.016,
    speed: 0,
    intensity: 200,
    size: 80,
    spark: 0,
    colors,
    paletteId: 11,
    mirror: false,
    reverse: false,
    audio: { active: false, energy: 0, bass: 0, mid: 0, high: 0, peak: false, synthetic: true },
  };
  const a = new Uint8ClampedArray(base.n * 3);
  const b = new Uint8ClampedArray(base.n * 3);
  renderForge("marquee", base, a);
  renderForge("marquee", { ...base, reverse: true }, b);
  assert.equal(b[0], a[(base.n - 1) * 3]);
  assert.equal(b[1], a[(base.n - 1) * 3 + 1]);
});

test("playlist of 100 stays inside the cap and keeps unique ids", () => {
  const mix = buildMix({ mode: "forge", count: 100, seed: 7, hold: 8, fade: 0.8, varied: true });
  assert.equal(mix.items.length, 100);
  assert.equal(new Set(mix.items.map((i) => i.uid)).size, 100);
  assert.ok(mix.items.every((i) => i.forge && i.hold > 0));
});

test("slot planner flags occupied ids and stops at 250", () => {
  const used = new Map<number, string>([
    [248, "Keep"],
    [249, "Also"],
  ]);
  const slots = planSlots(used, 247, 10);
  assert.equal(slots.length, 4);
  assert.equal(slots[1]?.occupiedName, "Keep");
  assert.equal(slots[3]?.id, 250);
});

test("pixel groups stay under the packet cap", () => {
  const src = new Uint8ClampedArray(72 * 3);
  src[0] = 255;
  const ranges = groupPixels(src, 72, 600, 128);
  const colors = ranges.filter((v) => typeof v === "string");
  assert.ok(colors.length <= 150);
  assert.equal(ranges[0], 0);
  assert.ok(typeof ranges[2] === "string" && (ranges[2] as string).length === 6);
});

test("usermod source registers every effect", () => {
  const cpp = buildAllUsermod();
  assert.equal((cpp.match(/strip\.addEffect\(255/g) || []).length, EFFECTS.length);
  for (const fx of EFFECTS) assert.ok(cpp.includes(fx.fxName), fx.fxName);
  assert.ok(cpp.includes("REGISTER_USERMOD"));
  const arti = buildArti("tide");
  assert.equal(arti.fidelity, "close");
  assert.ok(arti.code.includes("setPixelColor"));
});

test("sample presets include the Vse playlist", () => {
  const raw = JSON.parse(readFileSync(new URL("../../data/sample-presets.json", import.meta.url), "utf8"));
  const lib = parsePresets(raw);
  assert.ok(lib.effects.length > 50);
  const vse = lib.playlists.filter((p) => p.name === "Vse");
  assert.ok(vse.length >= 1);
  assert.ok(vse[0].playlist.ps.length >= 50);
  assert.ok(vse.some((p) => p.playlist.ps.some((id) => id > 250)));
});
