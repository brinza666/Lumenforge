import { useEffect, useMemo, useRef, useState } from "react";
import sampleRaw from "@/data/sample-presets.json?raw";
import { effectIsAudio, STOCK_EFFECTS, sketchKindForName } from "@/lib/wled/catalog";
import {
  blockedMessage,
  LampError,
  loadLamp,
  normalizeOrigin,
  pageIsSecure,
  postState,
  probeHost,
  subnetPrefix,
} from "@/lib/wled/client";
import { effectPresetPayload, playlistPayload } from "@/lib/wled/playlist";
import { oddPlaylistIds, parsePresets, type ParsedEffectPreset, type ParsedPlaylist, type PresetLibrary } from "@/lib/wled/presets";
import { useBench, type SketchStage } from "@/lib/wled/store";

export function LampPanel() {
  const hostInput = useBench((s) => s.hostInput);
  const recentHosts = useBench((s) => s.recentHosts);
  const user = useBench((s) => s.user);
  const password = useBench((s) => s.password);
  const lamp = useBench((s) => s.lamp);
  const status = useBench((s) => s.lampStatus);
  const error = useBench((s) => s.lampError);
  const ledCount = useBench((s) => s.ledCount);
  const [sample, setSample] = useState<PresetLibrary | null>(null);
  const [opened, setOpened] = useState<PresetLibrary | null>(null);
  const [filter, setFilter] = useState("");
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<{ origin: string; name: string }[]>([]);
  const [scanNote, setScanNote] = useState("");
  const [allowScan, setAllowScan] = useState(false);
  const scanStop = useRef(false);
  const [showAuth, setShowAuth] = useState(false);
  const [fxQuery, setFxQuery] = useState("");

  useEffect(() => {
    try {
      setSample(parsePresets(JSON.parse(sampleRaw)));
    } catch {
      setSample(null);
    }
  }, []);

  async function connect(raw?: string) {
    const origin = normalizeOrigin(raw ?? hostInput);
    if (!origin) {
      useBench.getState().setLampStatus("error", "Enter an address, like 192.168.1.42 or wled.local.");
      return;
    }
    useBench.getState().setLampStatus("connecting");
    useBench.getState().setLive(false);
    try {
      const snap = await loadLamp(origin, useBench.getState().user, useBench.getState().password);
      useBench.getState().setLamp(snap);
      useBench.getState().setLampStatus("online");
      useBench.getState().rememberHost(origin);
    } catch (err) {
      useBench.getState().setLamp(null);
      useBench.getState().setLampStatus("error", err instanceof LampError ? err.message : "Could not connect.");
    }
  }

  async function scan() {
    const prefix = subnetPrefix(hostInput) ?? subnetPrefix("http://192.168.1.20");
    if (!prefix) {
      setScanNote("Type an address on your network first, so the scan knows the subnet.");
      return;
    }
    if (pageIsSecure() && !allowScan) {
      setScanNote(blockedMessage());
      return;
    }
    setScanning(true);
    scanStop.current = false;
    setFound([]);
    setScanNote(`Looking across ${prefix}.0`);
    const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
    const hits: { origin: string; name: string }[] = [];
    let cursor = 0;
    const workers = Array.from({ length: 8 }, async () => {
      for (;;) {
        if (scanStop.current) return;
        const n = cursor;
        cursor += 1;
        if (n >= hosts.length) return;
        const origin = `http://${hosts[n]}`;
        const info = await probeHost(origin, useBench.getState().user, useBench.getState().password);
        if (info) {
          hits.push({ origin, name: info.name || info.ver || origin });
          setFound([...hits]);
        }
      }
    });
    await Promise.all(workers);
    setScanning(false);
    if (!hits.length) setScanNote(pageIsSecure() ? blockedMessage() : "No WLED lamp answered on that subnet.");
    else setScanNote(`Found ${hits.length}.`);
  }

  const deviceLib = useMemo(() => (lamp?.presets ? parsePresets(lamp.presets) : null), [lamp]);
  const effectNames = lamp?.effects?.length ? lamp.effects : STOCK_EFFECTS;

  return (
    <div className="flex flex-col gap-4">
      <div className="panel grid gap-3">
        <label className="block text-sm">
          <span className="field-label">
            <span>Lamp address</span>
          </span>
          <input
            className="mt-1 h-11 w-full rounded-md border border-line bg-bg-inset px-3 text-fg"
            value={hostInput}
            spellCheck={false}
            autoCapitalize="none"
            placeholder="192.168.1.42 or wled.local"
            onChange={(e) => useBench.getState().setHost(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => void connect()} disabled={status === "connecting"}>
            {status === "connecting" ? "Connecting…" : "Connect"}
          </button>
          <button type="button" className="btn" onClick={() => void connect("wled.local")}>
            wled.local
          </button>
          <button type="button" className="btn" onClick={() => setShowAuth((v) => !v)}>
            Password
          </button>
        </div>
        {showAuth ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="h-11 rounded-md border border-line bg-bg-inset px-3 text-fg"
              value={user}
              aria-label="User"
              onChange={(e) => useBench.getState().setUser(e.target.value)}
            />
            <input
              className="h-11 rounded-md border border-line bg-bg-inset px-3 text-fg"
              value={password}
              type="password"
              aria-label="Password"
              onChange={(e) => useBench.getState().setPassword(e.target.value)}
            />
          </div>
        ) : null}
        {recentHosts.length ? (
          <div className="flex flex-wrap gap-2">
            {recentHosts.map((host) => (
              <button key={host} type="button" className="btn" onClick={() => void connect(host)}>
                {host.replace(/^https?:\/\//, "")}
              </button>
            ))}
          </div>
        ) : null}
        {error ? <p className="text-sm text-primary">{error}</p> : null}
        {lamp && status === "online" ? (
          <div className="grid gap-1 text-sm">
            <p>
              <span className="text-live">{lamp.info.name || "WLED"}</span>
              <span className="text-muted"> · {lamp.info.ver || "unknown version"} · {lamp.info.arch || "board"}</span>
            </p>
            <p className="text-muted tabular-nums">
              {lamp.info.leds?.count ?? "?"} LEDs · {lamp.effects.length || lamp.info.fxcount || "?"} effects ·{" "}
              {lamp.palettes.length || lamp.info.palcount || "?"} palettes
              {lamp.info.leds?.fps ? ` · ${lamp.info.leds.fps} fps` : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="btn"
                onClick={() => useBench.getState().setLedCount(Math.min(600, lamp.info.leds?.count || ledCount))}
              >
                Match preview to {lamp.info.leds?.count ?? "lamp"}
              </button>
              <a className="btn" href={`${lamp.origin}/`} target="_blank" rel="noreferrer">
                Open lamp page
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Discovery asks the browser to call the lamp directly. One known lamp can also list the others it has seen.
          </p>
        )}
      </div>

      {lamp?.nodes?.length ? (
        <div className="panel">
          <p className="mb-2 text-sm font-medium">Seen on the network</p>
          <div className="flex flex-col gap-2">
            {lamp.nodes.map((node) => (
              <button
                key={`${node.ip}-${node.name}`}
                type="button"
                className="btn justify-start"
                disabled={!node.ip}
                onClick={() => node.ip && void connect(node.ip)}
              >
                {node.name || "WLED"} · {node.ip}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="panel grid gap-2">
        <p className="text-sm font-medium">Search the subnet</p>
        <p className="text-sm text-muted">Knocks on every address near the one you typed. Stop any time. From an https page this often fails outright.</p>
        {pageIsSecure() ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={allowScan} onChange={(e) => setAllowScan(e.target.checked)} />
            Scan anyway
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={scanning} onClick={() => void scan()}>
            {scanning ? "Scanning…" : "Scan"}
          </button>
          {scanning ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                scanStop.current = true;
                setScanning(false);
              }}
            >
              Stop
            </button>
          ) : null}
        </div>
        {found.map((hit) => (
          <button key={hit.origin} type="button" className="btn justify-start" onClick={() => void connect(hit.origin)}>
            {hit.name} · {hit.origin.replace(/^https?:\/\//, "")}
          </button>
        ))}
        {scanNote ? <p className="text-sm text-muted">{scanNote}</p> : null}
      </div>

      <div className="panel grid gap-2">
        <p className="text-sm font-medium">Effects on {lamp ? "this lamp" : "a typical WLED 0.14 build"}</p>
        <input
          className="h-11 rounded-md border border-line bg-bg-inset px-3 text-fg"
          placeholder="Filter effects"
          aria-label="Filter effects"
          value={fxQuery}
          onChange={(e) => setFxQuery(e.target.value)}
        />
        <ul className="max-h-64 overflow-auto">
          {effectNames
            .map((name, index) => ({ name, index, audio: effectIsAudio(lamp?.fxdata?.[index]) }))
            .filter((row) => row.name.toLowerCase().includes(fxQuery.trim().toLowerCase()))
            .slice(0, 80)
            .map((row) => (
              <li key={`${row.index}-${row.name}`}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm"
                  onClick={() => {
                    const stage: SketchStage = {
                      kind: "sketch",
                      title: row.name,
                      fxName: row.name,
                      speed: 128,
                      intensity: 128,
                      paletteId: 11,
                      colors: [
                        [255, 180, 60],
                        [8, 10, 16],
                        [180, 220, 255],
                      ],
                      reverse: false,
                      mirror: false,
                    };
                    useBench.getState().showSketch(stage);
                    if (lamp) {
                      void postState(
                        lamp.origin,
                        { on: true, seg: [{ id: 0, fx: row.index }] },
                        useBench.getState().user,
                        useBench.getState().password,
                      ).catch((err: unknown) => {
                        useBench.getState().setLampStatus("error", err instanceof Error ? err.message : "Could not set the effect.");
                      });
                    }
                  }}
                >
                  <span>
                    {row.name}
                    {row.audio ? <span className="text-muted"> · sound</span> : null}
                  </span>
                  <span className="text-xs text-muted">{sketchKindForName(row.name)}</span>
                </button>
              </li>
            ))}
        </ul>
      </div>

      <LibraryBlock
        title="Sample file"
        hint="Your attached presets.json, including the Vse playlists. Sending a look pushes its segment. Sending a playlist only works if those preset ids exist on the lamp."
        library={opened ?? sample}
        filter={filter}
        onFilter={setFilter}
        mode="segment"
      />
      <label className="btn cursor-pointer">
        Open another presets.json
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              setOpened(parsePresets(JSON.parse(await file.text())));
            } catch {
              useBench.getState().setLampStatus("error", "That file is not presets JSON.");
            }
          }}
        />
      </label>
      {deviceLib ? (
        <LibraryBlock
          title="Presets on the lamp"
          hint="Apply loads the preset id, so playlists run exactly as stored."
          library={deviceLib}
          filter={filter}
          onFilter={setFilter}
          mode="id"
        />
      ) : null}
    </div>
  );
}

function LibraryBlock({
  title,
  hint,
  library,
  filter,
  onFilter,
  mode,
}: {
  title: string;
  hint: string;
  library: PresetLibrary | null;
  filter: string;
  onFilter: (v: string) => void;
  mode: "id" | "segment";
}) {
  if (!library) return null;
  const q = filter.trim().toLowerCase();
  const effects = library.effects.filter((p) => !q || `${p.name} ${p.fx}`.toLowerCase().includes(q));
  const playlists = library.playlists.filter((p) => !q || p.name.toLowerCase().includes(q));
  return (
    <div className="panel grid gap-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted">{hint}</p>
      <input
        className="h-11 rounded-md border border-line bg-bg-inset px-3 text-fg"
        placeholder="Filter presets"
        aria-label={`Filter ${title}`}
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
      />
      <p className="text-xs text-muted tabular-nums">
        {effects.length} looks · {playlists.length} playlists
      </p>
      <ul className="max-h-72 overflow-auto">
        {playlists.map((pl) => (
          <li key={`pl-${pl.id}`} className="border-b border-line py-2">
            <PlaylistRow playlist={pl} />
          </li>
        ))}
        {effects.slice(0, 60).map((preset) => (
          <li key={`fx-${preset.id}`} className="border-b border-line py-2">
            <EffectRow preset={preset} mode={mode} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EffectRow({ preset, mode }: { preset: ParsedEffectPreset; mode: "id" | "segment" }) {
  const lamp = useBench((s) => s.lamp);
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          const stage: SketchStage = {
            kind: "sketch",
            title: preset.name,
            fxName: lamp?.effects[preset.fx] || STOCK_EFFECTS[preset.fx] || `Effect ${preset.fx}`,
            speed: preset.sx,
            intensity: preset.ix,
            paletteId: preset.pal,
            colors: preset.colors,
            reverse: preset.rev,
            mirror: preset.mi,
          };
          useBench.getState().showSketch(stage);
        }}
      >
        <span className="block truncate text-sm">{preset.name}</span>
        <span className="block text-xs text-muted tabular-nums">
          #{preset.id} · fx {preset.fx} · pal {preset.pal}
        </span>
      </button>
      <button
        type="button"
        className="btn"
        disabled={!lamp}
        onClick={() => {
          if (!lamp) return;
          const body = mode === "id" ? { ps: preset.id, on: true } : effectPresetPayload(preset, true);
          void postState(lamp.origin, body, useBench.getState().user, useBench.getState().password).catch((err: unknown) => {
            useBench.getState().setLampStatus("error", err instanceof Error ? err.message : "Could not apply the preset.");
          });
        }}
      >
        {mode === "id" ? "Apply" : "Send"}
      </button>
    </div>
  );
}

function PlaylistRow({ playlist }: { playlist: ParsedPlaylist }) {
  const lamp = useBench((s) => s.lamp);
  const odd = oddPlaylistIds(playlist.playlist);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm">{playlist.name}</p>
        <p className="text-xs text-muted tabular-nums">
          #{playlist.id} · {playlist.playlist.ps.length} steps
          {odd.length ? ` · ${odd.length} ids outside 1–250` : ""}
        </p>
      </div>
      <button
        type="button"
        className="btn"
        disabled={!lamp}
        onClick={() => {
          if (!lamp) return;
          const pl = playlist.playlist;
          void postState(
            lamp.origin,
            playlistPayload(pl.ps, pl.dur.map((d) => d / 10), pl.transition.map((d) => d / 10), pl.shuffle),
            useBench.getState().user,
            useBench.getState().password,
          ).catch((err: unknown) => {
            useBench.getState().setLampStatus("error", err instanceof Error ? err.message : "Could not start the playlist.");
          });
        }}
      >
        Run
      </button>
    </div>
  );
}
