import { useEffect, useState } from "react";
import { FlashPanel } from "@/components/lumen/flash-panel";
import { LampPanel } from "@/components/lumen/lamp-panel";
import { LookPanel } from "@/components/lumen/look-panel";
import { PlaylistPanel } from "@/components/lumen/playlist-panel";
import { Stage } from "@/components/lumen/stage";
import { useBench, type Tab } from "@/lib/wled/store";

const TABS: { id: Tab; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "playlist", label: "Playlist" },
  { id: "lamp", label: "Lamp" },
  { id: "flash", label: "Flash" },
];

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
    <main className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <div>
          <p className="font-display text-2xl leading-none tracking-tight">Lumenforge</p>
          <p className="mt-1 text-sm text-muted">New looks for WLED</p>
        </div>
        <button type="button" className="btn" onClick={() => useBench.getState().setTab("lamp")}>
          <span className={`mr-1 inline-block h-2 w-2 rounded-full ${status === "online" ? "bg-live" : "bg-line"}`} aria-hidden />
          {status === "online" ? lamp?.info.name || "Lamp" : status === "connecting" ? "Connecting" : "No lamp"}
        </button>
      </header>
      <Stage />
      <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3" aria-label="Sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => useBench.getState().setTab(item.id)}
            className={`btn shrink-0 ${tab === item.id ? "btn-primary" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mx-auto max-w-5xl px-4 pb-16">
        {tab === "look" ? <LookPanel /> : null}
        {tab === "playlist" ? <PlaylistPanel /> : null}
        {tab === "lamp" ? <LampPanel /> : null}
        {tab === "flash" ? <FlashPanel /> : null}
      </div>
    </main>
  );
}
