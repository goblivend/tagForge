# TagForge

TagForge is a browser-based audio metadata editor built with React, TypeScript, and Vite. It uses the File System Access API to work directly against files on disk, so you can open a local music folder, inspect tracks, edit tags, preview audio, update cover art, and export playlists without a server-side backend.

## What it does

- Open a local folder and recursively scan supported audio files
- Read tag data into a sortable library view
- Edit common metadata fields: title, artist, album, date, and genre
- Add, replace, copy, or remove cover art
- Preview the selected track in the built-in audio player
- Rename files with reusable token-based presets
- Export the current library as an `.m3u8` playlist
- Persist UI preferences and rename presets between sessions

## Current format support

TagForge can scan these file extensions:

- `.mp3`
- `.m4a`
- `.flac`
- `.wav`

Current metadata writing support is narrower:

- Reading metadata is implemented through `mp3tag.js`
- Saving tag changes is currently limited to `.mp3`
- File renaming depends on `FileSystemFileHandle.move()`, which is Chromium-specific

That mismatch is intentional in the current codebase and worth knowing up front if you plan to extend format support.

## Browser support

TagForge depends on browser APIs that are not universally available:

- `showDirectoryPicker()`
- `FileSystemFileHandle.createWritable()`
- `FileSystemFileHandle.move()` for in-app rename

Use a recent Chromium-based browser such as Chrome or Edge for the full feature set.

## Getting started

### Requirements

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Start the dev server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Project structure

```text
src/
  components/        Shared layout, player, and UI pieces
  pages/             Route-level screens: Library, Playlists, Settings
  services/          File system and metadata adapters
  store/             Zustand app state and persisted preferences
docs/
  features/          Focused notes on core behavior and architecture
tests/               Local test scripts for metadata experiments
```

## Main application flow

1. The user opens a folder through the File System Access API.
2. `scanDirectoryForAudio()` walks the directory tree and builds the library list.
3. Selecting a file reads metadata into the editor and caches it in the Zustand store.
4. Saving writes ID3 changes back to the selected MP3 file.
5. Optional rename presets generate new filenames from metadata tokens such as `{artist}` and `{title}`.

## Routes

- `/` - Library view for scanning, browsing, editing, artwork, and rename actions
- `/playlists` - Playlist export view
- `/settings` - Rename preset management

## Documentation map

- [Documentation index](docs/README.md)
- [Core behavior](docs/features/core.md)
- [UI behavior](docs/features/ui.md)
- [Keyboard shortcuts](docs/features/hotkeys.md)

## Known limitations

- Metadata save is blocked for non-MP3 files
- URL-based cover art import may fail because of CORS restrictions
- Playlist export currently writes relative library paths as captured during scanning
- Folder handles are not persisted, so users re-open folders per session
- There is no undo/redo history yet

## Roadmap

Planned work is tracked in [ROADMAP.md](ROADMAP.md).
