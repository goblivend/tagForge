# Core Functional Documentation

The most foundational functionality driving this application is the File System Access API bundled intrinsically alongside `mp3tag.js`.

### Metadata Parsing
The internal metadata system utilizes ArrayBuffers mapped sequentially against standard ID3v2 frames natively tracked through `AudioTags`.
The custom attributes mapped out include front-facing ID3 attributes and `picture` arrays (Posters).
See `src/services/metadata.ts`.
