import MP3Tag from 'mp3tag.js';
import { checkPermission } from './fsAccess';

export interface AudioTags {
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  contributingArtists?: string;
  date: string;
  genre: string;
  picture?: {
    format: string;
    data: ArrayBuffer;
  };
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

type FileCapability = {
  canReadMetadata: boolean;
  canWriteMetadata: boolean;
  playlistOnly?: boolean;
};

export type FormatLegendItem = {
  extension: string;
  canReadMetadata: boolean;
  canWriteMetadata: boolean;
  playlistOnly: boolean;
};

const FORMAT_CAPABILITIES: Record<string, FileCapability> = {
  mp3: { canReadMetadata: true, canWriteMetadata: true },
  // M4A/M4B/M4P write is disabled: mp3tag.js writes ID3v2 (non-standard), but reads expect iTunes atoms (standard).
  // Music-metadata-browser can't read ID3v2 from MP4 → tags appear empty after save.
  // Use MP3 format or external tools like FFmpeg for M4A tagging.
  m4a: { canReadMetadata: true, canWriteMetadata: false },
  m4b: { canReadMetadata: true, canWriteMetadata: false },
  m4p: { canReadMetadata: true, canWriteMetadata: false },
  wav: { canReadMetadata: true, canWriteMetadata: false },
  flac: { canReadMetadata: true, canWriteMetadata: false },
  ogg: { canReadMetadata: true, canWriteMetadata: false },
  opus: { canReadMetadata: true, canWriteMetadata: false },
  aac: { canReadMetadata: true, canWriteMetadata: false },
  m3u: { canReadMetadata: false, canWriteMetadata: false, playlistOnly: true },
  m3u8: { canReadMetadata: false, canWriteMetadata: false, playlistOnly: true },
};

export function getFormatLegendItems(): FormatLegendItem[] {
  return Object.entries(FORMAT_CAPABILITIES)
    .map(([extension, capability]) => ({
      extension,
      canReadMetadata: capability.canReadMetadata,
      canWriteMetadata: capability.canWriteMetadata,
      playlistOnly: !!capability.playlistOnly,
    }))
    .sort((a, b) => a.extension.localeCompare(b.extension));
}

function getCapabilitiesForFileName(fileName: string): FileCapability {
  const ext = getFileExtension(fileName);
  return FORMAT_CAPABILITIES[ext] || { canReadMetadata: false, canWriteMetadata: false };
}

export function canReadMetadataForFileName(fileName: string): boolean {
  return getCapabilitiesForFileName(fileName).canReadMetadata;
}

export function canWriteMetadataForFileName(fileName: string): boolean {
  return getCapabilitiesForFileName(fileName).canWriteMetadata;
}

export function isPlaylistFile(fileName: string): boolean {
  return !!getCapabilitiesForFileName(fileName).playlistOnly;
}

type ParsedCommonMetadata = {
  title?: string;
  artist?: string;
  artists?: string[];
  album?: string;
  albumartist?: string;
  year?: number;
  genre?: string[] | string;
  picture?: Array<{ format?: string; data: Uint8Array }>;
};

function mapCommonMetadata(fileMeta: ParsedCommonMetadata): AudioTags {
  const picture = fileMeta.picture?.[0]?.data
    ? {
        format: fileMeta.picture[0].format || 'image/jpeg',
        data: fileMeta.picture[0].data.buffer.slice(
          fileMeta.picture[0].data.byteOffset,
          fileMeta.picture[0].data.byteOffset + fileMeta.picture[0].data.byteLength
        ),
      }
    : undefined;

  return {
    title: fileMeta.title || '',
    artist: fileMeta.artist || (fileMeta.artists?.[0] || ''),
    album: fileMeta.album || '',
    albumArtist: fileMeta.albumartist || '',
    contributingArtists: Array.isArray(fileMeta.artists) ? fileMeta.artists.join(', ') : '',
    date: fileMeta.year ? String(fileMeta.year) : '',
    genre: Array.isArray(fileMeta.genre) ? (fileMeta.genre[0] || '') : (fileMeta.genre || ''),
    picture,
  };
}

async function parseWithMusicMetadata(file: File): Promise<ParsedCommonMetadata> {
  const { parseBlob } = await import('music-metadata-browser');
  const metadata = await parseBlob(file);
  return metadata.common as ParsedCommonMetadata;
}

async function inspectMp4ContainerWithMp4box(file: File): Promise<void> {
  const MP4Box = await import('mp4box');
  type MP4BoxBuffer = import('mp4box').MP4BoxBuffer;

  const arrayBuffer = await file.arrayBuffer();
  const bufferWithOffset = arrayBuffer as MP4BoxBuffer;
  bufferWithOffset.fileStart = 0;

  const mp4boxFile = MP4Box.createFile();

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    mp4boxFile.onError = (e: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(e || 'Failed to parse MP4 container'));
    };

    mp4boxFile.onReady = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    try {
      mp4boxFile.appendBuffer(bufferWithOffset);
      mp4boxFile.flush();
    } catch (error) {
      if (settled) return;
      settled = true;
      reject(error);
    }
  });
}

function emptyTags(): AudioTags {
  return { title: '', artist: '', album: '', albumArtist: '', contributingArtists: '', date: '', genre: '' };
}

function normalizeYearLike(value: string | undefined | null): string {
  const trimmed = (value || '').trim();
  const match = trimmed.match(/\d{4}/);
  return match ? match[0] : trimmed;
}

function tagsMatchForValidation(expected: AudioTags, actual: AudioTags): boolean {
  return (
    (expected.title || '').trim() === (actual.title || '').trim() &&
    (expected.artist || '').trim() === (actual.artist || '').trim() &&
    (expected.album || '').trim() === (actual.album || '').trim() &&
    (expected.genre || '').trim() === (actual.genre || '').trim() &&
    normalizeYearLike(expected.date) === normalizeYearLike(actual.date)
  );
}

function applyCommonId3Tags(mp3tag: MP3Tag, tags: AudioTags) {
  if (!mp3tag.tags.v2) {
    mp3tag.tags.v2 = {};
  }

  mp3tag.tags.v2.TIT2 = tags.title;
  mp3tag.tags.v2.TPE1 = tags.artist;
  mp3tag.tags.v2.TALB = tags.album;

  if (typeof tags.albumArtist === 'string' && tags.albumArtist.trim()) {
    mp3tag.tags.v2.TPE2 = tags.albumArtist;
  } else {
    delete mp3tag.tags.v2.TPE2;
  }

  if (typeof tags.contributingArtists === 'string' && tags.contributingArtists.trim()) {
    mp3tag.tags.v2.TXXX = mp3tag.tags.v2.TXXX || [];
    mp3tag.tags.v2.TXXX = (mp3tag.tags.v2.TXXX.filter?.((t: any) => t.description !== 'CONTRIBUTING_ARTISTS') || [])
      .concat([{ description: 'CONTRIBUTING_ARTISTS', text: tags.contributingArtists }]);
  } else if (mp3tag.tags.v2.TXXX) {
    mp3tag.tags.v2.TXXX = mp3tag.tags.v2.TXXX.filter?.((t: any) => t.description !== 'CONTRIBUTING_ARTISTS') || mp3tag.tags.v2.TXXX;
  }

  mp3tag.tags.v2.TYER = tags.date;
  mp3tag.tags.v2.TDRC = tags.date;
  mp3tag.tags.v2.TCON = tags.genre;

  if (tags.picture) {
    mp3tag.tags.v2.APIC = [{
      format: tags.picture.format,
      type: 3,
      description: '',
      data: Array.from(new Uint8Array(tags.picture.data)),
    }];
  } else {
    delete mp3tag.tags.v2.APIC;
  }
}

async function writeBufferWithRetry(fileHandle: FileSystemFileHandle, newFileBuffer: ArrayBufferLike | ArrayBufferView) {
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(newFileBuffer);
    await writable.close();
    return { success: true as const };
  } catch (writeError) {
    const writeMsg = writeError instanceof Error ? writeError.message : String(writeError);

    if (writeMsg.includes('state had changed since it was read')) {
      try {
        const hasPerm = await checkPermission(fileHandle, true);
        if (hasPerm) {
          const retryWritable = await fileHandle.createWritable();
          await retryWritable.write(newFileBuffer);
          await retryWritable.close();
          return { success: true as const };
        }
      } catch (retryError) {
        const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
        return {
          success: false as const,
          error: `File was modified on disk. Try reloading the folder: ${retryMsg}`,
        };
      }
    }

    return { success: false as const, error: writeMsg };
  }
}

export async function readMetadata(file: File): Promise<AudioTags> {
  const ext = getFileExtension(file.name);
  if (!canReadMetadataForFileName(file.name)) {
    return emptyTags();
  }

  try {
    // For MP4-family files, parse container with mp4box first for better format validation.
    if (ext === 'm4a' || ext === 'm4b' || ext === 'm4p') {
      await inspectMp4ContainerWithMp4box(file);
    }

    return mapCommonMetadata(await parseWithMusicMetadata(file));
  } catch (parseError) {
    // Fallback: keep MP3 read compatibility with current mp3tag behavior.
    if (ext !== 'mp3') {
      console.error('Error reading metadata', parseError);
      return emptyTags();
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const mp3tag = new MP3Tag(arrayBuffer, true);
      mp3tag.read();

      if (mp3tag.error !== '') {
        console.warn("mp3tag read warning/error:", mp3tag.error);
      }

      let picture = undefined;
      if (mp3tag.tags.v2?.APIC && mp3tag.tags.v2.APIC.length > 0) {
        for (const apic of mp3tag.tags.v2.APIC) {
          const imageData = apic.data ? new Uint8Array(apic.data).buffer : null;
          if (!imageData || imageData.byteLength === 0) {
            continue;
          }

          picture = {
            format: apic.format || 'image/jpeg',
            data: imageData
          };
          break;
        }
      }

      return {
        title: mp3tag.tags.v2?.TIT2 || mp3tag.tags.title || '',
        artist: mp3tag.tags.v2?.TPE1 || mp3tag.tags.artist || '',
        album: mp3tag.tags.v2?.TALB || mp3tag.tags.album || '',
        albumArtist: mp3tag.tags.v2?.TPE2 || (mp3tag.tags as any).albumArtist || '',
        contributingArtists: mp3tag.tags.v2?.TXXX?.find?.((t: any) => t.description === 'CONTRIBUTING_ARTISTS')?.text || '',
        date: mp3tag.tags.v2?.TDRC || mp3tag.tags.v2?.TYER || mp3tag.tags.year || '',
        genre: mp3tag.tags.v2?.TCON || mp3tag.tags.genre || '',
        picture
      };
    } catch (error) {
      console.error('Error reading metadata', error);
      return emptyTags();
    }
  }
}

export async function writeMetadata(file: File, fileHandle: FileSystemFileHandle, tags: AudioTags) {
  if (!canWriteMetadataForFileName(file.name)) {
    const ext = getFileExtension(file.name);
    if (isPlaylistFile(file.name)) {
      return {
        success: false,
        error: `Format .${ext} is a playlist file and cannot be tag-edited.`,
      };
    }
    if (ext === 'm4a' || ext === 'm4b' || ext === 'm4p') {
      return {
        success: false,
        error: `Format .${ext} write is not supported. mp3tag.js uses incompatible tagging. Try converting to MP3 or use external tools like FFmpeg.`,
      };
    }
    return {
      success: false,
      error: `Format .${ext} is currently read-only for metadata in TagForge.`,
    };
  }

  const ext = getFileExtension(file.name);
  if (ext === 'mp3') {
    return await writeMp3Metadata(file, fileHandle, tags);
  }

  if (ext === 'm4a' || ext === 'm4b' || ext === 'm4p') {
    return await writeM4aMetadata(file, fileHandle, tags);
  }

  return {
    success: false,
    error: `Format .${ext} is not yet supported for metadata writing.`,
  };
}

async function writeMp3Metadata(file: File, fileHandle: FileSystemFileHandle, tags: AudioTags) {
  try {
    // Read file into ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // mp3tag requires generic Buffer/ArrayBuffer
    const mp3tag = new MP3Tag(arrayBuffer, true);

    // Read existing tags to maintain other data if possible
    mp3tag.read();

    if (mp3tag.error !== '') {
      console.warn("mp3tag read warning/error before write:", mp3tag.error);
    }

    applyCommonId3Tags(mp3tag, tags);

    // Write tags back to the array buffer
    mp3tag.save();

    if (mp3tag.error !== '') {
      const message = `mp3tag save error: ${mp3tag.error}`;
      console.error(message);
      return { success: false, error: message };
    }

    const newFileBuffer = mp3tag.buffer;
    return await writeBufferWithRetry(fileHandle, newFileBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error writing metadata", error);
    return { success: false, error: message };
  }
}

async function writeM4aMetadata(file: File, fileHandle: FileSystemFileHandle, tags: AudioTags) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const mp3tag = new MP3Tag(arrayBuffer, true);

    mp3tag.read();
    if (mp3tag.error !== '') {
      console.warn('mp3tag read warning/error before M4A write:', mp3tag.error);
    }

    applyCommonId3Tags(mp3tag, tags);

    mp3tag.save({
      id3v2: { padding: 0 },
      mp4: { language: 'und' },
    });

    if (mp3tag.error !== '') {
      const message = `mp3tag save error: ${mp3tag.error}`;
      console.error(message);
      return { success: false, error: message };
    }

    const newFileBuffer = mp3tag.buffer;

    // Write to disk first
    const writeResult = await writeBufferWithRetry(fileHandle, newFileBuffer);
    if (!writeResult.success) {
      return writeResult;
    }

    // Validate by reading back from disk
    try {
      const diskFile = await fileHandle.getFile();
      const writtenTags = await readMetadata(diskFile);
      if (!tagsMatchForValidation(tags, writtenTags)) {
        return {
          success: false,
          error: 'M4A validation failed after write. Tags were written but may be incomplete. This is a limitation of the mp4 tagging library.',
        };
      }
    } catch (validationError) {
      console.warn('Could not validate M4A write from disk:', validationError);
      // Allow the write to succeed anyway - validation is a safety check, not required
    }

    return writeResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error writing M4A metadata", error);
    return { success: false, error: message };
  }
}
