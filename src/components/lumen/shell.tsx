import { useEffect } from "react";
import { Github } from "lucide-react";
import { FlashPanel } from "@/components/lumen/flash-panel";
import { KeepPanel } from "@/components/lumen/keep-panel";
import { LampPanel } from "@/components/lumen/lamp-panel";
import { LookPanel } from "@/components/lumen/look-panel";
import { PlaylistPanel } from "@/components/lumen/playlist-panel";
import { Stage } from "@/components/lumen/stage";
import { useBench, type Tab } from "@/lib/wled/store";

const REPO = "https://github.com/brinza666/Lumenforge";

const TABS: { id: Tab; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "playlist", label: "Mix" },
  { id: "keep", label: "Keep" },
  { id: "lamp", label: "Lamp" },
  { id: "flash", label: "Code" },
];

const STEPS = [
  { name: "Preview", text: "The fixture at the top is always drawing. Switch between a ribbon and a matrix, including 16×16, without connecting anything." },
  { name: "Look", text: "Every card is a live picture. Colors stay saturated so they still read on a smart LED ribbon. Nothing here strobes." },
  { name: "Mix", text: "Start from a ready mix or generate your own. Holds are long on purpose." },
  { name: "Keep", text: "Save looks, then back up, export, or import the whole bench as a file." },
];

export function Shell() {
  const tab = useBench((s) => s.tab);
  const lamp = useBench((s) => s.lamp);
  const status = useBench((s) => s.lampStatus);

  useEffect(() => {
    void useBench.persist.rehydrate();
  }, []);

  return (
    <main className="page-pad min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none tracking-tight">Lumenforge</p>
          <p className="mt-1 text-sm text-muted">Ribbon and matrix bench</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a className="btn" href={REPO} target="_blank" rel="noreferrer">
            <Github size={18} aria-hidden />
            <span className="hidden sm:inline">Source</span>
            <span className="sr-only sm:hidden">Source on GitHub</span>
          </a>
          <button type="button" className="btn" onClick={() => useBench.getState().setTab("lamp")}>
            <span className={`inline-block h-2 w-2 rounded-full ${status === "online" ? "bg-live" : "bg-line"}`} aria-hidden />
            <span className="max-w-28 truncate sm:max-w-none">
              {status === "online" ? lamp?.info.name || "Lamp" : status === "connecting" ? "Connecting" : "No lamp"}
            </span>
          </button>
        </div>
      </header>
      <Stage />
      <nav className="dock" aria-label="Sections">
        <div className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-3 py-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => useBench.getState().setTab(item.id)}
              className={`btn min-w-0 px-1 text-sm sm:px-3 ${tab === item.id ? "btn-primary" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        {tab === "look" ? <LookPanel /> : null}
        {tab === "playlist" ? <PlaylistPanel /> : null}
        {tab === "keep" ? <KeepPanel /> : null}
        {tab === "lamp" ? <LampPanel /> : null}
        {tab === "flash" ? <FlashPanel /> : null}
      </div>
      <Guide />
    </main>
  );
}

function Guide() {
  return (
    <section className="mx-auto mt-10 grid max-w-5xl gap-4 px-4" aria-labelledby="guide-title">
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <div className="panel grid gap-3">
          <h2 id="guide-title" className="font-display text-3xl leading-none">
            Design the light before the lamp is on
          </h2>
          <p className="text-sm text-pretty text-muted">
            Stock WLED will not store a new algorithm over Wi-Fi. Lumenforge draws the picture here, then offers three ways onto a strip or matrix: stream the pixels, save a cousin of a built-in effect, or compile the original twelve into firmware.
          </p>
          <p className="text-sm">
            Source and issues:{" "}
            <a className="text-link" href={REPO} target="_blank" rel="noreferrer">
              github.com/brinza666/Lumenforge
            </a>
          </p>
        </div>
        <figure className="panel grid gap-3">
          <img src={`${import.meta.env.BASE_URL}og.jpg`} alt="Lumenforge wordmark over a bright filament" className="aspect-video w-full rounded-lg object-cover" />
          <figcaption className="text-sm text-muted">The live fixture above is the real preview. This card is only the share image.</figcaption>
        </figure>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.name} className="panel grid gap-1">
            <p className="text-sm text-muted tabular-nums">0{index + 1}</p>
            <p className="font-medium">{step.name}</p>
            <p className="text-sm text-pretty text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-pretty text-muted">
        This site is https. A phone often cannot reach a lamp that only speaks http, so Stream and Write may fail there. The preview, the mixes, and the downloads still work. On desktop Chrome or Edge, allow local network access and connect again. Your sample file, including the Vse playlists, is already under Lamp.
      </p>
    </section>
  );
}
