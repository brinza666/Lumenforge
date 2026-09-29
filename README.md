# Lumenforge

Lumenforge is a lighting bench for WLED. The picture at the top is a live preview, and it runs even when no lamp is connected.

Choose a ribbon (30, 60, 100, 144, or any count up to 300) or a matrix (8×8, 16×16, 16×8, 8×32, 32×8). Serpentine wiring only changes the order sent to a zigzag panel. The preview stays a readable grid.

The original twelve looks still compile into the usermod. Ten slower looks are preview and stream only: Drift, Bloom, Orbit, Spiral, Halo, Lantern, Current, Garden, Linen, and Sail. Colors are lifted into a bright range so they still read on a smart LED ribbon. Speeds are capped. There is no strobe.

Ready mixes play immediately. You can generate a mix, then stream it or write cousins to a lamp. Keep saves a look on this device, or exports and imports a bench file (fixture, looks, and playlist). Nothing is uploaded.

The same bench is the site in this repo: [brinza666.github.io/Lumenforge](https://brinza666.github.io/Lumenforge/).

Stock WLED cannot store a new algorithm over Wi-Fi. Stream pixels while the page is open, save a cousin of a built-in effect, or download the usermod. The new looks are preview and stream only. The original twelve still compile into firmware.

A phone on https often cannot reach a lamp that only speaks http. The preview, the mixes, the backups, and the downloads still work. On desktop Chrome or Edge, allow local network access and try again.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port 8080. `npm run pages` rebuilds the static site into `docs/`.

Do not commit `.env` files, screenshots, or local agent state. Lamp passwords stay in the browser and are not part of a bench file.
