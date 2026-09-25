/** Names shipped with WLED around 0.14. A connected lamp replaces this list. */
export const STOCK_EFFECTS = [
  "Solid",
  "Blink",
  "Breathe",
  "Wipe",
  "Wipe Random",
  "Random Colors",
  "Sweep",
  "Dynamic",
  "Colorloop",
  "Rainbow",
  "Scan",
  "Scan Dual",
  "Fade",
  "Theater",
  "Theater Rainbow",
  "Running",
  "Saw",
  "Twinkle",
  "Dissolve",
  "Dissolve Rnd",
  "Sparkle",
  "Sparkle Dark",
  "Sparkle+",
  "Strobe",
  "Strobe Rainbow",
  "Strobe Mega",
  "Blink Rainbow",
  "Android",
  "Chase",
  "Chase Random",
  "Chase Rainbow",
  "Chase Flash",
  "Chase Flash Rnd",
  "Rainbow Runner",
  "Colorful",
  "Traffic Light",
  "Sweep Random",
  "Running Dual",
  "Aurora",
  "Stream",
  "Scanner",
  "Lighthouse",
  "Fireworks",
  "Rain",
  "Tetrix",
  "Fire Flicker",
  "Gradient",
  "Loading",
  "Police",
  "Police All",
  "Two Dots",
  "Two Areas",
  "Circus",
  "Halloween",
  "Tri Chase",
  "Tri Wipe",
  "Tri Fade",
  "Lightning",
  "ICU",
  "Multi Comet",
  "Scanner Dual",
  "Stream 2",
  "Oscillate",
  "Pride 2015",
  "Juggle",
  "Palette",
  "Fire 2012",
  "Colorwaves",
  "Bpm",
  "Fill Noise",
  "Noise 1",
  "Noise 2",
  "Noise 3",
  "Noise 4",
  "Colortwinkles",
  "Lake",
  "Meteor",
  "Meteor Smooth",
  "Railway",
  "Ripple",
  "Twinklefox",
  "Twinklecat",
  "Halloween Eyes",
  "Solid Pattern",
  "Solid Pattern Tri",
  "Spots",
  "Spots Fade",
  "Glitter",
  "Candle",
  "Fireworks Starburst",
  "Fireworks 1D",
  "Bouncing Balls",
  "Sinelon",
  "Sinelon Dual",
  "Sinelon Rainbow",
  "Popcorn",
  "Drip",
  "Plasma",
  "Percent",
  "Ripple Rainbow",
  "Heartbeat",
  "Pacifica",
  "Candle Multi",
  "Solid Glitter",
  "Sunrise",
  "Phased",
  "Twinkleup",
  "Noise Pal",
  "Sine",
  "Phased Noise",
  "Flow",
  "Chunchun",
  "Dancing Shadows",
  "Washing Machine",
  "Candy Cane",
  "Blends",
  "TV Simulator",
];

export type SketchKind = "solid" | "pulse" | "chase" | "flow" | "spark" | "fire" | "ripple";

export function sketchKindForName(name: string): SketchKind {
  const n = name.toLowerCase();
  if (n === "solid" || n.startsWith("solid pattern")) return "solid";
  if (/firework|sparkle|glitter|twinkle|strobe|popcorn|dissolve|spangle/.test(n)) return "spark";
  if (/fire|candle|meteor|lava/.test(n)) return "fire";
  if (/scan|scanner|sinelon|comet|lighthouse|chase|running|theater|wipe|saw|railway|drip|loading|android|traffic|police|icu/.test(n))
    return "chase";
  if (/ripple|rain|ball|juggle|dancing|bouncing/.test(n)) return "ripple";
  if (/breathe|heartbeat|fade|blink|percent|sunrise/.test(n)) return "pulse";
  return "flow";
}

export function fxIndexByName(effects: string[], name: string): number {
  const want = name.trim().toLowerCase();
  const exact = effects.findIndex((e) => e.trim().toLowerCase() === want);
  if (exact >= 0) return exact;
  return effects.findIndex((e) => e.toLowerCase().includes(want));
}

/** fxdata flag field marks volume (v) and frequency (f) reactive effects. */
export function effectIsAudio(fxdata: string | undefined): boolean {
  if (!fxdata) return false;
  const flags = fxdata.split(";")[3] ?? "";
  return flags.includes("v") || flags.includes("f");
}
