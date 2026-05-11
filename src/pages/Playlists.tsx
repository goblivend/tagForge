import { useState, useEffect } from "react";
import { useAppStore, FileEntry } from "../store";
import { findPlaylistsInDirectory, getFileFromEntry } from "../services/fsAccess";
import { Trash2 } from "lucide-react";

export default function Playlists() {
  const { files, folderHandle } = useAppStore();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Array<FileEntry & { trackCount: number }>>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  // Load playlists from disk when folder changes
  useEffect(() => {
    const loadPlaylists = async () => {
      if (!folderHandle) {
        setPlaylists([]);
        return;
      }

      setIsLoadingPlaylists(true);
      try {
        const foundPlaylists = await findPlaylistsInDirectory(folderHandle);

        // Parse each playlist to count tracks
        const playlistsWithCounts = await Promise.all(
          foundPlaylists.map(async (playlist) => {
            try {
              const playlistFile = await getFileFromEntry(playlist);
              const content = await playlistFile.text();
              // Count non-comment lines as tracks
              const trackCount = content
                .split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .length;
              return { ...playlist, trackCount };
            } catch (error) {
              console.error('Failed to parse playlist', playlist.name, error);
              return { ...playlist, trackCount: 0 };
            }
          })
        );

        setPlaylists(playlistsWithCounts);
      } catch (error) {
        console.error('Failed to load playlists', error);
      } finally {
        setIsLoadingPlaylists(false);
      }
    };

    loadPlaylists();
  }, [folderHandle]);

  const handleDeletePlaylist = async (playlist: FileEntry) => {
    if (!playlist.handle) return;

    if (!confirm(`Delete playlist "${playlist.name}"?`)) return;

    try {
      // @ts-ignore
      await playlist.handle.remove?.();
      setPlaylists(prev => prev.filter(p => p.path !== playlist.path));
    } catch (error) {
      console.error('Failed to delete playlist', error);
      alert('Failed to delete playlist');
    }
  };

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
          <p className="mt-1 text-sm text-muted-foreground">Browse and manage playlists in your music folder.</p>
        </div>
      </div>

      {saveMessage && (
        <div className="status-success rounded-xl border border-border px-4 py-3 shadow-[var(--panel-shadow)]">
          {saveMessage}
        </div>
      )}

      {/* Existing Playlists Section */}
      <div className="panel rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Existing Playlists</h2>
        {!folderHandle ? (
          <p className="text-sm text-muted-foreground">Open a folder in the Library tab to see playlists.</p>
        ) : isLoadingPlaylists ? (
          <p className="text-sm text-muted-foreground">Loading playlists...</p>
        ) : playlists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No playlists found in this folder.</p>
        ) : (
          <div className="space-y-2">
            {playlists.map(playlist => (
              <div
                key={playlist.path}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{playlist.name}</p>
                  <p className="text-xs text-muted-foreground">{playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => handleDeletePlaylist(playlist)}
                  className="ml-4 shrink-0 rounded-lg border border-border/70 bg-red-500/10 p-2 text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                  title="Delete playlist"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Playlist Section */}
      <div className="panel rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Export Playlist from Library</h2>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Open a folder in the Library tab first to export the loaded tracks as a playlist.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              You currently have {files.length} audio file(s) loaded. Export them into a standard .m3u8 playlist file that can be opened in other media players.
            </p>
            <div className="max-h-60 overflow-y-auto rounded-xl border border-border/80 bg-background/80 p-3 shadow-[var(--panel-shadow)] mb-4">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                #EXTM3U{"\n"}
                {files.slice(0, 5).map(f => `#EXTINF:-1,${f.name.replace(/\.(mp3|m4a|m4b|m4p|flac|wav|ogg|opus|aac)$/i, '')}\n${f.path}\n`).join('')}
                {files.length > 5 ? `... and ${files.length - 5} more items` : ''}
              </pre>
            </div>
            <button
              onClick={handleExportPlaylist}
              className="rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 font-semibold text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)]"
            >
              Export All as .m3u8
            </button>
          </>
        )}
      </div>
    </div>
  );
}
