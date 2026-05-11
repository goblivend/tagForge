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

export async function readMetadata(file: File): Promise<AudioTags> {
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
    console.error("Error reading metadata", error);
    return { title: '', artist: '', album: '', albumArtist: '', contributingArtists: '', date: '', genre: '' };
  }
}

export async function writeMetadata(file: File, fileHandle: FileSystemFileHandle, tags: AudioTags) {
  const ext = getFileExtension(file.name);

  if (ext === 'mp3') {
    return await writeMp3Metadata(file, fileHandle, tags);
  } else if (ext === 'm4a' || ext === 'm4b' || ext === 'm4p') {
    return await writeM4aMetadata(file, fileHandle, tags);
  } else {
    return {
      success: false,
      error: `Format .${ext} is not yet supported for metadata writing. Supported formats: MP3, M4A.`
    };
  }
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

    // Ensure v2 object exists
    if (!mp3tag.tags.v2) {
      mp3tag.tags.v2 = {};
    }

    // Map our tags to ID3v2 format frames
    mp3tag.tags.v2.TIT2 = tags.title;
    mp3tag.tags.v2.TPE1 = tags.artist;
    mp3tag.tags.v2.TALB = tags.album;
    // Album artist (TPE2)
    if (typeof tags.albumArtist === 'string' && tags.albumArtist.trim()) {
      mp3tag.tags.v2.TPE2 = tags.albumArtist;
    } else {
      delete mp3tag.tags.v2.TPE2;
    }
    // Contributing artists: store in a TXXX user frame with description 'CONTRIBUTING_ARTISTS'
    if (typeof tags.contributingArtists === 'string' && tags.contributingArtists.trim()) {
      mp3tag.tags.v2.TXXX = mp3tag.tags.v2.TXXX || [];
      // replace existing entry with same description if present
      mp3tag.tags.v2.TXXX = (mp3tag.tags.v2.TXXX.filter?.((t: any) => t.description !== 'CONTRIBUTING_ARTISTS') || []).concat([{ description: 'CONTRIBUTING_ARTISTS', text: tags.contributingArtists }]);
    } else if (mp3tag.tags.v2.TXXX) {
      mp3tag.tags.v2.TXXX = mp3tag.tags.v2.TXXX.filter?.((t: any) => t.description !== 'CONTRIBUTING_ARTISTS') || mp3tag.tags.v2.TXXX;
    }

    // TDRC is usually preferred for full date/time in newer ID3v2.4
    // TYER is the older ID3v2.3 year frame. We'll set both to be safe,
    // or just TYER if they strictly use ID3v2.3 logic
    mp3tag.tags.v2.TYER = tags.date;
    mp3tag.tags.v2.TDRC = tags.date;

    mp3tag.tags.v2.TCON = tags.genre;

    if (tags.picture) {
      mp3tag.tags.v2.APIC = [{
        format: tags.picture.format,
        type: 3, // cover front
        description: '',
        data: Array.from(new Uint8Array(tags.picture.data))
      }];
    } else {
      delete mp3tag.tags.v2.APIC;
    }

    // Write tags back to the array buffer
    mp3tag.save();

    if (mp3tag.error !== '') {
      const message = `mp3tag save error: ${mp3tag.error}`;
      console.error(message);
      return { success: false, error: message };
    }

    const newFileBuffer = mp3tag.buffer; // updated buffer

    // Use FileSystem Access API to write back to the same file.
    // createWritable() replaces the file atomically when using standard config.
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(newFileBuffer);
      await writable.close();
      return { success: true as const };
    } catch (writeError) {
      const writeMsg = writeError instanceof Error ? writeError.message : String(writeError);

      // Detect stale handle error: "state cached in an interface object was made but the state had changed"
      if (writeMsg.includes('state had changed since it was read')) {
        // Try to refresh permissions and retry once
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
            success: false,
            error: `File was modified on disk. Try reloading the folder: ${retryMsg}`,
          };
        }
      }

      return { success: false, error: writeMsg };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error writing metadata", error);
    return { success: false, error: message };
  }
}

async function writeM4aMetadata(_file: File, _fileHandle: FileSystemFileHandle, _tags: AudioTags) {
  try {
    // M4A metadata writing requires full MP4 atom structure parsing and rebuilding
    // This is complex to implement correctly without a dedicated library.
    // For proper M4A support, consider using:
    // - mp4box.js library (needs to be installed: npm install mp4box)
    // - Or external audio tagging tools like TagLib, Mutagen, or ffmpeg

    // Return helpful message to user
    return {
      success: false,
      error: 'M4A metadata writing is not yet fully implemented. ' +
             'Please use an external audio tagger (iTunes, foobar2000, MediaInfo) ' +
             'to edit M4A files, or help improve this feature by contributing to the project.'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error writing M4A metadata", error);
    return { success: false, error: message };
  }
}
