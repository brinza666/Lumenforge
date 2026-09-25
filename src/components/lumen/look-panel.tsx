import { Shuffle } from "lucide-react";
import { Slider, Toggle } from "@/components/lumen/controls";
import { EFFECTS, effectById } from "@/lib/wled/engine";
import { fromHex, paletteName, stopsFor, toHex, type RGB } from "@/lib/wled/palettes";
import { PALETTES } from "@/lib/wled/palettes";
import { useBench } from "@/lib/wled/store";

export function LookPanel() {
  const look = useBench((s) => s.look);
  const names = useBench((s) => s.lamp?.palettes);
  const fx = effectById(look.effect);
  const { stops } = stopsFor(look.paletteId, look.colors, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {EFFECTS.map((effect) => {
          const selected = effect.id === look.effect;
          return (
            <button
              key={effect.id}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                useBench.getState().patchLook({
                  effect: effect.id,
                  name: effect.name,
                  speed: effect.defaults.speed,
                  intensity: effect.defaults.intensity,
                  size: effect.defaults.size,
                  spark: effect.defaults.spark,
                  paletteId: effect.defaults.paletteId,
                  audio: effect.audio,
                })
              }
              className={`min-h-11 rounded-md border px-3 py-2 text-left ${selected ? "border-primary bg-bg-inset" : "border-line bg-bg-raised"}`}
            >
              <span className="block text-sm font-medium">{effect.name}</span>
              <span className="block text-xs text-muted">{effect.audio ? "Sound" : "Light"}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">{fx.blurb}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => useBench.getState().surprise()}>
          <Shuffle size={18} aria-hidden />
          Surprise
        </button>
        <button type="button" className="btn" onClick={() => useBench.getState().useEffectDefaults()}>
          Reset sliders
        </button>
        <button type="button" className="btn" onClick={() => useBench.getState().addLookToMix()}>
          Add to playlist
        </button>
      </div>
      <div className="panel grid gap-2">
        <Slider label="Speed" value={look.speed} onChange={(speed) => useBench.getState().patchLook({ speed })} />
        <Slider label="Intensity" value={look.intensity} onChange={(intensity) => useBench.getState().patchLook({ intensity })} />
        <Slider label="Size" value={look.size} onChange={(size) => useBench.getState().patchLook({ size })} />
        <Slider label="Spark" value={look.spark} onChange={(spark) => useBench.getState().patchLook({ spark })} />
      </div>
      <div className="panel">
        <p className="field-label mb-2">
          <span>Colors</span>
        </p>
        <div className="flex gap-3">
          {(["Fx", "Bg", "Spark"] as const).map((label, i) => (
            <label key={label} className="flex flex-col items-center gap-1 text-xs text-muted">
              <input
                type="color"
                className="h-11 w-11"
                aria-label={label}
                value={toHex(look.colors[i])}
                onChange={(e) => {
                  const colors = [...look.colors] as [RGB, RGB, RGB];
                  colors[i] = fromHex(e.target.value);
                  useBench.getState().patchLook({ colors });
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="field-label mb-2">
          <span>Palette</span>
          <span className="normal-case tracking-normal">{paletteName(look.paletteId, names)}</span>
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PALETTES.filter((p) => p.id <= 70).map((p) => {
            const selected = p.id === look.paletteId;
            const gradient = `linear-gradient(90deg, ${p.stops.map(toHex).join(",")})`;
            return (
              <button
                key={p.id}
                type="button"
                aria-label={paletteName(p.id, names)}
                aria-pressed={selected}
                onClick={() => useBench.getState().patchLook({ paletteId: p.id })}
                className={`h-11 w-11 shrink-0 rounded-md border ${selected ? "border-primary" : "border-line"}`}
                style={{ background: gradient }}
              />
            );
          })}
        </div>
        <div className="mt-2 h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.map(toHex).join(",")})` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Toggle pressed={look.mirror} onClick={() => useBench.getState().patchLook({ mirror: !look.mirror })}>
          Mirror
        </Toggle>
        <Toggle pressed={look.reverse} onClick={() => useBench.getState().patchLook({ reverse: !look.reverse })}>
          Reverse
        </Toggle>
        <Toggle pressed={look.audio} onClick={() => useBench.getState().patchLook({ audio: !look.audio })}>
          Follow sound
        </Toggle>
      </div>
      <p className="text-sm text-muted">
        Cousin on stock firmware: {fx.nativeName}. After you flash the usermod it is stored as {fx.fxName}.
      </p>
    </div>
  );
}
