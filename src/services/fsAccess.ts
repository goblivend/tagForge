import { FileEntry } from "../store";

export async function openDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!('showDirectoryPicker' in window)) {
      alert("Your browser doesn't support the File System Access API. Please use a Chromium-based browser like Chrome or Edge.");
      return null;
    }
    // @ts-ignore
    const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    return directoryHandle;
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
        const lowerName = entry.name.toLowerCase();
        if (lowerName.endsWith('.mp3') || lowerName.endsWith('.m4a') || lowerName.endsWith('.flac') || lowerName.endsWith('.wav')) {
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