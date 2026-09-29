import { useEffect, useRef, useState } from "react";
import { EFFECTS, effectById, renderForge, SILENT_AUDIO } from "@/lib/wled/engine";
import { paintFixture } from "@/lib/wled/preview-draw";
import { useBench } from "@/lib/wled/store";

const COLS = 8;
const ROWS = 8;

export function EffectBoard() {
  const selected = useBench((s) => s.look.effect);
  const [query, setQuery] = useState("");
  const nodes = useRef(new Map<string, HTMLCanvasElement>());
  const list = EFFECTS.filter((fx) => fx.name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const buf = new Uint8ClampedArray(COLS * ROWS * 3);
    let raf = 0;
    let last = performance.now();
    let t = 0.4;
    const paint = (now: number, advance: boolean) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (advance) t += dt;
      if (document.hidden) return;
      for (const fx of EFFECTS) {
        const canvas = nodes.current.get(fx.id);
        if (!canvas || canvas.clientWidth < 2) continue;
        renderForge(
          fx.id,
          {
            n: COLS * ROWS,
            cols: COLS,
            rows: ROWS,
            t,
            dt,
            speed: fx.defaults.speed,
            intensity: fx.defaults.intensity,
            size: fx.defaults.size,
            spark: Math.min(fx.defaults.spark, 50),
            colors: [
              [255, 196, 64],
              [255, 84, 128],
              [72, 220, 255],
            ],
            paletteId: fx.defaults.paletteId,
            mirror: false,
            reverse: false,
            audio: SILENT_AUDIO,
          },
          buf,
          "thumb",
        );
        paintFixture(canvas, buf, COLS, ROWS, true, 230);
      }
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = (now: number) => {
      paint(now, true);
      raf = requestAnimationFrame(loop);
    };
    if (reduced) {
      t = 1.4;
      raf = requestAnimationFrame((now) => paint(now, false));
      return () => cancelAnimationFrame(raf);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="grid gap-3">
      <label className="block">
        <span className="field-label">
          <span>Looks</span>
          <span className="normal-case tracking-normal">{list.length}</span>
        </span>
        <input
          className="field"
          value={query}
          placeholder="Find a look"
          aria-label="Find a look"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((fx) => {
          const on = fx.id === selected;
          return (
            <button
              key={fx.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                useBench.getState().patchLook({
                  effect: fx.id,
                  name: fx.name,
                  speed: fx.defaults.speed,
                  intensity: fx.defaults.intensity,
                  size: fx.defaults.size,
                  spark: fx.defaults.spark,
                  paletteId: fx.defaults.paletteId,
                  audio: fx.audio,
                })
              }
              className={`overflow-hidden rounded-md border text-left ${on ? "border-primary bg-bg-inset" : "border-line bg-bg-raised"}`}
            >
              <canvas
                ref={(node) => {
                  if (node) nodes.current.set(fx.id, node);
                  else nodes.current.delete(fx.id);
                }}
                className="aspect-square w-full"
                aria-hidden
              />
              <span className="block px-2 py-2">
                <span className="block text-sm font-medium">{fx.name}</span>
                <span className="block text-xs text-muted">{fx.firmware === false ? "Stream" : "Usermod"}{fx.audio ? " · sound" : ""}</span>
              </span>
            </button>
          );
        })}
      </div>
      {list.length === 0 ? <p className="text-sm text-muted">No look matches that name.</p> : null}
      <p className="text-sm text-muted">{effectById(selected).blurb} Every card above is a live preview, lamp or not.</p>
    </div>
  );
}
