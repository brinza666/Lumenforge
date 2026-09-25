# Lumenforge

Lumenforge is a bench for new WLED looks. The strip at the top is a live preview of effects that are not in stock firmware.

The same bench is the site in this repo: [brinza666.github.io/Lumenforge](https://brinza666.github.io/Lumenforge/). Preview, Surprise, playlists, the sample presets (including Vse), firmware downloads, and lamp control all run in the browser. A phone on https often cannot reach a lamp on plain http; design, playlists, and the firmware files still work. On desktop Chrome or Edge, allow local network access for the site and try again.

Stock WLED cannot store a new algorithm over Wi-Fi. Stream pixels while the page is open, save cousin presets of built-in effects, or export a WLED 0.15 usermod and MoonModules ARTI-FX scripts.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port 8080. `npm run pages` rebuilds the static site into `docs/`.
