/** Draw a ribbon or matrix from a row-major RGB buffer. Preview only — lamp bytes stay linear. */
export function paintFixture(
  canvas: HTMLCanvasElement,
  buf: Uint8ClampedArray,
  cols: number,
  rows: number,
  on: boolean,
  bri: number,
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, pw, ph);
  const gain = (on ? bri : 22) / 255;
  const show = (v: number) => {
    const x = Math.min(1, ((v || 0) * gain) / 255);
    if (x <= 0) return 0;
    return Math.min(255, Math.round(255 * Math.pow(x, 0.62)));
  };
  const rgb = (o: number) => `rgb(${show(buf[o] ?? 0)} ${show(buf[o + 1] ?? 0)} ${show(buf[o + 2] ?? 0)})`;

  if (rows <= 1) {
    const g = ctx.createLinearGradient(0, 0, pw, 0);
    const stops = Math.min(32, Math.max(2, cols));
    for (let i = 0; i < stops; i++) {
      const idx = Math.min(cols - 1, Math.round((i / (stops - 1)) * (cols - 1)));
      g.addColorStop(i / (stops - 1), rgb(idx * 3));
    }
    ctx.globalAlpha = on ? 0.45 : 0.2;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, pw, ph * 0.38);
    ctx.globalAlpha = 1;
    const gap = Math.max(1, dpr);
    const ledH = ph * 0.46;
    const top = ph * 0.46;
    const ledW = Math.max(1, (pw - gap * (cols + 1)) / cols);
    const radius = Math.min(ledW, ledH) * 0.5;
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = rgb(i * 3);
      round(ctx, gap + i * (ledW + gap), top, Math.max(1, ledW), ledH, radius);
      ctx.fill();
    }
    return;
  }

  const gap = Math.max(1, dpr);
  const cellW = Math.max(1, (pw - gap * (cols + 1)) / cols);
  const cellH = Math.max(1, (ph - gap * (rows + 1)) / rows);
  const rad = Math.min(cellW, cellH) * 0.22;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = rgb((y * cols + x) * 3);
      round(ctx, gap + x * (cellW + gap), gap + y * (cellH + gap), cellW, cellH, rad);
      ctx.fill();
    }
  }
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
