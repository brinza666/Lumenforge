import { useState } from "react";
import { Download } from "lucide-react";
import { LampError, postState } from "@/lib/wled/client";
import { downloadText } from "@/lib/wled/download";
import { toHex } from "@/lib/wled/palettes";
import { stopsFor } from "@/lib/wled/palettes";
import {
  buildMix,
  planSlots,
  playlistPayload,
  presetsFile,
  stateForLook,
  usedPresetNames,
  type ResolvedItem,
} from "@/lib/wled/playlist";
import { useBench } from "@/lib/wled/store";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PlaylistPanel() {
  const playlist = useBench((s) => s.playlist);
  const playlistOn = useBench((s) => s.playlistOn);
  const playlistIndex = useBench((s) => s.playlistIndex);
  const lamp = useBench((s) => s.lamp);
  const bri = useBench((s) => s.bri);
  const ledCount = useBench((s) => s.ledCount);
  const [count, setCount] = useState(24);
  const [seed, setSeed] = useState(playlist.seed || 14017);
  const [hold, setHold] = useState(playlist.hold || 8);
  const [fade, setFade] = useState(playlist.fade || 0.8);
  const [varied, setVaried] = useState(true);
  const [mode, setMode] = useState<"forge" | "lamp">(playlist.mode);
  const [start, setStart] = useState(180);
  const [target, setTarget] = useState<"cousin" | "lumenforge">("cousin");
  const [overwrite, setOverwrite] = useState(false);
  const [shuffle, setShuffle] = useState(true);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const stop = useState({ current: false })[0];

  const names = new Map<number, string>();
  if (lamp?.presets) {
    for (const [key, value] of Object.entries(lamp.presets)) {
      const id = Number(key);
      if (!Number.isFinite(id)) continue;
      const rec = value as { n?: string };
      if (rec && typeof rec === "object") names.set(id, rec.n || `Preset ${id}`);
    }
  }
  const used = lamp?.presets ? usedPresetNames(Object.keys(lamp.presets), names) : new Map<number, string>();
  const slots = planSlots(used, start, playlist.items.length);
  const occupied = slots.filter((s) => s.occupiedName).length;
  const playlistSlot = slots.length ? slots[slots.length - 1].id + 1 : start;

  function generate() {
    const mix = buildMix({
      mode,
      count,
      seed: seed || 1,
      hold,
      fade,
      varied,
      names: lamp?.effects,
    });
    useBench.getState().setPlaylist(mix);
    setNote(`${mix.items.length} looks, seed ${mix.seed}.`);
  }

  function download() {
    if (!playlist.items.length) return;
    const effects = lamp?.effects ?? [];
    const resolved: ResolvedItem[] = [];
    const planned = planSlots(used, start, playlist.items.length);
    for (let i = 0; i < playlist.items.length; i++) {
      const item = playlist.items[i];
      const slot = planned[i];
      if (!item || !slot) break;
      const state = stateForLook(item, effects, target, ledCount, true);
      if (!state || state.missing) {
        setNote(state?.missing ? `Missing “${state.missing}” on this effect list.` : "Nothing to export.");
        return;
      }
      resolved.push({ slot: slot.id, name: item.name, hold: item.hold, fade: item.fade, body: state.body });
    }
    const plSlot = planned.length ? planned[planned.length - 1].id + 1 : start;
    if (plSlot > 250) {
      setNote("The playlist slot would pass 250. Lower the start slot or the count.");
      return;
    }
    downloadText(
      "lumenforge-presets.json",
      presetsFile(resolved, plSlot, playlist.name || "Lumenforge mix", bri, shuffle),
      "application/json",
    );
    setNote("Downloaded a presets fragment. Prefer Write to lamp — a file restore includes segment length.");
  }

  async function write() {
    if (!lamp) {
      setNote("Connect a lamp first. You can still download the JSON.");
      return;
    }
    if (!playlist.items.length) return;
    if (playlistSlot > 250) {
      setNote("Not enough preset slots before 250.");
      return;
    }
    if (occupied > 0 && !overwrite) {
      setNote(`${occupied} of those slots already have presets. Confirm overwrite, or pick a higher start slot.`);
      return;
    }
    const effects = lamp.effects;
    stop.current = false;
    setBusy(true);
    setNote("");
    const user = useBench.getState().user;
    const password = useBench.getState().password;
    try {
      const written: number[] = [];
      for (let i = 0; i < playlist.items.length; i++) {
        if (stop.current) throw new LampError("Stopped.", "bad");
        const item = playlist.items[i];
        const slot = slots[i];
        if (!item || !slot) break;
        const state = stateForLook(item, effects, target, ledCount, false);
        if (!state || state.missing) {
          throw new LampError(
            state?.missing
              ? `“${state.missing}” is not on this lamp. Flash the usermod, or write stock cousins.`
              : "Could not build that look.",
            "bad",
          );
        }
        setProgress(`${i + 1} / ${playlist.items.length} · ${item.name}`);
        await postState(lamp.origin, { ...state.body, bri }, user, password);
        await sleep(180);
        await postState(lamp.origin, { psave: slot.id, n: item.name.slice(0, 32), ib: true, sb: false }, user, password);
        await sleep(220);
        written.push(slot.id);
      }
      const payload = playlistPayload(
        written,
        playlist.items.map((item) => item.hold),
        playlist.items.map((item) => item.fade),
        shuffle,
      );
      await postState(lamp.origin, payload, user, password);
      await sleep(200);
      await postState(
        lamp.origin,
        { psave: playlistSlot, n: (playlist.name || "Lumenforge mix").slice(0, 32), ib: true, sb: false },
        user,
        password,
      );
      setNote(`Saved ${written.length} presets and playlist ${playlistSlot}. On the lamp, load preset ${playlistSlot}.`);
      setProgress("");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "The lamp did not take the playlist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel grid gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn ${mode === "forge" ? "btn-primary" : ""}`} onClick={() => setMode("forge")}>
            New looks
          </button>
          <button type="button" className={`btn ${mode === "lamp" ? "btn-primary" : ""}`} onClick={() => setMode("lamp")}>
            Lamp effects
          </button>
        </div>
        <label className="block">
          <span className="field-label">
            <span>How many</span>
            <span className="text-fg tabular-nums">{count}</span>
          </span>
          <input type="range" min={10} max={100} value={count} aria-label="How many" onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="field-label">
              <span>Hold seconds</span>
            </span>
            <input
              className="mt-1 h-11 w-full rounded-md border border-line bg-bg-inset px-3 text-fg"
              type="number"
              min={2}
              max={120}
              value={hold}
              onChange={(e) => setHold(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span className="field-label">
              <span>Fade seconds</span>
            </span>
            <input
              className="mt-1 h-11 w-full rounded-md border border-line bg-bg-inset px-3 text-fg"
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={fade}
              onChange={(e) => setFade(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={varied} onChange={(e) => setVaried(e.target.checked)} />
          Vary the timing
        </label>
        <label className="block text-sm">
          <span className="field-label">
            <span>Seed</span>
          </span>
          <input
            className="mt-1 h-11 w-full rounded-md border border-line bg-bg-inset px-3 text-fg tabular-nums"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={generate}>
          Generate {count}
        </button>
        <p className="text-sm text-muted">
          {mode === "forge"
            ? "New looks are rendered here. On a stock lamp they can be streamed, or saved as the nearest built-in effect."
            : "Picks from the lamp’s effect list when you are connected, otherwise a WLED 0.14 name list. The bench only sketches them."}
        </p>
      </div>

      {playlist.items.length ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn" onClick={() => useBench.getState().setPlaylistOn(!playlistOn)}>
              {playlistOn ? "Pause mix" : "Play mix"}
            </button>
            <button
              type="button"
              className="btn btn-live"
              disabled={!lamp}
              onClick={() => {
                useBench.getState().setPlaylistOn(true);
                useBench.getState().setLive(true);
                useBench.getState().setTab("look");
              }}
            >
              Stream mix
            </button>
            <span className="text-sm text-muted tabular-nums">
              {playlist.items.length} · seed {playlist.seed}
            </span>
          </div>
          <ol className="max-h-80 overflow-auto rounded-md border border-line">
            {playlist.items.map((item, i) => {
              const pal = item.forge?.paletteId ?? item.lamp?.paletteId ?? 0;
              const colors = item.forge?.colors ?? item.lamp?.colors ?? [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
              const gradient = stopsFor(pal, colors, 0).stops.map(toHex).join(",");
              const current = playlistOn && i === playlistIndex % playlist.items.length;
              return (
                <li key={item.uid}>
                  <button
                    type="button"
                    onClick={() => useBench.getState().focusItem(i)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left ${current ? "bg-bg-inset" : ""}`}
                  >
                    <span className="w-8 text-xs text-muted tabular-nums">{i + 1}</span>
                    <span className="h-8 w-12 shrink-0 rounded-sm" style={{ background: `linear-gradient(90deg, ${gradient})` }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.name}</span>
                      <span className="block text-xs text-muted tabular-nums">{item.hold}s</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-muted">No mix yet. Generate one, or add the look you are editing.</p>
      )}

      <div className="panel grid gap-3">
        <p className="font-medium">Put it on the lamp</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn ${target === "cousin" ? "btn-primary" : ""}`} onClick={() => setTarget("cousin")}>
            Stock cousins
          </button>
          <button type="button" className={`btn ${target === "lumenforge" ? "btn-primary" : ""}`} onClick={() => setTarget("lumenforge")}>
            LF effects
          </button>
        </div>
        <p className="text-sm text-muted">
          {target === "cousin"
            ? "Each step becomes a preset of a built-in effect (Pacifica for Tide, Fire 2012 for Emberline, and so on). The lamp can play it alone. It will not match pixel for pixel."
            : "Uses effect names from the usermod (LF Veil, LF Tide…). Flash that build first, then connect, or the lamp will not list them."}
        </p>
        <label className="block text-sm">
          <span className="field-label">
            <span>First preset slot</span>
          </span>
          <input
            className="mt-1 h-11 w-full rounded-md border border-line bg-bg-inset px-3 text-fg tabular-nums"
            type="number"
            min={1}
            max={250}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
          />
        </label>
        <p className="text-sm text-muted tabular-nums">
          Playlist preset {playlistSlot > 250 ? "— no room" : playlistSlot}
          {occupied ? ` · ${occupied} slots already used` : ""}
        </p>
        {occupied > 0 ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
            Overwrite occupied slots
          </label>
        ) : null}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          Shuffle on the lamp
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" disabled={busy || !playlist.items.length} onClick={() => void write()}>
            {busy ? "Writing…" : "Write to lamp"}
          </button>
          <button type="button" className="btn" disabled={!playlist.items.length} onClick={download}>
            <Download size={18} aria-hidden />
            JSON
          </button>
          {busy ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                stop.current = true;
              }}
            >
              Stop
            </button>
          ) : null}
        </div>
        {progress ? <p className="text-sm tabular-nums">{progress}</p> : null}
        {note ? <p className="text-sm text-muted">{note}</p> : null}
        <p className="text-sm text-muted">
          Durations are sent in tenths of a second, which is what WLED playlists store. Segment bounds are not saved, so your strip length stays as it is.
        </p>
      </div>
    </div>
  );
}
