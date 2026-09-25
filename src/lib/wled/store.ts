import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LampSnapshot } from "@/lib/wled/client";
import { EFFECTS, effectById } from "@/lib/wled/engine";
import {
  buildMix,
  defaultLook,
  lookFromEffect,
  mulberry32,
  type ForgeLook,
  type Mix,
  type PlaylistItem,
} from "@/lib/wled/playlist";
import type { RGB } from "@/lib/wled/palettes";

export type Tab = "look" | "playlist" | "lamp" | "flash";

export type SketchStage = {
  kind: "sketch";
  title: string;
  fxName: string;
  speed: number;
  intensity: number;
  paletteId: number;
  colors: [RGB, RGB, RGB];
  reverse: boolean;
  mirror: boolean;
};

type Stage = { kind: "forge" } | SketchStage;

type Bench = {
  tab: Tab;
  look: ForgeLook;
  stage: Stage;
  playing: boolean;
  bri: number;
  on: boolean;
  ledCount: number;
  listen: boolean;
  playlist: Mix;
  playlistIndex: number;
  playlistOn: boolean;
  playlistEpoch: number;
  hostInput: string;
  recentHosts: string[];
  user: string;
  password: string;
  lamp: LampSnapshot | null;
  lampStatus: "idle" | "connecting" | "online" | "error";
  lampError: string;
  live: boolean;
  setTab: (tab: Tab) => void;
  patchLook: (patch: Partial<ForgeLook>) => void;
  surprise: () => void;
  useEffectDefaults: () => void;
  showForge: () => void;
  showSketch: (stage: SketchStage) => void;
  setPlaying: (playing: boolean) => void;
  setBri: (bri: number) => void;
  setOn: (on: boolean) => void;
  setLedCount: (n: number) => void;
  setListen: (listen: boolean) => void;
  setPlaylist: (playlist: Mix) => void;
  setPlaylistOn: (on: boolean) => void;
  focusItem: (index: number) => void;
  setPlaylistIndex: (index: number) => void;
  addLookToMix: () => void;
  setHost: (host: string) => void;
  setUser: (user: string) => void;
  setPassword: (password: string) => void;
  rememberHost: (origin: string) => void;
  setLamp: (lamp: LampSnapshot | null) => void;
  setLampStatus: (status: Bench["lampStatus"], error?: string) => void;
  setLive: (live: boolean) => void;
};

const emptyMix: Mix = {
  name: "Forge mix",
  seed: 14017,
  mode: "forge",
  hold: 8,
  fade: 0.8,
  items: [],
};

export const useBench = create<Bench>()(
  persist(
    (set, get) => ({
      tab: "look",
      look: defaultLook(),
      stage: { kind: "forge" },
      playing: true,
      bri: 180,
      on: true,
      ledCount: 72,
      listen: false,
      playlist: emptyMix,
      playlistIndex: 0,
      playlistOn: false,
      playlistEpoch: 0,
      hostInput: "wled.local",
      recentHosts: [],
      user: "wled",
      password: "",
      lamp: null,
      lampStatus: "idle",
      lampError: "",
      live: false,
      setTab: (tab) => set({ tab }),
      patchLook: (patch) =>
        set({
          look: { ...get().look, ...patch },
          stage: { kind: "forge" },
          playlistOn: false,
        }),
      surprise: () => {
        const rng = mulberry32((Math.random() * 1e9) | 0);
        const fx = EFFECTS[Math.floor(rng() * EFFECTS.length)] ?? effectById("veil");
        set({ look: lookFromEffect(fx, rng), stage: { kind: "forge" }, playlistOn: false });
      },
      useEffectDefaults: () => {
        const fx = effectById(get().look.effect);
        set({
          look: {
            ...get().look,
            speed: fx.defaults.speed,
            intensity: fx.defaults.intensity,
            size: fx.defaults.size,
            spark: fx.defaults.spark,
            paletteId: fx.defaults.paletteId,
            audio: fx.audio,
          },
          stage: { kind: "forge" },
          playlistOn: false,
        });
      },
      showForge: () => set({ stage: { kind: "forge" }, playlistOn: false }),
      showSketch: (stage) => set({ stage, playlistOn: false }),
      setPlaying: (playing) => set({ playing }),
      setBri: (bri) => set({ bri }),
      setOn: (on) => set({ on }),
      setLedCount: (ledCount) => set({ ledCount: Math.max(8, Math.min(600, Math.round(ledCount))) }),
      setListen: (listen) => set({ listen }),
      setPlaylist: (playlist) =>
        set({ playlist, playlistIndex: 0, playlistEpoch: get().playlistEpoch + 1, playlistOn: playlist.items.length > 0 }),
      setPlaylistOn: (playlistOn) => set({ playlistOn }),
      focusItem: (index) =>
        set({
          playlistIndex: index,
          playlistEpoch: get().playlistEpoch + 1,
          playlistOn: true,
          stage: { kind: "forge" },
        }),
      setPlaylistIndex: (playlistIndex) => set({ playlistIndex }),
      addLookToMix: () => {
        const look = { ...get().look, uid: `l${Date.now().toString(36)}` };
        const item: PlaylistItem = {
          uid: look.uid,
          name: look.name,
          hold: get().playlist.hold,
          fade: get().playlist.fade,
          forge: look,
        };
        const items = [...get().playlist.items, item].slice(0, 100);
        set({
          playlist: { ...get().playlist, mode: "forge", items },
          tab: "playlist",
        });
      },
      setHost: (hostInput) => set({ hostInput }),
      setUser: (user) => set({ user }),
      setPassword: (password) => set({ password }),
      rememberHost: (origin) => {
        const recent = [origin, ...get().recentHosts.filter((h) => h !== origin)].slice(0, 6);
        set({ recentHosts: recent, hostInput: origin.replace(/^https?:\/\//, "") });
      },
      setLamp: (lamp) => set({ lamp }),
      setLampStatus: (lampStatus, lampError = "") => set({ lampStatus, lampError }),
      setLive: (live) => set({ live }),
    }),
    {
      name: "lumenforge",
      skipHydration: true,
      partialize: (s) => ({
        tab: s.tab,
        look: s.look,
        stage: s.stage,
        bri: s.bri,
        on: s.on,
        ledCount: s.ledCount,
        playlist: s.playlist,
        hostInput: s.hostInput,
        recentHosts: s.recentHosts,
        user: s.user,
      }),
    },
  ),
);

export function activeItem(state: Pick<Bench, "playlist" | "playlistOn" | "playlistIndex">): PlaylistItem | null {
  if (!state.playlistOn || state.playlist.items.length === 0) return null;
  const i = ((state.playlistIndex % state.playlist.items.length) + state.playlist.items.length) % state.playlist.items.length;
  return state.playlist.items[i] ?? null;
}
