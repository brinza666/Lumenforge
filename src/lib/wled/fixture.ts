export type Fixture =
  | { kind: "ribbon"; count: number }
  | { kind: "matrix"; cols: number; rows: number; serpentine: boolean };

export const MATRIX_PRESETS = [
  { cols: 8, rows: 8, label: "8×8" },
  { cols: 16, rows: 16, label: "16×16" },
  { cols: 16, rows: 8, label: "16×8" },
  { cols: 8, rows: 32, label: "8×32" },
  { cols: 32, rows: 8, label: "32×8" },
] as const;

export const RIBBON_PRESETS = [30, 60, 100, 144] as const;

export function fixtureCount(fixture: Fixture): number {
  return fixture.kind === "ribbon" ? fixture.count : fixture.cols * fixture.rows;
}

export function fixtureLabel(fixture: Fixture): string {
  if (fixture.kind === "ribbon") return `Ribbon · ${fixture.count}`;
  return `Matrix · ${fixture.cols}×${fixture.rows}`;
}

export function defaultFixture(): Fixture {
  return { kind: "ribbon", count: 60 };
}
