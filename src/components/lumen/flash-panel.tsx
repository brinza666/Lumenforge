import { Download } from "lucide-react";
import { buildAllUsermod, buildArti, buildUsermod, OVERRIDE_INI } from "@/lib/wled/codegen";
import { downloadText } from "@/lib/wled/download";
import { effectById } from "@/lib/wled/engine";
import { useBench } from "@/lib/wled/store";

export function FlashPanel() {
  const effect = useBench((s) => s.look.effect);
  const fx = effectById(effect);
  const arti = buildArti(effect);

  return (
    <div className="flex flex-col gap-4">
      <div className="panel grid gap-2">
        <p className="font-medium">What can actually land on the lamp</p>
        <ul className="grid gap-2 text-sm text-muted">
          <li>
            <span className="text-fg">Stream.</span> The browser paints every frame and ships colors. Exact, and only while this page stays open. Stock firmware never learns the algorithm.
          </li>
          <li>
            <span className="text-fg">Cousin preset.</span> A built-in effect with your speed, intensity, and palette. The lamp plays it alone. It is a relative, not a copy.
          </li>
          <li>
            <span className="text-fg">Usermod.</span> Twelve original effects compiled into WLED. After one flash they show up as LF Veil, LF Tide, and the rest, and playlists can call them by name.
          </li>
          <li>
            <span className="text-fg">ARTI-FX.</span> A small script for MoonModules builds only. Some looks port closely. Particles do not.
          </li>
        </ul>
      </div>

      <div className="panel grid gap-3">
        <p className="font-medium">Firmware kit</p>
        <p className="text-sm text-muted">
          WLED 0.15 adds effects with <span className="text-fg">strip.addEffect</span> from a usermod. Nothing here is a finished .bin — the ESP cannot compile C++ in the browser. Build it in PlatformIO, then flash.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadText("usermod.cpp", buildAllUsermod(), "text/x-c++src")}
          >
            <Download size={18} aria-hidden />
            All 12 effects
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => downloadText("usermod.cpp", buildUsermod([effect]), "text/x-c++src")}
          >
            Just {fx.fxName}
          </button>
          <button type="button" className="btn" onClick={() => downloadText("platformio_override.ini", OVERRIDE_INI)}>
            platformio override
          </button>
        </div>
        <p className="text-sm text-muted">
          Put <span className="text-fg">usermod.cpp</span> in <span className="text-fg">usermods/lumenforge/</span> inside a WLED 0.15 tree. The header of the file has the ini line. Audioreactive can stay in the same list:{" "}
          <span className="text-fg">custom_usermods = audioreactive lumenforge</span>.
        </p>
      </div>

      <div className="panel grid gap-3">
        <p className="font-medium">ARTI-FX for {fx.fxName}</p>
        <p className="text-sm text-muted">
          {arti.fidelity === "close"
            ? "This script is a close port. On a MoonModules build, name the segment exactly the same as the file (without .wled) and pick the ARTI-FX effect."
            : arti.fidelity === "approx"
              ? "ARTI-FX can only approximate this one. The C++ usermod is the accurate version."
              : "ARTI-FX cannot express this look. Use the usermod."}
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => downloadText(arti.filename.replace(/\s+/g, "-"), arti.code, "text/plain")}
        >
          <Download size={18} aria-hidden />
          {arti.filename}
        </button>
        <pre className="max-h-48 overflow-auto rounded-md bg-bg-inset p-3 text-xs leading-relaxed text-muted">{arti.code}</pre>
      </div>

      <div className="panel grid gap-2 text-sm">
        <p className="font-medium">Web flasher</p>
        <p className="text-muted">
          <a className="text-fg underline decoration-primary underline-offset-4" href="https://wled-install.github.io/" target="_blank" rel="noreferrer">
            wled-install.github.io
          </a>{" "}
          and the stock installer at{" "}
          <a className="text-fg underline decoration-primary underline-offset-4" href="https://install.wled.me/" target="_blank" rel="noreferrer">
            install.wled.me
          </a>{" "}
          use ESP Web Tools. The page is https, the browser is desktop Chrome, Edge, or a Firefox build with WebSerial, and a USB cable talks to the board. A manifest lists a chip family and the binary parts with flash offsets. The button picks the build that matches the chip it detects. Safari and phones cannot do this.
        </p>
        <p className="text-muted">
          MoonModules (more effects, ARTI-FX, a heavier audio build) lives at{" "}
          <a className="text-fg underline decoration-primary underline-offset-4" href="https://mm.kno.wled.ge/" target="_blank" rel="noreferrer">
            mm.kno.wled.ge
          </a>
          . Official notes on adding effects:{" "}
          <a className="text-fg underline decoration-primary underline-offset-4" href="https://kno.wled.ge/advanced/custom-features/" target="_blank" rel="noreferrer">
            custom features
          </a>
          .
        </p>
        <pre className="overflow-auto rounded-md bg-bg-inset p-3 text-xs text-muted">{`{
  "name": "WLED Lumenforge",
  "new_install_prompt_erase": false,
  "builds": [
    {
      "chipFamily": "ESP32",
      "parts": [{ "path": "WLED_ESP32.bin", "offset": 0 }]
    }
  ]
}`}</pre>
        <p className="text-muted">Offsets in the manifest are decimal. A merged image usually starts at 0. Split images follow the bootloader, partition table, and app offsets from your build log.</p>
      </div>
    </div>
  );
}
