# Metta Setter - Project Roadmap

This document provides a high-level overview of the features implemented and a roadmap of planned future capabilities.

## ✅ Implemented Features

### 1. Interface & Layout
- **Dynamic Resize**: The library list and editor sections are fully resizable.
- **Toggleable Columns**: Title, Artist, Album, Genre, and Year columns can be customized via the settings dropdown.
- **Sorting Mechanisms**: The entire song list can be alphanumerically sorted by column metrics (A-Z or Z-A).

### 2. Audio Metadata Management
- **Tags Editor**: Fast textual input to override standard ID3 frames natively inside the browser using `mp3tag.js`.
- **Bulk Rename Presets**: Pre-configured variables (e.g., `{artist} - {title}`) seamlessly rename the file directly on the file system level via File System Access API. 
- **Persisted State Tracking**: App settings, like hidden column layouts and custom rename sequences, dynamically persist across sessions using `zustand/persist`.

### 3. Cover Art UI (Poster system)
- **Smart Extract**: Finds matching Album art locally within the opened folder implicitly.
- **Upload Art**: Injects custom local images directly into the `picture` byte array.
- **URL Fetching**: Grabs the JPEG from any http link straight into the media memory cache.

### 4. Usability Enhancements
- **Global Hotkeys**: 
  - `Ctrl + O` (Open Directory)
  - `Ctrl + S` (Save Track)
  - `Escape` (Discard changes)
  - `Spacebar` (Play / Pause file)
  - `N` or `ArrowDown` (Next Track)
  - `P` or `ArrowUp` (Previous Track)
- **Shortcuts Modal**: Visual `?` keyboard overlay map indexing all supported hotkey combinations.
- **Built-in Audio Player**: Streamlined audio listener locked inside the editor view to preview tags organically.

## 🔜 Future Features (Left to Add)
- **Undo / Redo Queue**: Track edit states sequentially enabling rolling back of recent saves or mistyped fields.
- **Batch Export Configurations**: Allowing users to import/export their persistent customized tagging schema config.
- **Mass Tagging**: Apply the exact same Album / Year / Poster to 50 tracks via multi-selection (Shift + Click).
- **Advanced ID3 Frame Parsing**: Implement reading/writing for rare metadata frames (e.g. "BPM", "Composer", "Lyrics").

