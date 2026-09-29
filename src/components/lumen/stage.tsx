import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Pause, Play, Power, Radio } from "lucide-react";
import { sketchKindForName } from "@/lib/wled/catalog";
import { postState } from "@/lib/wled/client";
import {
  effectById,
  groupPixels,
  renderForge,
  renderSketch,
  SILENT_AUDIO,
  toWireOrder,
  type AudioLevels,
  type ForgeParams,
} from "@/lib/wled/engine";
import { fixtureLabel, MATRIX_PRESETS, RIBBON_PRESETS, type Fixture } from "@/lib/wled/fixture";
import type { PlaylistItem } from "@/lib/wled/playlist";
import { paintFixture } from "@/lib/wled/preview-draw";
import { activeItem, useBench, type SketchStage } from "@/lib/wled/store";

type Levels = AudioLevels;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

class MicTap {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;
  private stream: MediaStream | null = null;
  running = false;

  async start() {
    const Ctx = window.AudioContext;
    this.ctx = new Ctx();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.72;
    src.connect(this.analyser);
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.running = true;
  }

  sample(): { bass: number; mid: number; high: number; energy: number } | null {
    if (!this.analyser || !this.data || !this.running) return null;
    this.analyser.getByteFrequencyData(this.data);
    const n = this.data.length;
    const bN = Math.max(1, (n * 0.08) | 0);
    const mN = Math.max(bN + 1, (n * 0.32) | 0);
    let b = 0;
    let m = 0;
    let h = 0;
    let e = 0;
    for (let i = 0; i < n; i++) {
      const v = this.data[i] / 255;
      e += v;
      if (i < bN) b += v;
      else if (i < mN) m += v;
      else h += v;
    }
    return {
      bass: b / bN,
      mid: m / Math.max(1, mN - bN),
      high: h / Math.max(1, n - mN),
      energy: e / n,
    };
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
  }
}

function levelsFor(t: number, active: boolean, mic: MicTap | null, lastPeak: { t: number }): Levels {
  const live = mic?.sample();
  if (live && active) {
    const peak = live.bass > 0.55 && t - lastPeak.t > 0.28;
    if (peak) lastPeak.t = t;
    return { active: true, synthetic: false, peak, ...live };
  }
  if (!active) return SILENT_AUDIO;
  const kick = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 0.9)), 8);
  const peak = kick > 0.7 && t - lastPeak.t > 0.45;
  if (peak) lastPeak.t = t;
  return {
    active: true,
    synthetic: true,
    peak,
    bass: kick,
    mid: 0.3 + 0.15 * Math.sin(t * 1.3),
    high: 0.18 + 0.08 * Math.sin(t * 2.2),
    energy: Math.min(1, 0.35 + kick * 0.6),
  };
}

function paramsFrom(
  base: Omit<ForgeParams, "speed" | "intensity" | "size" | "spark" | "colors" | "paletteId" | "mirror" | "reverse">,
  src: {
    speed: number;
    intensity: number;
    size?: number;
    spark?: number;
    colors: ForgeParams["colors"];
    paletteId: number;
    mirror: boolean;
    reverse: boolean;
  },
): ForgeParams {
  return {
    ...base,
    speed: src.speed,
    intensity: src.intensity,
    size: src.size ?? 120,
    spark: src.spark ?? 40,
    colors: src.colors,
    paletteId: src.paletteId,
    mirror: src.mirror,
    reverse: src.reverse,
  };
}

function renderItem(
  buf: Uint8ClampedArray,
  n: number,
  cols: number,
  rows: number,
  t: number,
  dt: number,
  audio: Levels,
  item: PlaylistItem | null,
  look: ReturnType<typeof useBench.getState>["look"],
  stage: ReturnType<typeof useBench.getState>["stage"],
  lane: string,
) {
  const base = { n, cols, rows, t, dt, audio };
  if (item?.forge) {
    renderForge(item.forge.effect, paramsFrom(base, item.forge), buf, lane);
    return;
  }
  if (item?.lamp) {
    renderSketch(sketchKindForName(item.lamp.fxName), paramsFrom(base, { ...item.lamp, size: 100, spark: 40 }), buf, lane);
    return;
  }
  if (stage.kind === "sketch") {
    const sketch = stage as SketchStage;
    renderSketch(sketchKindForName(sketch.fxName), paramsFrom(base, { ...sketch, size: 100, spark: 40 }), buf, lane);
    return;
  }
  renderForge(look.effect, paramsFrom(base, look), buf, lane);
}

function shapeOf(fixture: Fixture): { n: number; cols: number; rows: number } {
  if (fixture.kind === "matrix") return { n: fixture.cols * fixture.rows, cols: fixture.cols, rows: fixture.rows };
  return { n: fixture.count, cols: fixture.count, rows: 1 };
}

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const look = useBench((s) => s.look);
  const stage = useBench((s) => s.stage);
  const playing = useBench((s) => s.playing);
  const bri = useBench((s) => s.bri);
  const on = useBench((s) => s.on);
  const listen = useBench((s) => s.listen);
  const playlist = useBench((s) => s.playlist);
  const playlistOn = useBench((s) => s.playlistOn);
  const playlistIndex = useBench((s) => s.playlistIndex);
  const playlistEpoch = useBench((s) => s.playlistEpoch);
  const live = useBench((s) => s.live);
  const lamp = useBench((s) => s.lamp);
  const fixture = useBench((s) => s.fixture);
  const reduced = usePrefersReducedMotion();
  const [still, setStill] = useState(false);
  const [meter, setMeter] = useState({ bass: 0, mid: 0, high: 0, show: false, synthetic: true });
  const [liveNote, setLiveNote] = useState("");
  const [micNote, setMicNote] = useState("");

  const bag = useRef({
    look,
    stage,
    playing,
    bri,
    on,
    listen,
    playlist,
    playlistOn,
    playlistIndex,
    playlistEpoch,
    live,
    lamp,
    still,
    fixture,
  });
  bag.current = { look, stage, playing, bri, on, listen, playlist, playlistOn, playlistIndex, playlistEpoch, live, lamp, still, fixture };

  useEffect(() => {
    setStill(reduced);
  }, [reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const buf = new Uint8ClampedArray(32 * 32 * 3);
    const buf2 = new Uint8ClampedArray(32 * 32 * 3);
    const clock = { t: 1.2, itemT: 0, epoch: -1 };
    const peak = { t: -1 };
    let mic: MicTap | null = null;
    let raf = 0;
    let last = performance.now();
    let nextPush = 0;
    let inflight = false;
    let errors = 0;
    let sent = 0;
    let stamp = performance.now();
    let liveWas = false;
    let savedFx: number | null = null;
    let micWanted = false;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = bag.current;
      const moving = s.on && s.playing && !s.still;
      if (moving) {
        clock.t += dt;
        if (s.playlistOn) clock.itemT += dt;
      }
      if (clock.epoch !== s.playlistEpoch) {
        clock.epoch = s.playlistEpoch;
        clock.itemT = 0;
      }
      const count = s.playlist.items.length;
      const index = count ? ((s.playlistIndex % count) + count) % count : 0;
      const item = s.playlistOn && count ? s.playlist.items[index] : null;
      if (item && clock.itemT > item.hold) {
        clock.itemT = 0;
        useBench.getState().setPlaylistIndex((index + 1) % count);
      }
      const wantMic = s.listen;
      if (wantMic && !micWanted) {
        micWanted = true;
        const tap = new MicTap();
        void tap
          .start()
          .then(() => {
            if (bag.current.listen) mic = tap;
            else tap.stop();
          })
          .catch(() => {
            setMicNote("Microphone blocked. Sound looks keep a slow built-in pulse.");
            useBench.getState().setListen(false);
            micWanted = false;
          });
      }
      if (!wantMic && mic) {
        mic.stop();
        mic = null;
        micWanted = false;
      }
      const audioOn = s.listen || (item?.forge?.audio ?? (!item && s.stage.kind === "forge" && s.look.audio));
      const audio = levelsFor(clock.t, audioOn, mic, peak);
      const shape = shapeOf(s.fixture);
      renderItem(buf, shape.n, shape.cols, shape.rows, clock.t, dt || 0.016, audio, item ?? null, s.look, s.stage, "stage");
      if (item && count > 1 && item.fade > 0) {
        const remain = item.hold - clock.itemT;
        if (remain < item.fade && remain > 0) {
          const u = 1 - remain / item.fade;
          const next = s.playlist.items[(index + 1) % count];
          renderItem(buf2, shape.n, shape.cols, shape.rows, clock.t, dt || 0.016, audio, next, s.look, s.stage, "fade");
          const pixels = shape.n * 3;
          for (let i = 0; i < pixels; i++) buf[i] = buf[i] * (1 - u) + buf2[i] * u;
        }
      }
      if (!document.hidden) paintFixture(canvas, buf, shape.cols, shape.rows, s.on, s.bri);

      const user = useBench.getState().user;
      const password = useBench.getState().password;
      if (s.live && s.lamp && s.on) {
        if (!liveWas) {
          liveWas = true;
          const seg = (s.lamp.state as { seg?: { fx?: number }[] } | null)?.seg;
          savedFx = typeof seg?.[0]?.fx === "number" ? seg[0].fx : null;
          void postState(s.lamp.origin, { on: true, bri: s.bri }, user, password).catch(() => undefined);
        }
        if (now >= nextPush) {
          nextPush = now + 140;
          if (!inflight) {
            inflight = true;
            const dst = Math.max(1, s.lamp.info.leds?.count || shape.n);
            const wire =
              s.fixture.kind === "matrix" ? toWireOrder(buf, shape.cols, shape.rows, s.fixture.serpentine) : buf;
            const ranges = groupPixels(wire, shape.n, dst, s.bri);
            void postState(s.lamp.origin, { seg: [{ id: 0, i: ranges }] }, user, password)
              .then(() => {
                sent += 1;
                errors = 0;
              })
              .catch(() => {
                errors += 1;
                if (errors > 4) {
                  useBench.getState().setLive(false);
                  setLiveNote("The lamp stopped accepting frames.");
                }
              })
              .finally(() => {
                inflight = false;
              });
          }
        }
      } else if (liveWas) {
        liveWas = false;
        if (s.lamp && savedFx !== null) {
          void postState(s.lamp.origin, { seg: [{ id: 0, fx: savedFx }] }, user, password).catch(() => undefined);
        }
      }

      if (now - stamp > 800) {
        stamp = now;
        setLiveNote(s.live ? (sent ? `${Math.round(sent / 0.8)} frames/s to the lamp` : "Reaching the lamp…") : "");
        sent = 0;
        setMeter({ bass: audio.bass, mid: audio.mid, high: audio.high, synthetic: audio.synthetic, show: audio.active });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mic?.stop();
    };
  }, []);

  const item = activeItem({ playlist, playlistOn, playlistIndex });
  const fx = effectById(item?.forge?.effect ?? look.effect);
  let title = look.name;
  let detail = fx.blurb;
  if (item) {
    title = item.name;
    detail = playlist.mode === "lamp" ? "Playlist of firmware effects, sketched here." : "Playlist of original looks.";
  } else if (stage.kind === "sketch") {
    title = stage.title;
    detail = "Sketch of a stock effect. The picture above is local — the lamp is optional.";
  }

  const showPlay = !playing || still;
  const matrix = fixture.kind === "matrix";
  const canvasStyle = matrix
    ? { aspectRatio: `${fixture.cols} / ${fixture.rows}`, maxHeight: "70vw" }
    : { height: "9.5rem" };

  return (
    <section className="mx-auto w-full max-w-5xl px-4" aria-label="Light preview">
      <div className="housing">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{fixtureLabel(fixture)}</p>
            <h2 className="truncate font-display text-3xl leading-none text-fg">{title}</h2>
            <p className="mt-1 text-sm text-muted">{detail}</p>
          </div>
        </div>
        <canvas ref={canvasRef} className="fixture" style={canvasStyle} role="img" aria-label={`Preview of ${title}. No lamp required.`} />
        <p className="mt-2 text-sm text-muted">This preview always runs in the browser. A lamp is only needed if you want to stream it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`btn ${fixture.kind === "ribbon" ? "btn-primary" : ""}`} onClick={() => useBench.getState().setFixture({ kind: "ribbon", count: fixture.kind === "ribbon" ? fixture.count : 60 })}>
            Ribbon
          </button>
          <button
            type="button"
            className={`btn ${matrix ? "btn-primary" : ""}`}
            onClick={() =>
              useBench.getState().setFixture({
                kind: "matrix",
                cols: matrix ? fixture.cols : 16,
                rows: matrix ? fixture.rows : 16,
                serpentine: matrix ? fixture.serpentine : true,
              })
            }
          >
            Matrix
          </button>
          {fixture.kind === "ribbon"
            ? RIBBON_PRESETS.map((count) => (
                <button key={count} type="button" className={`btn ${fixture.count === count ? "btn-primary" : ""}`} onClick={() => useBench.getState().setFixture({ kind: "ribbon", count })}>
                  {count}
                </button>
              ))
            : MATRIX_PRESETS.map((size) => (
                <button
                  key={size.label}
                  type="button"
                  className={`btn ${fixture.cols === size.cols && fixture.rows === size.rows ? "btn-primary" : ""}`}
                  onClick={() => useBench.getState().setFixture({ kind: "matrix", cols: size.cols, rows: size.rows, serpentine: fixture.serpentine })}
                >
                  {size.label}
                </button>
              ))}
        </div>
        {matrix ? (
          <div className="mt-2">
            <button
              type="button"
              className={`btn ${fixture.serpentine ? "btn-primary" : ""}`}
              onClick={() => useBench.getState().setFixture({ ...fixture, serpentine: !fixture.serpentine })}
            >
              {fixture.serpentine ? "Serpentine wiring" : "Row wiring"}
            </button>
            <p className="mt-1 text-xs text-muted">The picture stays readable. Serpentine only changes the order sent to a zigzag matrix.</p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={`btn ${on ? "btn-primary" : ""}`} onClick={() => useBench.getState().setOn(!on)}>
            <Power size={18} aria-hidden />
            {on ? "On" : "Off"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (showPlay) {
                setStill(false);
                useBench.getState().setPlaying(true);
              } else useBench.getState().setPlaying(false);
            }}
          >
            {showPlay ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
            {showPlay ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            className={`btn ${listen ? "btn-primary" : ""}`}
            onClick={() => {
              setMicNote("");
              useBench.getState().setListen(!listen);
            }}
          >
            {listen ? <Mic size={18} aria-hidden /> : <MicOff size={18} aria-hidden />}
            Mic
          </button>
          <button
            type="button"
            className={`btn ${live ? "btn-live" : ""}`}
            disabled={!lamp}
            onClick={() => {
              setLiveNote("");
              if (!lamp) return;
              useBench.getState().setLive(!live);
            }}
          >
            <Radio size={18} aria-hidden />
            {live ? "Stop stream" : "Stream"}
          </button>
          {meter.show ? (
            <div className="ml-auto flex items-end gap-1" aria-hidden>
              {[meter.bass, meter.mid, meter.high].map((v, i) => (
                <span key={i} className="w-1.5 rounded-sm bg-primary" style={{ height: `${8 + Math.round(v * 22)}px`, opacity: 0.45 + v * 0.55 }} />
              ))}
              <span className="ml-2 text-xs text-muted">{meter.synthetic ? "Pulse" : "Mic"}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">
              <span>Brightness</span>
              <span className="text-fg tabular-nums">{bri}</span>
            </span>
            <input type="range" min={1} max={255} value={bri} aria-label="Brightness" onChange={(e) => useBench.getState().setBri(Number(e.target.value))} />
          </label>
          {fixture.kind === "ribbon" ? (
            <label className="block">
              <span className="field-label">
                <span>LED count</span>
                <span className="text-fg tabular-nums">{fixture.count}</span>
              </span>
              <input type="range" min={8} max={300} value={fixture.count} aria-label="LED count" onChange={(e) => useBench.getState().setLedCount(Number(e.target.value))} />
            </label>
          ) : (
            <p className="self-end text-sm text-muted">{fixture.cols * fixture.rows} pixels in the preview.</p>
          )}
        </div>
        {liveNote ? <p className="mt-2 text-sm text-live">{liveNote}</p> : null}
        {micNote ? <p className="mt-2 text-sm text-muted">{micNote}</p> : null}
      </div>
    </section>
  );
}
