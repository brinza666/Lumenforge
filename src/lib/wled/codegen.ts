import { EFFECTS, effectById } from "./engine.ts";

const BODIES: Record<string, string> = {
  veil: `
  float spd = 0.00025f * (1 + SEGMENT.speed);
  uint8_t bands = 2 + (SEGMENT.intensity / 80);
  for (unsigned i = 0; i < SEGLEN; i++) {
    float u = SEGLEN <= 1 ? 0 : (float)i / (float)(SEGLEN - 1);
    float v = 0;
    float shift = 0;
    for (uint8_t b = 0; b < bands; b++) {
      float width = 0.07f + (SEGMENT.custom1 / 255.0f) * 0.16f + b * 0.015f;
      float center = 0.5f + 0.42f * sinf(strip.now * spd * (0.7f + b * 0.21f) + b * 1.7f);
      float d = u - center;
      float g = expf(-(d * d) / (2 * width * width));
      v += g * (0.55f + 0.45f * sinf(strip.now * 0.0016f + b));
      shift += g * b * 36.0f;
    }
    if (v > 1) v = 1;
    uint8_t idx = (uint8_t)(u * 150 + shift + strip.now * 0.02f);
    lf_set(i, lf_pal(idx), v);
  }`,
  tide: `
  float spd = 0.0004f * (8 + SEGMENT.speed);
  for (unsigned i = 0; i < SEGLEN; i++) {
    float u = SEGLEN <= 1 ? 0 : (float)i / (float)(SEGLEN - 1);
    float width = 0.15f + (SEGMENT.custom1 / 255.0f) * 1.4f;
    float a = sinf(u * 3.14159f * (2 + width) + strip.now * spd);
    float b = sinf(u * 3.14159f * (1.2f + width * 0.4f) - strip.now * spd * 0.72f + 1.3f);
    float crest = a * 0.5f + 0.5f;
    crest = crest * 0.62f + (b * 0.5f + 0.5f) * 0.38f;
    float depth = 0.25f + (SEGMENT.intensity / 255.0f) * 0.75f;
    uint8_t idx = (uint8_t)(u * 180 + strip.now * 0.03f);
    lf_set(i, lf_pal(idx), 0.1f + crest * depth);
  }`,
  emberline: `
  if (!SEGENV.allocateData(SEGLEN)) return;
  uint8_t* heat = SEGENV.data;
  uint8_t cooling = 2 + ((255 - SEGMENT.intensity) / 28);
  for (unsigned i = 0; i < SEGLEN; i++) {
    uint8_t cool = (uint8_t)(hw_random8(cooling + 1));
    heat[i] = heat[i] > cool ? heat[i] - cool : 0;
  }
  for (int i = (int)SEGLEN - 1; i >= 2; i--) {
    heat[i] = (uint8_t)(((int)heat[i - 1] + heat[i - 2] + heat[i - 2]) / 3);
  }
  if (hw_random8() < 40 + (SEGMENT.custom2 / 2)) {
    unsigned y = hw_random8(SEGLEN < 6 ? SEGLEN : 6);
    heat[y] = 170 + hw_random8(80);
  }
  for (unsigned i = 0; i < SEGLEN; i++) {
    float v = heat[i] / 255.0f;
    lf_set(i, lf_pal((uint8_t)(12 + heat[i])), v);
  }`,
  comet: `
  unsigned tail = 3 + ((unsigned)SEGMENT.custom1 * SEGLEN) / 500;
  if (tail >= SEGLEN) tail = SEGLEN - 1;
  uint32_t step = (strip.now * (1 + SEGMENT.speed / 8)) / 12;
  unsigned head = SEGLEN ? (step % SEGLEN) : 0;
  bool second = SEGMENT.custom2 > 140;
  for (unsigned i = 0; i < SEGLEN; i++) {
    unsigned d = (head + SEGLEN - i) % SEGLEN;
    if (second) {
      unsigned head2 = (head + SEGLEN / 2) % SEGLEN;
      unsigned d2 = (head2 + SEGLEN - i) % SEGLEN;
      if (d2 < d) d = d2;
    }
    float body = d < tail ? powf(1.0f - (float)d / (float)tail, 1.4f) : 0;
    lf_set(i, lf_pal((uint8_t)(i * 2 + strip.now / 40)), 0.03f + body * (0.4f + SEGMENT.intensity / 400.0f));
  }`,
  glint: `
  uint32_t tick = strip.now / (20 + (255 - SEGMENT.speed) / 2);
  for (unsigned i = 0; i < SEGLEN; i++) {
    uint8_t tw = (uint8_t)((lf_hash(i * 13 + tick * 17) >> 8) & 0xFF);
    float wash = 0.08f;
    float on = tw > (255 - SEGMENT.custom2 / 2) ? (tw / 255.0f) : 0;
    lf_set(i, lf_pal((uint8_t)(i * 3)), wash + on * (0.4f + SEGMENT.intensity / 400.0f));
  }`,
  pendulum: `
  float spd = 0.001f * (4 + SEGMENT.speed / 6);
  float phase = (sinf(strip.now * spd) * 0.5f + 0.5f) * (SEGLEN > 1 ? SEGLEN - 1 : 1);
  float width = 1.2f + (SEGMENT.custom1 / 255.0f) * SEGLEN * 0.12f;
  for (unsigned i = 0; i < SEGLEN; i++) {
    float d = (float)i - phase;
    float beam = expf(-(d * d) / (2 * width * width));
    lf_set(i, lf_pal((uint8_t)(i * 2)), 0.04f + beam * (0.5f + SEGMENT.intensity / 400.0f));
  }`,
  well: `
  if (!SEGENV.allocateData(18)) return;
  uint8_t* raw = SEGENV.data;
  uint32_t gap = 80 + (uint32_t)(255 - SEGMENT.speed) * 4;
  if (strip.now - SEGENV.step > gap) {
    SEGENV.step = strip.now;
    uint8_t k = hw_random8(6);
    raw[k * 3] = 1;
    uint16_t p = hw_random16(SEGLEN ? SEGLEN : 1);
    raw[k * 3 + 1] = p & 255;
    raw[k * 3 + 2] = (uint8_t)(p >> 8);
  }
  for (uint8_t k = 0; k < 6; k++) if (raw[k * 3] && raw[k * 3] < 255) raw[k * 3]++;
  for (unsigned i = 0; i < SEGLEN; i++) {
    float v = 0.04f;
    for (uint8_t k = 0; k < 6; k++) {
      uint8_t ageB = raw[k * 3];
      if (ageB < 2 || ageB > 90) continue;
      uint16_t pos = (uint16_t)raw[k * 3 + 1] | ((uint16_t)raw[k * 3 + 2] << 8);
      float age = ageB / 12.0f;
      float radius = age * SEGLEN * 0.08f;
      float d = fabsf((float)i - (float)pos);
      float ring = 1.5f + SEGMENT.custom1 / 40.0f;
      float band = expf(-((d - radius) * (d - radius)) / (2 * ring * ring));
      v += band * (1.0f - ageB / 100.0f);
    }
    lf_set(i, lf_pal((uint8_t)(i * 3)), v);
  }`,
  river: `
  float spd = 0.0008f * (4 + SEGMENT.speed);
  float scale = 0.05f + (SEGMENT.custom1 / 255.0f) * 0.25f;
  for (unsigned i = 0; i < SEGLEN; i++) {
    float n = sinf(i * scale + strip.now * spd) * 0.5f + 0.5f;
    float n2 = sinf(i * scale * 2.1f - strip.now * spd * 0.6f) * 0.5f + 0.5f;
    float v = n * 0.65f + n2 * 0.35f;
    lf_set(i, lf_pal((uint8_t)(i + v * 80 + strip.now / 50)), 0.08f + v * (0.35f + SEGMENT.intensity / 300.0f));
  }`,
  throb: `
  float spd = 0.0007f * (6 + SEGMENT.speed / 4);
  float phase = fmodf(strip.now * spd, 1.0f);
  auto bump = [](float x, float c) {
    float d = fabsf(x - c);
    return expf(-(d * 18.0f) * (d * 18.0f));
  };
  float beat = bump(phase, 0.12f) + 0.62f * bump(phase, 0.28f);
  for (unsigned i = 0; i < SEGLEN; i++) {
    float u = SEGLEN <= 1 ? 0 : (float)i / (float)(SEGLEN - 1);
    float edge = 0.75f + 0.25f * sinf(u * 6.28f + strip.now * 0.002f);
    lf_set(i, lf_pal((uint8_t)(u * 160)), beat * edge * (0.4f + SEGMENT.intensity / 400.0f));
  }`,
  marquee: `
  uint8_t block = 1 + SEGMENT.custom1 / 32;
  uint8_t gap = 1 + (255 - SEGMENT.intensity) / 42;
  uint32_t shift = (strip.now * (1 + SEGMENT.speed)) / 180;
  uint8_t period = block + gap;
  for (unsigned i = 0; i < SEGLEN; i++) {
    bool on = ((i + shift) % period) < block;
    lf_set(i, lf_pal((uint8_t)((i + shift) * 4)), on ? 0.9f : 0.03f);
  }`,
  drizzle: `
  const uint8_t N = 10;
  if (!SEGENV.allocateData(N * 4)) return;
  uint8_t* raw = SEGENV.data;
  for (unsigned i = 0; i < SEGLEN; i++) lf_set(i, lf_pal(18), 0.04f);
  for (uint8_t k = 0; k < N; k++) {
    uint8_t* life = &raw[k * 4];
    uint8_t* vel = &raw[k * 4 + 1];
    uint16_t pos = (uint16_t)raw[k * 4 + 2] | ((uint16_t)raw[k * 4 + 3] << 8);
    if (*life == 0) {
      if (hw_random8() < 10 + SEGMENT.custom2 / 8) {
        pos = hw_random16(SEGLEN ? SEGLEN : 1);
        *vel = 1 + SEGMENT.speed / 40;
        *life = 180;
        raw[k * 4 + 2] = pos & 255;
        raw[k * 4 + 3] = (uint8_t)(pos >> 8);
      }
      continue;
    }
    pos = (uint16_t)(pos + *vel);
    if (*life > 4) *life = (uint8_t)(*life - 4); else *life = 0;
    if (pos >= SEGLEN) { *life = 0; continue; }
    raw[k * 4 + 2] = pos & 255;
    raw[k * 4 + 3] = (uint8_t)(pos >> 8);
    lf_set(pos, lf_pal((uint8_t)(40 + k * 12)), (*life) / 180.0f);
  }`,
  ribbon: `
  float bass = 0.25f + 0.75f * powf(fmaxf(0.0f, sinf(strip.now * 0.008f)), 10.0f);
  uint32_t head = (strip.now * (1 + SEGMENT.speed / 6) / 8) % (SEGLEN ? SEGLEN : 1);
  for (unsigned i = 0; i < SEGLEN; i++) {
    float u = SEGLEN <= 1 ? 0 : (float)i / (float)(SEGLEN - 1);
    float band = u < 0.34f ? bass : (u < 0.67f ? 0.35f + 0.2f * sinf(strip.now * 0.003f) : 0.2f);
    float d = (float)i - (float)head;
    float hot = expf(-(d * d) / 18.0f);
    lf_set(i, lf_pal((uint8_t)(u * 200 + strip.now / 30)), 0.08f + band * (0.45f + SEGMENT.intensity / 300.0f) + hot);
  }`,
};

function ident(id: string): string {
  return id.replace(/[^a-z0-9]/gi, "");
}

function effectChunk(id: string): string {
  const fx = effectById(id);
  const body = BODIES[id];
  if (!body) return "";
  const sym = ident(id).toUpperCase();
  return `
static const char _data_FX_MODE_LF_${sym}[] PROGMEM =
  "${fx.fxName}@Speed,Intensity,Size,Spark;!,!,!;!;1;pal=${fx.defaults.paletteId},sx=${fx.defaults.speed},ix=${fx.defaults.intensity},c1=${fx.defaults.size},c2=${fx.defaults.spark}";

static void mode_lf_${ident(id)}(void) {${body}
}
`;
}

export function buildUsermod(ids: string[]): string {
  const chosen = ids.filter((id) => BODIES[id]);
  const chunks = chosen.map(effectChunk).join("\n");
  const adds = chosen
    .map((id) => `    strip.addEffect(255, &mode_lf_${ident(id)}, _data_FX_MODE_LF_${ident(id).toUpperCase()});`)
    .join("\n");
  return `/*
 * Lumenforge effects for WLED 0.15+ (void mode functions, strip.addEffect).
 *
 * Place this file at:
 *   usermods/lumenforge/usermod.cpp
 *
 * In platformio_override.ini (project root of the WLED source tree):
 *
 *   [env]
 *   custom_usermods = lumenforge
 *
 * If you already build audioreactive, keep both:
 *
 *   custom_usermods = audioreactive lumenforge
 *
 * Build with PlatformIO, then flash. These effects show up at the end of the
 * effect list as "LF Veil", "LF Tide", and so on. Come back to Lumenforge,
 * connect the lamp, and write a playlist — it finds them by those names.
 *
 * Stock WLED cannot load this file over Wi-Fi. Web flash (desktop Chrome,
 * Edge, or Firefox with WebSerial) is documented at
 * https://wled-install.github.io/ and uses ESP Web Tools: a manifest.json
 * lists chip families and .bin parts, and the browser writes them over USB.
 * MoonModules builds: https://mm.kno.wled.ge/
 *
 * If your fork still uses uint16_t mode functions, change \`static void\` to
 * \`static uint16_t\` and add \`return FRAMETIME;\` at the end of each mode.
 */

#include "wled.h"
#include <math.h>

static uint32_t lf_hash(uint32_t x) {
  x ^= x >> 16;
  x *= 0x7feb352d;
  x ^= x >> 15;
  return x;
}

static uint32_t lf_pal(uint8_t idx) {
  return SEGMENT.color_from_palette(idx, false, true, 0);
}

static void lf_set(unsigned i, uint32_t col, float gain) {
  if (gain < 0) gain = 0;
  if (gain > 1) gain = 1;
  uint8_t r = (uint8_t)(((col >> 16) & 255) * gain);
  uint8_t g = (uint8_t)(((col >> 8) & 255) * gain);
  uint8_t b = (uint8_t)((col & 255) * gain);
  SEGMENT.setPixelColor(i, ((uint32_t)r << 16) | ((uint32_t)g << 8) | b);
}

${chunks}

class LumenforgeUsermod : public Usermod {
 public:
  void setup() override {
${adds}
  }
  void loop() override {}
  uint16_t getId() override { return 0xF011; }
};

static LumenforgeUsermod lumenforge_usermod;
REGISTER_USERMOD(lumenforge_usermod);
`;
}

export function buildAllUsermod(): string {
  return buildUsermod(EFFECTS.map((e) => e.id));
}

const ARTI: Record<string, { fidelity: "close" | "approx"; code: string }> = {
  tide: {
    fidelity: "close",
    code: `renderFrame() {
  t = counter();
  spd = speedSlider();
  for (i = 0; i < ledCount; i++) {
    a = sin(i * 6 + t * spd / 12);
    b = sin(i * 3 + (0 - t) * spd / 18);
    idx = i * 2 + t / 4;
    bri = 40 + intensitySlider() / 3;
    setPixelColor(i, colorFromPalette(idx, bri));
  }
}`,
  },
  comet: {
    fidelity: "close",
    code: `renderFrame() {
  t = counter();
  head = (t * speedSlider() / 20) % ledCount;
  tail = 4 + custom1Slider() / 8;
  for (i = 0; i < ledCount; i++) {
    d = head - i;
    if (d < 0) { d = d + ledCount; }
    if (d < tail) {
      bri = intensitySlider() - d * 8;
      setPixelColor(i, colorFromPalette(i, bri));
    } else {
      setPixelColor(i, 0);
    }
  }
}`,
  },
  glint: {
    fidelity: "approx",
    code: `renderFrame() {
  t = counter() / 8;
  for (i = 0; i < ledCount; i++) {
    n = random(255);
    if (n > 250 - custom2Slider() / 8) {
      setPixelColor(i, colorFromPalette(i, intensitySlider()));
    } else {
      setPixelColor(i, colorFromPalette(i, 12));
    }
  }
}`,
  },
  pendulum: {
    fidelity: "close",
    code: `renderFrame() {
  t = counter();
  swing = sin(t * speedSlider() / 30);
  head = ledCount / 2 + swing * ledCount / 2;
  for (i = 0; i < ledCount; i++) {
    d = i - head;
    if (d < 0) { d = 0 - d; }
    if (d < 3 + custom1Slider() / 40) {
      setPixelColor(i, colorFromPalette(i, intensitySlider()));
    } else {
      setPixelColor(i, 0);
    }
  }
}`,
  },
  marquee: {
    fidelity: "close",
    code: `renderFrame() {
  t = counter();
  block = 2 + custom1Slider() / 40;
  shift = t * speedSlider() / 80;
  for (i = 0; i < ledCount; i++) {
    x = (i + shift) % (block + 2);
    if (x < block) {
      setPixelColor(i, colorFromPalette(i, intensitySlider()));
    } else {
      setPixelColor(i, 0);
    }
  }
}`,
  },
  throb: {
    fidelity: "close",
    code: `renderFrame() {
  t = counter();
  beat = sin(t * speedSlider() / 25);
  bri = 20 + beat * intensitySlider() / 2;
  if (bri < 0) { bri = 0 - bri; }
  for (i = 0; i < ledCount; i++) {
    setPixelColor(i, colorFromPalette(i, bri));
  }
}`,
  },
  veil: {
    fidelity: "approx",
    code: `renderFrame() {
  t = counter();
  for (i = 0; i < ledCount; i++) {
    a = sin(i * 4 + t * speedSlider() / 40);
    bri = 30 + a * intensitySlider() / 3;
    if (bri < 0) { bri = 0; }
    setPixelColor(i, colorFromPalette(i + t / 6, bri));
  }
}`,
  },
  ribbon: {
    fidelity: "approx",
    code: `renderFrame() {
  t = counter();
  for (i = 0; i < ledCount; i++) {
    a = sin(i * 8 + t * speedSlider() / 20);
    bri = 20 + intensitySlider() / 4 + a * 40;
    if (bri < 0) { bri = 0; }
    setPixelColor(i, colorFromPalette(i + t / 5, bri));
  }
}`,
  },
};

export function buildArti(id: string): { filename: string; fidelity: "close" | "approx" | "none"; code: string } {
  const fx = effectById(id);
  const hit = ARTI[id];
  if (!hit) {
    return {
      filename: `LF ${fx.name}.wled`,
      fidelity: "none",
      code: `renderFrame() {
  for (i = 0; i < ledCount; i++) {
    setPixelColor(i, colorFromPalette(i, intensitySlider()));
  }
}
`,
    };
  }
  return {
    filename: `LF ${fx.name}.wled`,
    fidelity: hit.fidelity,
    code: `// ${fx.fxName} — ${hit.fidelity === "close" ? "close" : "rough"} ARTI-FX port.
// On MoonModules, name the segment exactly: LF ${fx.name}
// Then select the ARTI-FX effect. Stock WLED ignores this file.
${hit.code}
`,
  };
}

export const OVERRIDE_INI = `# Save as platformio_override.ini next to WLED's platformio.ini.
# Merge with any custom_usermods you already use (audioreactive, for example).

[env]
custom_usermods = lumenforge
`;
