# Core Behavior

This document describes the non-UI core of TagForge: file access, library scanning, metadata handling, and write constraints.

## File system access

TagForge works directly against a user-selected local folder through the File System Access API.

Relevant code:

- `src/services/fsAccess.ts`

Main responsibilities:

- `openDirectory()` opens a folder picker in `readwrite` mode
- `scanDirectoryForAudio()` recursively walks the selected directory
- `checkPermission()` queries or requests access before a read/write operation

## Audio file discovery

The scanner currently includes these extensions:

- `.mp3`
- `.m4a`
- `.flac`
- `.wav`

The scan is recursive, and each discovered file is stored as a `FileEntry` with:

- `handle`
- `path`
- `name`
- optional cached `metadata`
- optional `isEdited` state

## Metadata model

Metadata is normalized into the `AudioTags` interface in `src/services/metadata.ts`:

- `title`
- `artist`
- `album`
- `date`
- `genre`
- optional `picture`

`picture` stores:

- `format`
- raw `ArrayBuffer` image data

## Read path

`readMetadata(file)`:

1. Reads the selected file into an `ArrayBuffer`
2. Passes it to `mp3tag.js`
3. Maps ID3 values into the app's `AudioTags` shape
4. Extracts the first `APIC` frame when cover art exists

The current field mapping includes:

- `TIT2` -> `title`
- `TPE1` -> `artist`
- `TALB` -> `album`
- `TDRC` or `TYER` -> `date`
- `TCON` -> `genre`

## Write path

`writeMetadata(file, fileHandle, tags)`:

1. Re-reads the file into memory
2. Loads existing tags with `mp3tag.js`
3. Ensures an ID3v2 tag object exists
4. Writes updated frames back into the buffer
5. Saves through `createWritable()`

The current write mapping is:

- `title` -> `TIT2`
- `artist` -> `TPE1`
- `album` -> `TALB`
- `date` -> both `TYER` and `TDRC`
- `genre` -> `TCON`
- `picture` -> `APIC`

## Important limitation

The library can list `.m4a`, `.flac`, and `.wav`, but the save action in `Library.tsx` explicitly blocks writes unless the selected file extension is `.mp3`.

That means:

- non-MP3 files can appear in the library
- some metadata may still be read
- saving edits is intentionally disabled for those formats

Any work to broaden format support should update both the scanner expectations and the save pipeline.

## Cover art behavior

Cover art can come from three places in the current UI:

- an already-loaded file from the same library
- a local uploaded image file
- a remote image URL fetched in the browser

Remote fetches can fail because of CORS. That is expected under the current implementation.

## Playlist export

The playlists page exports all loaded files as an `.m3u8` file.

Current behavior:

- writes `#EXTM3U`
- emits one `#EXTINF:-1` line per file
- writes the scanned file path after each entry

Duration values are not currently resolved.
