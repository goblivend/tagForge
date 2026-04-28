# UI Behavior

This document covers the current frontend structure and the stateful UI behavior that shapes the TagForge experience.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand with `persist`
- `react-router-dom`

## Route structure

Defined in `src/App.tsx`:

- `Library` at `/`
- `Playlists` at `/playlists`
- `Settings` at `/settings`

The shell layout lives in `src/components/layout/AppLayout.tsx`.

## App layout

`AppLayout` provides:

- a left sidebar for primary navigation
- a main content area for route screens
- a bottom audio player bar that appears only when a file is selected

## Library page

`src/pages/Library.tsx` is the main product surface and currently owns several concerns:

- folder opening and scanning
- file selection
- keyboard shortcuts
- sorting
- column visibility
- metadata form editing
- cover art actions
- save/discard behavior
- rename preset previews and rename execution

The page is effectively a split view:

- left side: library table
- right side: metadata editor for the selected file

## Table behavior

The library table supports:

- sorting by filename, title, artist, album, genre, and year
- column visibility toggles
- edited-file highlighting
- cached metadata display after a file has been opened

The year column is derived from cached metadata and falls back to the first four characters of `date`.

## Editor behavior

The editor supports:

- editing title, artist, album, date, and genre
- datalist suggestions based on previously used values
- cover art preview and removal
- save and discard actions

Discard is implemented by re-reading the currently selected file rather than by tracking a local undo stack.

## Rename workflow

Rename presets are managed in `Settings` and consumed in `Library`.

Supported tokens:

- `{artist}`
- `{title}`
- `{album}`
- `{genre}`
- `{date}`
- `{year}`

Before rename:

- tokens are resolved from the current in-memory metadata
- invalid filename characters are replaced with `_`
- the original file extension is preserved

Actual rename depends on `FileSystemFileHandle.move()`, then the folder is re-scanned to refresh the library state.

## Persisted state

The Zustand store in `src/store/index.ts` persists a narrow subset of client state under `metta-setter-storage`.

Persisted:

- rename presets
- hidden columns
- recent artists
- recent albums
- recent genres

Not persisted:

- opened folder handle
- scanned file list
- current selection
- scanning state

That means UI preferences survive refreshes, but the working library session does not.

## State responsibilities

The store currently owns:

- library file list and selected file
- scanning status
- rename preset management
- recent metadata values for autocomplete
- file edited markers and cached metadata

This is convenient for the current app size, though `Library.tsx` still contains a lot of orchestration logic locally.
