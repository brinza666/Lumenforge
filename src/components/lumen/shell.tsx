import { useEffect, useState } from "react";
import { Github } from "lucide-react";
import { FlashPanel } from "@/components/lumen/flash-panel";
import { LampPanel } from "@/components/lumen/lamp-panel";
import { LookPanel } from "@/components/lumen/look-panel";
import { PlaylistPanel } from "@/components/lumen/playlist-panel";
import { Stage } from "@/components/lumen/stage";
import { useBench, type Tab } from "@/lib/wled/store";

const REPO = "https://github.com/brinza666/Lumenforge";

const TABS: { id: Tab; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "playlist", label: "Playlist" },
  { id: "lamp", label: "Lamp" },
  { id: "flash", label: "Flash" },
];

const STEPS = [
  { name: "Look", text: "Pick Veil, Tide, Emberline, and the rest, or hit Surprise. The strip above is the live picture." },
  { name: "Playlist", text: "Generate 10 to 100 looks. Play the mix here, then save it as stock cousins or as LF effects." },
  { name: "Lamp", text: "Type the lamp address. Stream paints it while this page stays open. Cousins let the lamp play alone." },
  { name: "Flash", text: "Download a WLED 0.15 usermod, or an ARTI-FX script for MoonModules. Phones cannot USB-flash." },
];

const SHOTS = [
  { file: "gallery/ember.jpg", title: "Emberline", caption: "A hot edge on a dark rail." },
  { file: "gallery/veil.jpg", title: "Veil", caption: "Slow sheets of sage light." },
  { file: "gallery/comet.jpg", title: "Comet", caption: "One bright head and a short tail." },
];

function asset(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

export function Shell() {
  const tab = useBench((s) => s.tab);
  const lamp = useBench((s) => s.lamp);
  const status = useBench((s) => s.lampStatus);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let live = true;
    const finish = () => {
      if (live) setHydrated(true);
    };
    const unsub = useBench.persist.onFinishHydration(finish);
    if (useBench.persist.hasHydrated()) finish();
    else useBench.persist.rehydrate();
    return () => {
      live = false;
      unsub();
    };
  }, []);

  if (!hydrated) {
    return (
      <main className="min-h-dvh bg-bg px-4 py-6 text-fg">
        <p className="font-display text-2xl leading-none tracking-tight">Lumenforge</p>
      </main>
    );
  }

  return (
    <main className="page-pad min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none tracking-tight">Lumenforge</p>
          <p className="mt-1 text-sm text-muted">New looks for WLED</p>
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
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? "page" : undefined}
              onClick={() => useBench.getState().setTab(item.id)}
              className={`btn shrink-0 flex-1 sm:flex-none ${tab === item.id ? "btn-primary" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        {tab === "look" ? <LookPanel /> : null}
        {tab === "playlist" ? <PlaylistPanel /> : null}
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
          <h2 id="guide-title" className="font-display text-3xl italic leading-none">
            A bench, not a preset pack
          </h2>
          <p className="text-sm text-muted">
            Stock WLED will not store a new algorithm over Wi-Fi. Lumenforge previews twelve original looks in the browser, then gives you three honest ways to get light onto a strip: stream the pixels, save a cousin of a built-in effect, or compile the look into firmware.
          </p>
          <p className="text-sm">
            Source and issues:{" "}
            <a className="text-link" href={REPO} target="_blank" rel="noreferrer">
              github.com/brinza666/Lumenforge
            </a>
          </p>
        </div>
        <figure className="panel grid gap-3">
          <img src={asset("og.jpg")} alt="Lumenforge wordmark over a strip that fades from amber to sage" className="aspect-video w-full rounded-md object-cover" />
          <figcaption className="text-sm text-muted">The same strip the page is drawing, above.</figcaption>
        </figure>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.name} className="panel grid gap-1">
            <p className="text-sm text-muted tabular-nums">0{index + 1}</p>
            <p className="font-medium">{step.name}</p>
            <p className="text-sm text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
      <ul className="grid gap-3 sm:grid-cols-3">
        {SHOTS.map((shot) => (
          <li key={shot.file}>
            <figure className="grid gap-2">
              <img src={asset(shot.file)} alt="" className="aspect-[3/2] w-full rounded-md object-cover" />
              <figcaption>
                <p className="text-sm font-medium">{shot.title}</p>
                <p className="text-sm text-muted">{shot.caption}</p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        This site is https. A phone often cannot reach a lamp that only speaks http, so Stream and Write may fail there. The preview, the playlist, and the firmware downloads still work. On desktop Chrome or Edge, allow local network access and connect again. Your sample file, including the Vse playlists, is already under Lamp.
      </p>
    </section>
  );
}