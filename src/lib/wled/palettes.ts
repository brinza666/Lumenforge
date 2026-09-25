export type RGB = [number, number, number];

export type Palette = {
  id: number;
  name: string;
  stops: RGB[];
  discrete?: boolean;
};

const NAMES = [
  "Default",
  "Random Cycle",
  "Color 1",
  "Colors 1&2",
  "Color Gradient",
  "Colors Only",
  "Party",
  "Cloud",
  "Lava",
  "Ocean",
  "Forest",
  "Rainbow",
  "Rainbow Bands",
  "Sunset",
  "Rivendell",
  "Breeze",
  "Red & Blue",
  "Yellowout",
  "Analogous",
  "Splash",
  "Pastel",
  "Sunset 2",
  "Beech",
  "Vintage",
  "Departure",
  "Landscape",
  "Beach",
  "Sherbet",
  "Hult",
  "Hult 64",
  "Drywet",
  "Jul",
  "Grintage",
  "Rewhi",
  "Tertiary",
  "Fire",
  "Icefire",
  "Cyane",
  "Light Pink",
  "Autumn",
  "Magenta",
  "Magred",
  "Yelmag",
  "Yelblu",
  "Orange & Teal",
  "Tiamat",
  "April Night",
  "Orangery",
  "C9",
  "Sakura",
  "Aurora",
  "Atlantica",
  "C9 2",
  "C9 New",
  "Temperature",
  "Aurora 2",
  "Retro Clown",
  "Candy",
  "Toxy Reaf",
  "Fairy Reaf",
  "Semi Blue",
  "Pink Candy",
  "Red Reaf",
  "Aqua Flash",
  "Yelblu Hot",
  "Lite Light",
  "Red Flash",
  "Blink Red",
  "Red Shift",
  "Red Tide",
  "Candy2",
];

function hex(h: string): RGB {
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function stops(...hexes: string[]): RGB[] {
  return hexes.map(hex);
}

const HAND: Record<number, RGB[]> = {
  6: stops("5500AB", "84007C", "E5001B", "AB7700", "ABAB00", "2F00D0"),
  7: stops("000814", "1B3A6B", "A9C6E8", "F4F7FB", "7AA0C4"),
  8: stops("050000", "400000", "C41200", "FF6A00", "FFD27A"),
  9: stops("000814", "00334D", "007A8A", "3EC6C6", "D6FFF8"),
  10: stops("04140A", "0E3B22", "1F8A45", "A6D36A", "E7F5C8"),
  11: stops("FF2A2A", "FF9A1F", "FFE14A", "3DDC6A", "3AA0FF", "7A4DFF"),
  12: stops("FF3355", "FF3355", "221018", "3DDC8A", "3DDC8A", "101820"),
  13: stops("2A0A3A", "A31848", "F05A28", "FFC46B", "FFE7C2"),
  14: stops("0E1A14", "3E6B4F", "C6B48A", "F2E6C9"),
  15: stops("102028", "3E7C8A", "F2E2B6", "8FCBD6"),
  16: stops("3A0A16", "E10600", "140818", "1D4ED8", "C9D6FF"),
  17: stops("2A2208", "C6A15A", "FFE7A3", "FFF6DE"),
  18: stops("6B2D5B", "C44B7A", "F2A3C7", "F7D6E6"),
  19: stops("041018", "0E7490", "F8FAFC", "38BDF8"),
  20: stops("F6D6E0", "D7E3F8", "E7F6D8", "F8E7C9", "E4D4F5"),
  21: stops("1A0A18", "7A1E3A", "E07A3D", "F2C14E"),
  22: stops("24180E", "6B4A2A", "C4A574", "E7D7B8"),
  23: stops("2A221C", "7A5A48", "C4956A", "E6D2B8"),
  24: stops("0E1A28", "C4513A", "F0C36A", "8AA8C4"),
  25: stops("14200E", "4E6B2E", "C2B15A", "8FB8D6", "E7F0D8"),
  26: stops("123044", "E6C98A", "F4E7C8", "3E8EA0"),
  27: stops("FF7A9C", "FFD0A8", "FFF3C4", "C8F5E4"),
  31: stops("1A1030", "6A3A8A", "E25B5B", "F2C14E"),
  35: stops("1A0500", "8A1200", "FF4D00", "FFB000", "FFF1C9"),
  36: stops("16040C", "C81E3A", "FF7A3C", "7FD3FF", "E8F7FF"),
  37: stops("041820", "0E7490", "67E8F9", "ECFEFF"),
  38: stops("2A1018", "E8A0B4", "F8D5DE", "FFF5F7"),
  39: stops("2A1208", "8A3A12", "D4652F", "E2B15A", "6B7030"),
  40: stops("220018", "A1006A", "FF4FA3", "FFD0EA"),
  43: stops("14180A", "E2D35A", "7AA0FF", "1E2A6B"),
  44: stops("0E2424", "0F766E", "F4A261", "E76F51", "FED7AA"),
  45: stops("100818", "4C1D95", "DB2777", "F59E0B", "22D3EE"),
  46: stops("0A1020", "1E3A5F", "C4A574", "E8D7B0", "8FA4C4"),
  47: stops("2A1408", "C4652A", "F2C078", "FFE8C2"),
  48: stops("3A0010", "C41230", "F2F2F2", "1D4ED8", "12263F"),
  49: stops("2A1218", "E89AB0", "F6D5DE", "FFF8F6", "C7D6B8"),
  50: stops("071612", "1F6B4A", "7DFFB2", "C8F5E0", "123A4A"),
  51: stops("04141C", "0E4D6B", "3E8CFF", "D6E6FF"),
  54: stops("1E3A8A", "22D3EE", "F8FAFC", "F59E0B", "DC2626"),
  57: stops("FF4D8D", "FFD166", "7CF0C4", "7AA2FF"),
  60: stops("071625", "1D4E89", "7EB6FF", "E7F0FF"),
  61: stops("FF8FB8", "FFD0E0", "FFF5F8", "E25B8A"),
  63: stops("042028", "14B8A6", "99F6E4", "ECFEFF"),
  64: stops("1A1404", "FACC15", "38BDF8", "082F49"),
  65: stops("1A1C18", "D6D3C8", "F5F3EC"),
  66: stops("2A0008", "FF1A3C", "7A0018", "FF8AA0"),
  67: stops("120004", "FF0033", "2A0008", "FF3355"),
  68: stops("1A0508", "9F1239", "FB7185", "FFF1F2"),
};

function tone(h: number, s: number, l: number): RGB {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lig - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function autoStops(id: number): RGB[] {
  const h = (id * 41) % 360;
  return [tone(h, 42, 16), tone(h, 72, 42), tone((h + 24) % 360, 78, 62), tone((h + 48) % 360, 36, 86)];
}

export const PALETTES: Palette[] = NAMES.map((name, id) => ({
  id,
  name,
  stops: HAND[id] ?? autoStops(id),
  discrete: id === 12 || id === 67,
}));

const NAMED = PALETTES.filter((p) => p.id >= 6);

export function paletteById(id: number): Palette | undefined {
  return PALETTES[id];
}

export function paletteName(id: number, deviceNames?: string[]): string {
  const fromDevice = deviceNames?.[id];
  if (fromDevice) return fromDevice;
  return PALETTES[id]?.name ?? `Palette ${id}`;
}

export function stopsFor(
  id: number,
  colors: [RGB, RGB, RGB],
  t: number,
): { stops: RGB[]; discrete: boolean } {
  if (id === 0 || id === 4) return { stops: [colors[0], colors[1], colors[2]], discrete: false };
  if (id === 2) return { stops: [colors[0], colors[0]], discrete: false };
  if (id === 3) return { stops: [colors[0], colors[1]], discrete: false };
  if (id === 5) return { stops: [colors[0], colors[1], colors[2]], discrete: true };
  if (id === 1) {
    const pick = NAMED[Math.floor(Math.abs(t) / 6) % NAMED.length] ?? NAMED[0];
    return { stops: pick.stops, discrete: false };
  }
  const found = PALETTES[id];
  if (found) return { stops: found.stops, discrete: !!found.discrete };
  return { stops: autoStops(id), discrete: false };
}

export function sampleStops(stops: RGB[], index: number, discrete: boolean): RGB {
  if (stops.length === 0) return [0, 0, 0];
  const u = (((index % 256) + 256) % 256) / 256;
  if (discrete) {
    const i = Math.min(stops.length - 1, Math.floor(u * stops.length));
    return stops[i] ?? stops[0];
  }
  if (stops.length === 1) return stops[0];
  const x = u * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i] ?? stops[0];
  const b = stops[Math.min(stops.length - 1, i + 1)] ?? a;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function toHex(c: RGB): string {
  const b = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${b(c[0])}${b(c[1])}${b(c[2])}`;
}

export function fromHex(h: string): RGB {
  const x = h.replace("#", "");
  return [parseInt(x.slice(0, 2), 16) || 0, parseInt(x.slice(2, 4), 16) || 0, parseInt(x.slice(4, 6), 16) || 0];
}

export function rgbHex(r: number, g: number, b: number): string {
  const byte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `${byte(r)}${byte(g)}${byte(b)}`;
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}
