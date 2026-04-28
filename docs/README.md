# TagForge Documentation

This folder collects project-level notes for TagForge: how the app works, where key behaviors live, and which implementation constraints matter when you change it.

## Guides

- [features/core.md](features/core.md)  
  File access, metadata parsing, save behavior, and current format limitations.

- [features/ui.md](features/ui.md)  
  Route structure, layout behavior, store responsibilities, and persisted UI state.

- [features/hotkeys.md](features/hotkeys.md)  
  Keyboard shortcuts implemented in the library workflow.

## Good starting points in the code

- `src/pages/Library.tsx` - primary workflow and most user-facing behavior
- `src/services/fsAccess.ts` - directory picking, recursive scan, permissions
- `src/services/metadata.ts` - metadata read/write adapter
- `src/store/index.ts` - persisted client state

## Notes for contributors

- The app is designed around the browser File System Access API, so feature work should be tested in Chromium-based browsers.
- The scanner accepts multiple audio formats, but metadata writing currently targets MP3 only.
- A lot of the product behavior is centered in the library page today; splitting that screen into smaller units would make future documentation and testing easier.
