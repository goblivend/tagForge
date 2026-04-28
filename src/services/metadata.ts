import MP3Tag from 'mp3tag.js';

export interface AudioTags {
  title: string;
  artist: string;
  album: string;
  date: string;
  genre: string;
}

export async function readMetadata(file: File): Promise<AudioTags> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const mp3tag = new MP3Tag(arrayBuffer, true);
    mp3tag.read();

    if (mp3tag.error !== '') {
      console.warn("mp3tag read warning/error:", mp3tag.error);
    }

    return {
      title: mp3tag.tags.v2?.TIT2 || mp3tag.tags.title || '',
      artist: mp3tag.tags.v2?.TPE1 || mp3tag.tags.artist || '',
      album: mp3tag.tags.v2?.TALB || mp3tag.tags.album || '',
      date: mp3tag.tags.v2?.TDRC || mp3tag.tags.v2?.TYER || mp3tag.tags.year || '',
      genre: mp3tag.tags.v2?.TCON || mp3tag.tags.genre || '',
    };
  } catch (error) {
    console.error("Error reading metadata", error);
    return { title: '', artist: '', album: '', date: '', genre: '' };
  }
}

export async function writeMetadata(file: File, fileHandle: FileSystemFileHandle, tags: AudioTags) {
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

    // TDRC is usually preferred for full date/time in newer ID3v2.4
    // TYER is the older ID3v2.3 year frame. We'll set both to be safe,
    // or just TYER if they strictly use ID3v2.3 logic
    mp3tag.tags.v2.TYER = tags.date;
    mp3tag.tags.v2.TDRC = tags.date;

    mp3tag.tags.v2.TCON = tags.genre;

    // Write tags back to the array buffer
    mp3tag.save();

    if (mp3tag.error !== '') {
      console.error("mp3tag save error:", mp3tag.error);
      return false;
    }

    const newFileBuffer = mp3tag.buffer; // updated buffer

    // Use FileSystem Access API to write back to the same file.
    // createWritable() replaces the file atomically when using standard config.
    const writable = await fileHandle.createWritable();
    await writable.write(newFileBuffer);
    await writable.close();

    return true;
  } catch (error) {
    console.error("Error writing metadata", error);
    return false;
  }
}
