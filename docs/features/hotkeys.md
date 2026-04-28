# Keyboard Shortcuts

Keyboard shortcuts are implemented inside the `useEffect` handler in `src/pages/Library.tsx`.

## Supported shortcuts

- `?` - open or close the shortcuts modal when focus is not inside an input
- `Ctrl + O` or `Cmd + O` - open or change the working folder
- `Ctrl + S` or `Cmd + S` - save metadata for the selected file
- `Escape` - close the shortcuts modal, or discard edits by reloading the selected file
- `Space` - toggle audio playback
- `N` or `ArrowDown` - select the next track
- `P` or `ArrowUp` - select the previous track

## Behavior notes

- Navigation shortcuts are disabled while the user is typing in form controls.
- Track navigation follows the current sorted file order, not the original scan order.
- `Space` dispatches a `toggle-audio-play` browser event, which the audio player listens for.
- `Escape` does not maintain edit history; it simply reloads metadata from disk for the current selection.
