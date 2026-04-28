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
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>
      <div className="rounded-md border p-6 bg-card space-y-4 max-w-xl">
        <div>
          <h3 className="text-lg font-medium border-b pb-2 mb-4">Naming Presets</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure how your files should be renamed when using the quick rename feature.
            Use variables like <code className="bg-muted px-1 rounded">{"{artist}"}</code>, <code className="bg-muted px-1 rounded">{"{title}"}</code>, <code className="bg-muted px-1 rounded">{"{album}"}</code>, <code className="bg-muted px-1 rounded">{"{genre}"}</code>, <code className="bg-muted px-1 rounded">{"{year}"}</code> or <code className="bg-muted px-1 rounded">{"{date}"}</code>.
          </p>

          <div className="space-y-6">
            {filenamePresets.map(preset => (
              <div key={preset.id} className="p-4 bg-muted/30 border rounded-md relative group">
                <div className="space-y-3">
                  <div className="flex gap-3 items-center">
                    <input 
                      type="text" 
                      value={preset.name}
                      onChange={(e) => updateFilenamePreset(preset.id, { name: e.target.value })}
                      className="w-1/3 flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                      placeholder="Preset Name"
                    />
                    <input 
                      type="text" 
                      value={preset.format}
                      onChange={(e) => updateFilenamePreset(preset.id, { format: e.target.value })}
                      className="flex-1 flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm font-mono"
                      placeholder="{artist} - {title}"
                    />
                  </div>
                  <div className="bg-background/50 px-3 py-2 rounded-md border border-muted/50">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Preview: </span>
                    <span className="text-sm block mt-1 font-mono text-green-600 dark:text-green-400">
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
                     className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  className="w-1/3 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  placeholder="e.g. Podcasts"
                />
                <input 
                  type="text" 
                  value={newPresetFormat}
                  onChange={(e) => setNewPresetFormat(e.target.value)}
                  className="flex-1 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm font-mono"
                  placeholder="{date} - {title}"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddPreset()
                  }}
                />
                <button 
                  onClick={handleAddPreset}
                  disabled={!newPresetName.trim() || !newPresetFormat.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
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
