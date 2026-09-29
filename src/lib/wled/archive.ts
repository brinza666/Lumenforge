import { z } from "zod";
import type { Fixture } from "./fixture.ts";
import type { ForgeLook, Mix } from "./playlist.ts";

const rgb = z.tuple([z.number(), z.number(), z.number()]);

const lookSchema = z.object({
  uid: z.string(),
  name: z.string(),
  effect: z.string(),
  speed: z.number(),
  intensity: z.number(),
  size: z.number(),
  spark: z.number(),
  paletteId: z.number(),
  colors: z.tuple([rgb, rgb, rgb]),
  reverse: z.boolean(),
  mirror: z.boolean(),
  audio: z.boolean(),
});

const lampSchema = z.object({
  fxName: z.string(),
  speed: z.number(),
  intensity: z.number(),
  paletteId: z.number(),
  colors: z.tuple([rgb, rgb, rgb]),
  reverse: z.boolean(),
  mirror: z.boolean(),
});

const itemSchema = z.object({
  uid: z.string(),
  name: z.string(),
  hold: z.number(),
  fade: z.number(),
  forge: lookSchema.optional(),
  lamp: lampSchema.optional(),
});

const fixtureSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ribbon"), count: z.number().int().min(8).max(300) }),
  z.object({
    kind: z.literal("matrix"),
    cols: z.number().int().min(2).max(32),
    rows: z.number().int().min(2).max(32),
    serpentine: z.boolean(),
  }),
]);

const mixSchema = z.object({
  name: z.string(),
  seed: z.number(),
  mode: z.enum(["forge", "lamp"]),
  hold: z.number(),
  fade: z.number(),
  items: z.array(itemSchema).max(100),
});

export const benchFileSchema = z.object({
  app: z.literal("lumenforge"),
  version: z.literal(2),
  exportedAt: z.string().optional(),
  name: z.string().max(80).optional(),
  fixture: fixtureSchema,
  bri: z.number().min(1).max(255),
  look: lookSchema,
  saved: z.array(lookSchema).max(40).optional(),
  playlist: mixSchema,
});

export type BenchFile = z.infer<typeof benchFileSchema>;

export type BackupSlot = {
  id: string;
  name: string;
  at: string;
  file: BenchFile;
};

export function parseBenchFile(raw: unknown): { ok: true; file: BenchFile } | { ok: false; error: string } {
  const parsed = benchFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(".") || "file"}: ${issue.message}` : "That file is not a Lumenforge backup." };
  }
  return { ok: true, file: parsed.data };
}

export function makeBenchFile(input: {
  name?: string;
  fixture: Fixture;
  bri: number;
  look: ForgeLook;
  saved: ForgeLook[];
  playlist: Mix;
}): BenchFile {
  return {
    app: "lumenforge",
    version: 2,
    exportedAt: new Date().toISOString(),
    name: input.name,
    fixture: input.fixture,
    bri: input.bri,
    look: input.look,
    saved: input.saved,
    playlist: input.playlist,
  };
}
