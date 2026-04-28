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
        <h1 className="text-3xl font-bold tracking-tight">Playlists</h1>
        <button
          onClick={handleExportPlaylist}
          disabled={files.length === 0}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow hover:bg-primary/90 disabled:opacity-50"
        >
          Export All as .m3u8
        </button>
      </div>
      
      {saveMessage && (
        <div className="p-4 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md">
          {saveMessage}
        </div>
      )}

      {files.length === 0 ? (
        <div className="rounded-md border p-8 text-center bg-card">
          <h3 className="text-lg font-medium text-card-foreground">No audio files loaded</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Open a folder in the Library tab first to generate a playlist.
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-card p-4 space-y-4">
          <h3 className="text-lg font-medium">Generate Playlist from Library</h3>
          <p className="text-sm text-muted-foreground">
            You currently have {files.length} audio file(s) loaded. You can export them into a standard .m3u8 playlist file that can be opened in other media players (like VLC, Winamp, etc.).
          </p>
          <div className="max-h-60 overflow-y-auto border rounded bg-muted/30 p-2">
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
