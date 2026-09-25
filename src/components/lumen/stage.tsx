import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Pause, Play, Power, Radio } from "lucide-react";
import { sketchKindForName } from "@/lib/wled/catalog";
import { postState } from "@/lib/wled/client";
import { effectById, groupPixels, renderForge, renderSketch, SILENT_AUDIO, type AudioLevels, type ForgeParams } from "@/lib/wled/engine";
import type { PlaylistItem } from "@/lib/wled/playlist";
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
    const peak = live.bass > 0.55 && t - lastPeak.t > 0.12;
    if (peak) lastPeak.t = t;
    return { active: true, synthetic: false, peak, ...live };
  }
  if (!active) return SILENT_AUDIO;
  const kick = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)), 14);
  const peak = kick > 0.65 && t - lastPeak.t > 0.2;
  if (peak) lastPeak.t = t;
  return {
    active: true,
    synthetic: true,
    peak,
    bass: kick,
    mid: 0.25 + 0.2 * Math.sin(t * 2.4),
    high: 0.12 + 0.12 * Math.sin(t * 7),
    energy: Math.min(1, 0.2 + kick * 0.8),
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

/** Screen is not an LED. Lift midtones so the preview reads as light; the lamp still gets linear bytes. */
function showByte(v: number, gain: number) {
  const x = Math.min(1, (v * gain) / 255);
  if (x < 0.004) return 0;
  return Math.min(255, Math.round(255 * Math.pow(x, 0.5)));
}

function paintDom(
  wash: HTMLDivElement,
  rail: HTMLDivElement,
  buf: Uint8ClampedArray,
  n: number,
  on: boolean,
  bri: number,
) {
  const gain = (on ? bri : 10) / 255;
  const stops = 36;
  const win = Math.max(1, Math.round(n / stops));
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const center = Math.min(n - 1, Math.round((i / stops) * (n - 1)));
    const a = Math.max(0, center - (win >> 1));
    const b = Math.min(n - 1, a + win - 1);
    let mr = 0;
    let mg = 0;
    let mb = 0;
    for (let j = a; j <= b; j++) {
      const o = j * 3;
      if (buf[o] > mr) mr = buf[o];
      if (buf[o + 1] > mg) mg = buf[o + 1];
      if (buf[o + 2] > mb) mb = buf[o + 2];
    }
    parts.push(`rgb(${showByte(mr, gain)} ${showByte(mg, gain)} ${showByte(mb, gain)})`);
  }
  wash.style.background = `linear-gradient(90deg, ${parts.join(",")})`;
  wash.style.opacity = on ? "1" : "0.28";

  const glow = n <= 96;
  while (rail.childElementCount < n) {
    const el = document.createElement("span");
    el.className = "block h-full min-w-0 flex-1 rounded-full";
    rail.appendChild(el);
  }
  while (rail.childElementCount > n) rail.lastElementChild?.remove();
  for (let i = 0; i < n; i++) {
    const el = rail.children[i] as HTMLElement;
    const o = i * 3;
    const r = showByte(buf[o], gain);
    const g = showByte(buf[o + 1], gain);
    const b = showByte(buf[o + 2], gain);
    el.style.background = `rgb(${r} ${g} ${b})`;
    el.style.boxShadow = glow && r + g + b > 24 ? `0 0 12px 1px rgb(${r} ${g} ${b} / 0.9)` : "none";
  }
}

function renderItem(
  buf: Uint8ClampedArray,
  n: number,
  t: number,
  dt: number,
  audio: Levels,
  item: PlaylistItem | null,
  look: ReturnType<typeof useBench.getState>["look"],
  stage: ReturnType<typeof useBench.getState>["stage"],
) {
  const base = { n, t, dt, audio };
  if (item?.forge) {
    renderForge(item.forge.effect, paramsFrom(base, item.forge), buf);
    return;
  }
  if (item?.lamp) {
    renderSketch(
      sketchKindForName(item.lamp.fxName),
      paramsFrom(base, { ...item.lamp, size: 100, spark: 80 }),
      buf,
    );
    return;
  }
  if (stage.kind === "sketch") {
    const sketch = stage as SketchStage;
    renderSketch(sketchKindForName(sketch.fxName), paramsFrom(base, { ...sketch, size: 100, spark: 70 }), buf);
    return;
  }
  renderForge(look.effect, paramsFrom(base, look), buf);
}

export function Stage() {
  const washRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const look = useBench((s) => s.look);
  const stage = useBench((s) => s.stage);
  const playing = useBench((s) => s.playing);
  const bri = useBench((s) => s.bri);
  const on = useBench((s) => s.on);
  const ledCount = useBench((s) => s.ledCount);
  const listen = useBench((s) => s.listen);
  const playlist = useBench((s) => s.playlist);
  const playlistOn = useBench((s) => s.playlistOn);
  const playlistIndex = useBench((s) => s.playlistIndex);
  const playlistEpoch = useBench((s) => s.playlistEpoch);
  const live = useBench((s) => s.live);
  const lamp = useBench((s) => s.lamp);
  const reduced = usePrefersReducedMotion();
  const [still, setStill] = useState(false);
  const [meter, setMeter] = useState({ bass: 0, mid: 0, high: 0, synthetic: true, show: false });
  const [liveNote, setLiveNote] = useState("");
  const [micNote, setMicNote] = useState("");

  const bag = useRef({
    look,
    stage,
    playing,
    bri,
    on,
    ledCount,
    listen,
    playlist,
    playlistOn,
    playlistIndex,
    playlistEpoch,
    live,
    lamp,
    still,
    user: "",
    password: "",
  });
  bag.current = {
    look,
    stage,
    playing,
    bri,
    on,
    ledCount,
    listen,
    playlist,
    playlistOn,
    playlistIndex,
    playlistEpoch,
    live,
    lamp,
    still,
    user: useBench.getState().user,
    password: useBench.getState().password,
  };

  useEffect(() => {
    setStill(reduced);
  }, [reduced]);

  useEffect(() => {
    const wash = washRef.current;
    const rail = railRef.current;
    if (!wash || !rail) return;
    const buf = new Uint8ClampedArray(600 * 3);
    const buf2 = new Uint8ClampedArray(600 * 3);
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
            setMicNote("Microphone blocked. Audio looks keep a built-in beat.");
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
      const n = s.ledCount;
      renderItem(buf, n, clock.t, dt || 0.016, audio, item ?? null, s.look, s.stage);
      if (item && count > 1 && item.fade > 0) {
        const remain = item.hold - clock.itemT;
        if (remain < item.fade && remain > 0) {
          const u = 1 - remain / item.fade;
          const next = s.playlist.items[(index + 1) % count];
          renderItem(buf2, n, clock.t, dt || 0.016, audio, next, s.look, s.stage);
          const pixels = n * 3;
          for (let i = 0; i < pixels; i++) buf[i] = buf[i] * (1 - u) + buf2[i] * u;
        }
      }
      if (!document.hidden) paintDom(wash, rail, buf, n, s.on, s.bri);

      if (s.live && s.lamp && s.on) {
        if (!liveWas) {
          liveWas = true;
          const seg = (s.lamp.state as { seg?: { fx?: number }[] } | null)?.seg;
          savedFx = typeof seg?.[0]?.fx === "number" ? seg[0].fx : null;
          void postState(s.lamp.origin, { on: true, bri: s.bri }, s.user, s.password).catch(() => undefined);
        }
        if (now >= nextPush) {
          nextPush = now + 125;
          if (!inflight) {
            inflight = true;
            const dst = Math.max(1, s.lamp.info.leds?.count || n);
            const ranges = groupPixels(buf, n, dst, s.bri);
            void postState(s.lamp.origin, { seg: [{ id: 0, i: ranges }] }, s.user, s.password)
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
          void postState(s.lamp.origin, { seg: [{ id: 0, fx: savedFx }] }, s.user, s.password).catch(() => undefined);
        }
      }

      if (now - stamp > 800) {
        stamp = now;
        setLiveNote(s.live ? (sent ? `${sent} frames/s to the lamp` : "Reaching the lamp…") : "");
        sent = 0;
        setMeter({
          bass: audio.bass,
          mid: audio.mid,
          high: audio.high,
          synthetic: audio.synthetic,
          show: audio.active,
        });
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
  let detail = `${fx.blurb} Original — not in stock WLED.`;
  if (item) {
    title = item.name;
    detail = playlist.mode === "lamp" ? "Playlist of firmware effects. Sketch on the bench, real effect on the lamp." : "Playlist of original looks.";
  } else if (stage.kind === "sketch") {
    title = stage.title;
    detail = "Sketch only. The lamp runs the firmware effect, not this drawing.";
  }

  const showPlay = !playing || still;

  return (
    <section className="bg-bg-inset" aria-label="Strip preview">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-3xl leading-none italic text-fg">{title}</h2>
            <p className="mt-1 text-sm text-muted">{detail}</p>
          </div>
          <p className="hidden text-sm text-muted sm:block tabular-nums">{ledCount} lamps</p>
        </div>
        <div ref={washRef} className="h-20 w-full rounded-md bg-bg sm:h-28" aria-hidden />
        <div
          ref={railRef}
          className="flex h-10 w-full items-stretch gap-px sm:h-12"
          role="img"
          aria-label={`Preview of ${title}`}
        />
        <div className="flex flex-wrap items-center gap-2">
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
              } else {
                useBench.getState().setPlaying(false);
              }
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
                <span
                  key={i}
                  className="w-1.5 rounded-sm bg-primary"
                  style={{ height: `${8 + Math.round(v * 22)}px`, opacity: 0.45 + v * 0.55 }}
                />
              ))}
              <span className="ml-2 text-xs text-muted">{meter.synthetic ? "Beat" : "Mic"}</span>
            </div>
          ) : null}
        </div>
        <SliderRow />
        {liveNote ? <p className="text-sm text-live">{liveNote}</p> : null}
        {micNote ? <p className="text-sm text-muted">{micNote}</p> : null}
        {!lamp ? (
          <p className="text-sm text-muted">Stream sends this exact picture to a lamp. Connect one under Lamp — stock firmware cannot store the algorithm itself.</p>
        ) : null}
      </div>
    </section>
  );
}

function SliderRow() {
  const bri = useBench((s) => s.bri);
  const ledCount = useBench((s) => s.ledCount);
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <label className="block">
        <span className="field-label">
          <span>Brightness</span>
          <span className="text-fg tabular-nums">{bri}</span>
        </span>
        <input type="range" min={1} max={255} value={bri} aria-label="Brightness" onChange={(e) => useBench.getState().setBri(Number(e.target.value))} />
      </label>
      <label className="block">
        <span className="field-label">
          <span>Preview length</span>
          <span className="text-fg tabular-nums">{ledCount}</span>
        </span>
        <input
          type="range"
          min={12}
          max={600}
          value={ledCount}
          aria-label="Preview length"
          onChange={(e) => useBench.getState().setLedCount(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
