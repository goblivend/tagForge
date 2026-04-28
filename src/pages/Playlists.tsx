import { useState } from "react";
import { useAppStore } from "../store";

export default function Playlists() {
  const { files, folderHandle } = useAppStore();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleExportPlaylist = async () => {
    if (!folderHandle || files.length === 0) {
      alert("No files in library to export.");
      return;
    }

    try {
      // @ts-ignore
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: 'playlist.m3u8',
        types: [{
          description: 'M3U8 Playlist',
          accept: { 'audio/x-mpegurl': ['.m3u8'] },
        }],
      });

      let m3u8Content = "#EXTM3U\n";
      for (const file of files) {
        // Without full metadata duration here, we use -1
        // We'd ideally read tags, but for basic playlist relative paths work
        m3u8Content += `#EXTINF:-1,${file.name.replace('.mp3', '')}\n`;
        m3u8Content += `${file.path}\n`;
      }

      // @ts-ignore
      const writable = await fileHandle.createWritable();
      await writable.write(m3u8Content);
      await writable.close();

      setSaveMessage("Playlist exported successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert("Failed to save playlist.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
          <p className="mt-1 text-sm text-muted-foreground">Export the tracks currently loaded in your library as a portable playlist.</p>
        </div>
        <button
          onClick={handleExportPlaylist}
          disabled={files.length === 0}
          className="rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 font-semibold text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)] disabled:opacity-50"
        >
          Export All as .m3u8
        </button>
      </div>
      
      {saveMessage && (
        <div className="status-success rounded-xl border border-border px-4 py-3 shadow-[var(--panel-shadow)]">
          {saveMessage}
        </div>
      )}

      {files.length === 0 ? (
        <div className="panel flex flex-col items-center rounded-xl p-8 text-center">
          <h3 className="text-lg font-medium text-card-foreground">No audio files loaded</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Open a folder in the Library tab first to generate a playlist.
          </p>
        </div>
      ) : (
        <div className="panel space-y-4 rounded-xl p-5">
          <h3 className="text-lg font-medium">Generate Playlist from Library</h3>
          <p className="text-sm text-muted-foreground">
            You currently have {files.length} audio file(s) loaded. You can export them into a standard .m3u8 playlist file that can be opened in other media players (like VLC, Winamp, etc.).
          </p>
          <div className="max-h-60 overflow-y-auto rounded-xl border border-border/80 bg-background/80 p-3 shadow-[var(--panel-shadow)]">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
              #EXTM3U{"\n"}
              {files.slice(0, 5).map(f => `#EXTINF:-1,${f.name.replace('.mp3', '')}\n${f.path}\n`).join('')}
              {files.length > 5 ? `... and ${files.length - 5} more items` : ''}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
