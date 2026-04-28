import { useState } from "react";
import { useAppStore } from "../store";

export default function Settings() {
  const { filenamePresets, addFilenamePreset, removeFilenamePreset, updateFilenamePreset } = useAppStore();
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetFormat, setNewPresetFormat] = useState("");

  const handleAddPreset = () => {
    if (!newPresetName.trim() || !newPresetFormat.trim()) return;
    const newId = `preset-${Date.now()}`;
    addFilenamePreset({
      id: newId,
      name: newPresetName.trim(),
      format: newPresetFormat.trim()
    });
    setNewPresetName("");
    setNewPresetFormat("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tune rename presets and keep your library workflow consistent.</p>
        </div>
      </div>
      <div className="panel max-w-xl space-y-4 rounded-xl p-6">
        <div>
          <h3 className="mb-4 border-b border-border/70 pb-2 text-lg font-medium">Naming Presets</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure how your files should be renamed when using the quick rename feature.
            Use variables like <code className="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5">{"{artist}"}</code>, <code className="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5">{"{title}"}</code>, <code className="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5">{"{album}"}</code>, <code className="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5">{"{genre}"}</code>, <code className="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5">{"{year}"}</code> or <code className="rounded-md border border-border/60 bg-muted/70 px-1.5 py-0.5">{"{date}"}</code>.
          </p>

          <div className="space-y-6">
            {filenamePresets.map(preset => (
              <div key={preset.id} className="group relative rounded-xl border border-border/80 bg-background/75 p-4 shadow-[var(--panel-shadow)]">
                <div className="space-y-3">
                  <div className="flex gap-3 items-center">
                    <input 
                      type="text" 
                      value={preset.name}
                      onChange={(e) => updateFilenamePreset(preset.id, { name: e.target.value })}
                      className="flex h-10 w-1/3 rounded-xl px-3 py-1 text-sm"
                      placeholder="Preset Name"
                    />
                    <input 
                      type="text" 
                      value={preset.format}
                      onChange={(e) => updateFilenamePreset(preset.id, { format: e.target.value })}
                      className="flex h-10 flex-1 rounded-xl px-3 py-1 text-sm font-mono"
                      placeholder="{artist} - {title}"
                    />
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Preview: </span>
                    <span className="mt-1 block text-sm font-mono" style={{ color: "hsl(var(--success-color))" }}>
                      {preset.format
                        .replace(/\{artist\}/gi, 'The Beatles')
                        .replace(/\{title\}/gi, 'Hey Jude')
                        .replace(/\{album\}/gi, 'Singles')
                        .replace(/\{genre\}/gi, 'Rock')
                        .replace(/\{date\}/gi, '1968-08-26')
                        .replace(/\{year\}/gi, '1968')}
                      .mp3
                    </span>
                  </div>
                </div>
                {filenamePresets.length > 1 && (
                   <button 
                     onClick={() => removeFilenamePreset(preset.id)}
                     className="absolute right-2 top-2 rounded-lg bg-red-500/10 p-1.5 text-red-500 opacity-0 transition-opacity hover:bg-red-500/20 group-hover:opacity-100"
                     title="Remove preset"
                   >
                     ✕
                   </button>
                )}
              </div>
            ))}

            <div className="pt-4 mt-2 border-t border-dashed">
              <h4 className="text-sm font-medium mb-3">Add Custom Preset</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="flex h-10 w-1/3 rounded-xl px-3 py-2 text-sm"
                  placeholder="e.g. Podcasts"
                />
                <input 
                  type="text" 
                  value={newPresetFormat}
                  onChange={(e) => setNewPresetFormat(e.target.value)}
                  className="flex h-10 flex-1 rounded-xl px-3 py-2 text-sm font-mono"
                  placeholder="{date} - {title}"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddPreset()
                  }}
                />
                <button 
                  onClick={handleAddPreset}
                  disabled={!newPresetName.trim() || !newPresetFormat.trim()}
                  className="rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 font-semibold text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)] disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
