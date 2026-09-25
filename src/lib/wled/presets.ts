import type { RGB } from "@/lib/wled/palettes";

export type WledPlaylist = {
  ps: number[];
  dur: number[];
  transition: number[];
  repeat: number;
  shuffle: boolean;
  end: number;
};

export type ParsedEffectPreset = {
  id: number;
  name: string;
  bri: number;
  transition: number;
  fx: number;
  sx: number;
  ix: number;
  pal: number;
  colors: [RGB, RGB, RGB];
  rev: boolean;
  mi: boolean;
  on: boolean;
};

export type ParsedPlaylist = {
  id: number;
  name: string;
  playlist: WledPlaylist;
};

export type PresetLibrary = {
  effects: ParsedEffectPreset[];
  playlists: ParsedPlaylist[];
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function rgbOf(v: unknown, fallback: RGB): RGB {
  if (!Array.isArray(v) || v.length < 3) return fallback;
  return [
    Math.max(0, Math.min(255, num(v[0]))),
    Math.max(0, Math.min(255, num(v[1]))),
    Math.max(0, Math.min(255, num(v[2]))),
  ];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function normalizePlaylist(raw: Record<string, unknown>): WledPlaylist | null {
  const psRaw = raw.ps;
  if (!Array.isArray(psRaw) || psRaw.length === 0) return null;
  const ps = psRaw.map((n) => num(n)).filter((n) => n > 0);
  if (ps.length === 0) return null;
  const durRaw = Array.isArray(raw.dur) ? raw.dur.map((n) => num(n, 100)) : [];
  const trRaw = Array.isArray(raw.transition)
    ? raw.transition.map((n) => num(n, 7))
    : typeof raw.transition === "number"
      ? ps.map(() => raw.transition as number)
      : [];
  const dur = ps.map((_, i) => (durRaw[i] && durRaw[i] > 0 ? durRaw[i] : durRaw[durRaw.length - 1] || 100));
  const transition = ps.map((_, i) => (trRaw[i] !== undefined ? trRaw[i] : 7));
  return {
    ps,
    dur,
    transition,
    repeat: num(raw.repeat, 0),
    shuffle: raw.r === true || raw.r === 1 || raw.r === "1",
    end: num(raw.end, 0),
  };
}

const FALLBACK: RGB = [255, 160, 40];

export function parsePresets(raw: unknown): PresetLibrary {
  const root = asRecord(raw);
  if (!root) return { effects: [], playlists: [] };
  const effects: ParsedEffectPreset[] = [];
  const playlists: ParsedPlaylist[] = [];
  for (const [key, value] of Object.entries(root)) {
    const id = num(key, NaN);
    if (!Number.isFinite(id) || id <= 0) continue;
    const preset = asRecord(value);
    if (!preset) continue;
    const name = typeof preset.n === "string" && preset.n.trim() ? preset.n : `Preset ${id}`;
    const playlistRaw = asRecord(preset.playlist);
    if (playlistRaw) {
      const playlist = normalizePlaylist(playlistRaw);
      if (playlist) playlists.push({ id, name, playlist });
      continue;
    }
    const segs = Array.isArray(preset.seg) ? preset.seg : [];
    const seg = segs.map(asRecord).find((s) => s && (s.fx !== undefined || num(s.stop) > num(s.start)));
    if (!seg || seg.fx === undefined) continue;
    const cols = Array.isArray(seg.col) ? seg.col : [];
    effects.push({
      id,
      name,
      bri: num(preset.bri, 200),
      transition: num(preset.transition, 7),
      fx: num(seg.fx),
      sx: num(seg.sx, 128),
      ix: num(seg.ix, 128),
      pal: num(seg.pal),
      colors: [
        rgbOf(cols[0], FALLBACK),
        rgbOf(cols[1], [0, 0, 0]),
        rgbOf(cols[2], [0, 0, 0]),
      ],
      rev: seg.rev === true,
      mi: seg.mi === true,
      on: preset.on !== false,
    });
  }
  effects.sort((a, b) => a.id - b.id);
  playlists.sort((a, b) => a.id - b.id);
  return { effects, playlists };
}

export function oddPlaylistIds(pl: WledPlaylist): number[] {
  return pl.ps.filter((id) => id < 1 || id > 250);
}
