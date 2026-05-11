import { FileEntry } from "../store";

export type OpenLibrarySource =
  | { mode: 'directory'; handle: FileSystemDirectoryHandle }
  | { mode: 'files'; files: File[] }
  | null;

const AUDIO_ONLY_EXTENSIONS = [
  '.mp3',
  '.m4a',
  '.m4b',
  '.m4p',
  '.flac',
  '.wav',
  '.ogg',
  '.opus',
  '.aac',
];

const PLAYLIST_EXTENSIONS = [
  '.m3u',
  '.m3u8',
];

const SUPPORTED_AUDIO_EXTENSIONS = [...AUDIO_ONLY_EXTENSIONS, ...PLAYLIST_EXTENSIONS];

function isSupportedAudioFile(name: string) {
  const lowerName = name.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some(extension => lowerName.endsWith(extension));
}

export function isAudioFile(name: string): boolean {
  const lowerName = name.toLowerCase();
  return AUDIO_ONLY_EXTENSIONS.some(extension => lowerName.endsWith(extension));
}

export function isPlaylistFilePath(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return PLAYLIST_EXTENSIONS.some(extension => lowerPath.endsWith(extension));
}

export async function openDirectory(): Promise<OpenLibrarySource> {
  try {
    if ('showDirectoryPicker' in window) {
      // @ts-ignore
      const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      return { mode: 'directory', handle: directoryHandle };
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    (input as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true;
    input.setAttribute('webkitdirectory', 'true');
    input.style.display = 'none';

    const selectedFiles = await new Promise<File[]>((resolve) => {
      const handleChange = () => {
        const files = Array.from(input.files || []);
        input.removeEventListener('change', handleChange);
        input.remove();
        resolve(files);
      };

      input.addEventListener('change', handleChange);
      document.body.appendChild(input);
      input.click();
    });

    if (selectedFiles.length === 0) return null;
    return { mode: 'files', files: selectedFiles };
  } catch (error) {
    if ((error as DOMException).name !== 'AbortError') {
      console.error("Error opening directory", error);
    }
    return null;
  }
}

export async function scanDirectoryForAudio(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ""
): Promise<FileEntry[]> {
  const files: FileEntry[] = [];

  try {
    // We have to use any here because TypeScript DOM types for async iterators
    // on FileSystemHandles aren't completely standard yet
    for await (const entry of (dirHandle as any).values()) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        if (isSupportedAudioFile(entry.name)) {
          files.push({
            handle: entry as FileSystemFileHandle,
            path: fullPath,
            name: entry.name,
          });
        }
      } else if (entry.kind === 'directory') {
        const subFiles = await scanDirectoryForAudio(entry as FileSystemDirectoryHandle, fullPath);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    console.error("Error scanning directory", error);
  }

  return files;
}

export function scanFilesForAudio(files: File[]): FileEntry[] {
  return files
    .filter(file => isSupportedAudioFile(file.name))
    .map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
      name: file.name,
    }));
}

export async function findPlaylistsInDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ""
): Promise<FileEntry[]> {
  const playlists: FileEntry[] = [];

  try {
    for await (const entry of (dirHandle as any).values()) {
      const fullPath = path ? `${path}/${entry.name}` : entry.name;

      if (entry.kind === 'file') {
        if (isPlaylistFilePath(entry.name)) {
          playlists.push({
            handle: entry as FileSystemFileHandle,
            path: fullPath,
            name: entry.name,
          });
        }
      } else if (entry.kind === 'directory') {
        const subPlaylists = await findPlaylistsInDirectory(entry as FileSystemDirectoryHandle, fullPath);
        playlists.push(...subPlaylists);
      }
    }
  } catch (error) {
    console.error("Error finding playlists", error);
  }

  return playlists;
}

export async function getFileFromEntry(entry: FileEntry): Promise<File> {
  if (entry.file) {
    return entry.file;
  }

  if (entry.handle) {
    return await entry.handle.getFile();
  }

  throw new Error('This file cannot be read in the current browser session.');
}

export async function checkPermission(fileHandle: FileSystemHandle, readWrite: boolean = true) {
  const options: any = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }

  if ((await (fileHandle as any).queryPermission(options)) === 'granted') {
    return true;
  }

  if ((await (fileHandle as any).requestPermission(options)) === 'granted') {
    return true;
  }

  return false;
}
