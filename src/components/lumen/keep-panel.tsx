import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { makeBenchFile, parseBenchFile } from "@/lib/wled/archive";
import { downloadText } from "@/lib/wled/download";
import { effectById } from "@/lib/wled/engine";
import { useBench } from "@/lib/wled/store";

export function KeepPanel() {
  const saved = useBench((s) => s.saved);
  const backups = useBench((s) => s.backups);
  const look = useBench((s) => s.look);
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [backupName, setBackupName] = useState("");

  function exportFile() {
    const state = useBench.getState();
    const file = makeBenchFile({
      name: backupName.trim() || look.name || "Lumenforge bench",
      fixture: state.fixture,
      bri: state.bri,
      look: state.look,
      saved: state.saved,
      playlist: state.playlist,
    });
    downloadText("lumenforge-bench.json", JSON.stringify(file, null, 2), "application/json");
    setNote("Downloaded a bench file. It includes the fixture, this look, saved looks, and the playlist.");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const parsed = parseBenchFile(raw);
      if (!parsed.ok) {
        setNote(parsed.error);
        return;
      }
      useBench.getState().applyBenchFile(parsed.file);
      setNote(`Restored ${parsed.file.name || "bench"} · ${parsed.file.playlist.items.length} playlist steps.`);
    } catch {
      setNote("That file is not JSON.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel grid gap-3">
        <div>
          <p className="font-medium">This look</p>
          <p className="text-sm text-muted">
            {look.name} · {effectById(look.effect).name}. Saving keeps it on this device.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              useBench.getState().saveCurrentLook();
              setNote(`Saved “${useBench.getState().look.name}”.`);
            }}
          >
            Save look
          </button>
        </div>
        {saved.length === 0 ? (
          <p className="text-sm text-muted">No saved looks yet. The preview above is already running — save one when it looks right.</p>
        ) : (
          <ul className="grid gap-2">
            {saved.map((item) => (
              <li key={item.uid} className="flex items-center gap-2">
                <button type="button" className="btn min-w-0 flex-1 justify-start" onClick={() => useBench.getState().applySaved(item.uid)}>
                  <span className="truncate">{item.name}</span>
                </button>
                <button type="button" className="btn" onClick={() => useBench.getState().removeSaved(item.uid)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel grid gap-3">
        <div>
          <p className="font-medium">Backup and restore</p>
          <p className="text-sm text-muted">
            A backup is the fixture (ribbon or matrix), brightness, saved looks, and the current playlist. Nothing is uploaded.
          </p>
        </div>
        <label className="block">
          <span className="field-label">
            <span>Backup name</span>
          </span>
          <input className="field" value={backupName} placeholder="Living room ribbon" aria-label="Backup name" onChange={(e) => setBackupName(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              useBench.getState().rememberBackup(backupName.trim() || undefined);
              setNote("Stored a backup on this device.");
            }}
          >
            Save backup here
          </button>
          <button type="button" className="btn" onClick={exportFile}>
            <Download size={18} aria-hidden />
            Export file
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden />
            Import file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import bench file"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {backups.length === 0 ? (
          <p className="text-sm text-muted">No on-device backups yet. Export if you want a copy you can move to another browser.</p>
        ) : (
          <ul className="grid gap-2">
            {backups.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{slot.name}</p>
                  <p className="text-xs text-muted tabular-nums">{new Date(slot.at).toLocaleString()}</p>
                </div>
                <button type="button" className="btn" onClick={() => { useBench.getState().restoreBackup(slot.id); setNote(`Restored ${slot.name}.`); }}>
                  Restore
                </button>
                <button type="button" className="btn" onClick={() => useBench.getState().removeBackup(slot.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {note ? <p className="text-sm text-live">{note}</p> : null}
      </div>
    </div>
  );
}
