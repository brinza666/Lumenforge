import { effectById } from "./engine.ts";
import type { Mix, PlaylistItem } from "./playlist.ts";
import { DEFAULT_COLORS, type ForgeLook } from "./playlist.ts";

function look(id: string, name: string, effect: string, paletteId: number, speed: number, mirror = false): ForgeLook {
  const fx = effectById(effect);
  return {
    uid: id,
    name,
    effect,
    speed,
    intensity: fx.defaults.intensity,
    size: fx.defaults.size,
    spark: Math.min(40, fx.defaults.spark),
    paletteId,
    colors: DEFAULT_COLORS,
    reverse: false,
    mirror,
    audio: false,
  };
}

function item(forge: ForgeLook, hold = 14): PlaylistItem {
  return { uid: forge.uid, name: forge.name, hold, fade: 1.6, forge };
}

function mix(name: string, items: PlaylistItem[]): Mix {
  return { name, seed: 1, mode: "forge", hold: 14, fade: 1.6, items };
}

/** Hand-built mixes. Speeds stay low. Palettes are the saturated ones. */
export const PROPOSALS: Mix[] = [
  mix("Daylight ribbon", [
    item(look("p-drift", "Clear drift", "drift", 11, 32)),
    item(look("p-current", "Aqua current", "current", 9, 40)),
    item(look("p-sail", "Mango sail", "sail", 47, 36)),
    item(look("p-linen", "Coral linen", "linen", 44, 24)),
    item(look("p-tide", "Citrus tide", "tide", 57, 40, true)),
    item(look("p-lantern", "Amber lantern", "lantern", 17, 22)),
  ]),
  mix("Garden walk", [
    item(look("g-garden", "Ripe garden", "garden", 19, 22)),
    item(look("g-bloom", "Petal bloom", "bloom", 27, 34)),
    item(look("g-veil", "Fresh veil", "veil", 50, 28, true)),
    item(look("g-river", "Lime river", "river", 10, 36)),
    item(look("g-well", "Splash well", "well", 19, 30)),
  ]),
  mix("Matrix room", [
    item(look("m-bloom", "Room bloom", "bloom", 57, 36)),
    item(look("m-orbit", "Twin orbit", "orbit", 6, 42)),
    item(look("m-spiral", "Slow spiral", "spiral", 11, 30)),
    item(look("m-halo", "Aqua halo", "halo", 63, 28)),
    item(look("m-drift", "Candy drift", "drift", 61, 26)),
    item(look("m-garden", "Sherbet garden", "garden", 27, 20)),
  ]),
  mix("Warm evening", [
    item(look("e-lantern", "Filament lantern", "lantern", 47, 20)),
    item(look("e-ember", "Bright ember", "emberline", 35, 48)),
    item(look("e-comet", "Gold comet", "comet", 17, 44)),
    item(look("e-sail", "Apricot sail", "sail", 21, 32)),
    item(look("e-linen", "Sunset linen", "linen", 13, 22, true)),
  ]),
  mix("Easy party", [
    item(look("y-marquee", "Candy marquee", "marquee", 57, 52)),
    item(look("y-orbit", "Party orbit", "orbit", 6, 46)),
    item(look("y-current", "Rainbow current", "current", 11, 40)),
    item(look("y-glint", "Soft glint", "glint", 65, 36)),
    item(look("y-ribbon", "Ribbon bands", "ribbon", 48, 42)),
  ]),
];
