import React, { useState, useEffect, useMemo } from "react";
import { useAppStore, FileEntry } from "../store";
import { openDirectory, scanDirectoryForAudio, checkPermission } from "../services/fsAccess";
import { readMetadata, writeMetadata, AudioTags } from "../services/metadata";

import { Settings2, CheckCircle2, Image as ImageIcon, UploadCloud, Link as LinkIcon, Clipboard, Keyboard, Search, X } from "lucide-react";

const DEBUG_COVERS = import.meta.env.DEV;

function debugCover(...args: unknown[]) {
  if (DEBUG_COVERS) {
    console.debug(...args);
  }
}

function hasValidPicture(picture?: { format: string; data: ArrayBuffer } | null): picture is { format: string; data: ArrayBuffer } {
  return !!picture?.data && picture.data.byteLength > 0;
}

type ClipboardImageItem = {
  types: string[];
  getType: (type: string) => Promise<Blob>;
};

async function readClipboardImage(): Promise<{ format: string; data: ArrayBuffer } | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    return null;
  }

  const items = await navigator.clipboard.read() as unknown as ClipboardImageItem[];
  for (const item of items) {
    const imageType = item.types.find(type => type.startsWith('image/'));
    if (!imageType) continue;

    const blob = await item.getType(imageType);
    return {
      format: blob.type || imageType,
      data: await blob.arrayBuffer(),
    };
  }

  return null;
}

async function readPictureFromClipboardData(clipboardData: DataTransfer | null): Promise<{ format: string; data: ArrayBuffer } | null> {
  if (!clipboardData) return null;

  const file = Array.from(clipboardData.files).find((item) => item.type.startsWith('image/'));
  if (file) {
    return {
      format: file.type || 'image/png',
      data: await file.arrayBuffer(),
    };
  }

  const item = Array.from(clipboardData.items).find((entry) => entry.kind === 'file' && entry.type.startsWith('image/'));
  if (!item) return null;

  const fileFromItem = item.getAsFile();
  if (!fileFromItem) return null;

  return {
    format: fileFromItem.type || item.type || 'image/png',
    data: await fileFromItem.arrayBuffer(),
  };
}

function CoverThumb({
  picture,
  alt,
  className,
  loadingClassName,
  onLoadError,
}: {
  picture?: { format: string; data: ArrayBuffer };
  alt: string;
  className?: string;
  loadingClassName?: string;
  onLoadError?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const urlRef = React.useRef<string | null>(null);
  const prevDataRef = React.useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    if (!hasValidPicture(picture)) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setUrl(null);
      setLoadFailed(false);
      prevDataRef.current = null;
      return;
    }

    // Only create new blob URL if the actual data changed (by reference)
    if (prevDataRef.current === picture.data) {
      // Data is the same, just restore the URL if needed
      if (urlRef.current) {
        setUrl(urlRef.current);
      }
      return;
    }

    // Data changed, revoke old URL if exists
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }

    // Create new blob URL
    prevDataRef.current = picture.data;
    const nextUrl = URL.createObjectURL(new Blob([picture.data], { type: picture.format }));
    urlRef.current = nextUrl;
    setLoadFailed(false);
    setUrl(nextUrl);

    // Don't cleanup—keep URL for reuse if same data returns later
  }, [picture?.data]);

  if (!picture || !url) {
    return <span className={loadingClassName || "w-full h-full block"} />;
  }

  if (loadFailed) {
    return <span className={loadingClassName || "w-full h-full block"} />;
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => {
        debugCover('[CoverThumb] failed to load', {
          alt,
          format: picture?.format,
          bytes: picture?.data?.byteLength,
          url,
        });
        setLoadFailed(true);
        onLoadError?.();
      }}
    />
  );
}

function removeInvalidPicture(path?: string, source?: string) {
  if (!path) return;
  debugCover('[cover-scan] removing invalid picture', { path, source });
  useAppStore.getState().updateFileMetadata(path, { picture: undefined });
}

export default function Library() {
  const {
    folderHandle, files, setFolderHandle, setFiles, setScanning, isScanning,
    selectedFile, setSelectedFile,
    recentArtists, recentAlbums, recentGenres, addRecentMetadata,
    filenamePresets,
    markFileAsEdited, updateFileMetadata,
    hiddenColumns, toggleColumn
  } = useAppStore();

  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // using global selectedFile
  const [metadata, setMetadata] = useState<AudioTags | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showFindModal, setShowFindModal] = useState(false);
  const [findFilter, setFindFilter] = useState('');
  const [mobileView, setMobileView] = useState<'tracks' | 'details'>('tracks');
  const [showRenamePanel, setShowRenamePanel] = useState(true);

  const [leftWidth, setLeftWidth] = useState(400); // Draggable resizer width
  const [isDragging, setIsDragging] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const cropContainerRef = React.useRef<HTMLDivElement | null>(null);
  const cropImageRef = React.useRef<HTMLImageElement | null>(null);
  const [cropRect, setCropRect] = useState({ x: 80, y: 80, width: 220, height: 220 });
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropImageReady, setCropImageReady] = useState(false);
  const [cropAspect, setCropAspect] = useState<number | null>(null); // null = free
  const [cropAction, setCropAction] = useState<null | {
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    startRect: { x: number; y: number; width: number; height: number };
  }>(null);
  const backgroundScanRef = React.useRef(0);

  const getResponsiveLeftWidth = (viewportWidth: number) => {
    if (viewportWidth >= 2560) return 560;
    if (viewportWidth >= 1920) return 480;
    if (viewportWidth >= 1600) return 420;
    if (viewportWidth >= 1440) return 380;
    return 340;
  };


  const getPreviewNameForPreset = (format: string) => {
    if (!metadata || !selectedFile) return '';
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'mp3';

    let computed = format;

    // Replace tokens safely using regex logic
    computed = computed.replace(/\{artist\}/gi, metadata.artist?.trim() || 'Unknown Artist');
    computed = computed.replace(/\{title\}/gi, metadata.title?.trim() || 'Unknown Title');
    computed = computed.replace(/\{album\}/gi, metadata.album?.trim() || 'Unknown Album');
    computed = computed.replace(/\{genre\}/gi, metadata.genre?.trim() || 'Unknown Genre');
    computed = computed.replace(/\{date\}/gi, metadata.date?.trim() || 'Unknown Date');
    computed = computed.replace(/\{year\}/gi, metadata.date?.substring(0, 4) || 'Unknown Year');

    // Clean up empty gaps when tokens resolve to empty strings gracefully
    computed = computed.replace(/\s+-\s+$/, '').replace(/^\s+-\s+/, '').replace(/\s{2,}/g, ' ');

    computed = computed.replace(/[<>:"/\\|?*]+/g, '_').trim();

    // ensure extension stays
    return computed.endsWith(`.${ext}`) ? computed : `${computed}.${ext}`;
  };

  // Background incremental cover scanner: progressively reads artwork for files without picture
  useEffect(() => {
    let cancelled = false;
    const runId = ++backgroundScanRef.current;
    if (!files || files.length === 0) return;

    const selectedPath = selectedFile?.path;
    const priorityFile = selectedPath ? files.find(f => f.path === selectedPath) : null;
    const rest = files.filter(f => f.path !== selectedPath);
    const queue = priorityFile ? [priorityFile, ...rest] : rest;

    const waitForIdle = () => new Promise<void>((resolve) => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => resolve(), { timeout: 80 });
      } else {
        setTimeout(() => resolve(), 0);
      }
    });

    (async () => {
      for (const f of queue) {
        if (cancelled || runId !== backgroundScanRef.current) break;
        if (f.metadata?.picture) continue;

        try {
          const hasPerm = await checkPermission(f.handle, false);
          if (!hasPerm) continue;
          const domFile = await f.handle.getFile();
          const tags = await readMetadata(domFile);
          if (cancelled || runId !== backgroundScanRef.current) break;
          if (tags.picture) {
            debugCover('[cover-scan] picture found', {
              path: f.path,
              name: f.name,
              format: tags.picture.format,
              bytes: tags.picture.data.byteLength,
            });
            useAppStore.getState().updateFileMetadata(f.path, { picture: tags.picture });
            if (selectedPath === f.path) {
              setMetadata(prev => prev ? { ...prev, picture: tags.picture } : prev);
            }
          } else if (DEBUG_COVERS) {
            debugCover('[cover-scan] no picture', { path: f.path, name: f.name });
          }
        } catch (e) {
          console.error('background cover scan error', e);
        }

        await waitForIdle();
      }
    })();

    return () => { cancelled = true; };
  }, [folderHandle, files.length, selectedFile?.path]);

  const sortedFiles = useMemo(() => {
    if (!sortConfig) return files;
    return [...files].sort((a, b) => {
      let aVal = sortConfig.key === 'filename' ? a.name : (a.metadata as any)?.[sortConfig.key];
      let bVal = sortConfig.key === 'filename' ? b.name : (b.metadata as any)?.[sortConfig.key];
      if (!aVal) aVal = '';
      if (!bVal) bVal = '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [files, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if (e.key === '?' && !isInput) {
        setShowShortcuts(prev => !prev);
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'o') {
          e.preventDefault();
          handleOpenFolder();
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSave();
        }
      }

      // Discard / Escape
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (selectedFile) {
          e.preventDefault();
          handleSelectFile(selectedFile); // Discard
        }
      }

      // Next / Prev music / Play / Pause
      if (!isInput && sortedFiles.length > 0) {
        const currentIndex = sortedFiles.findIndex(f => f.path === selectedFile?.path);

        if (e.key === ' ') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('toggle-audio-play'));
        } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'n') {
          e.preventDefault();
          if (currentIndex >= 0 && currentIndex < sortedFiles.length - 1) {
            handleSelectFile(sortedFiles[currentIndex + 1]);
          } else if (currentIndex === -1) {
            handleSelectFile(sortedFiles[0]);
          }
        } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          if (currentIndex > 0) {
            handleSelectFile(sortedFiles[currentIndex - 1]);
          }
        }
      }
    };
    window.addEventListener('keydown', downHandler);
    return () => window.removeEventListener('keydown', downHandler);
  }, [selectedFile, sortedFiles, showShortcuts, files]);

  useEffect(() => {
    const pasteHandler = (event: Event) => {
      void (async () => {
        const clipboardEvent = event as ClipboardEvent;
        const target = clipboardEvent.target as HTMLElement | null;
        const isTextField = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
        if (isTextField || !selectedFile) return;

        const picture = await readPictureFromClipboardData(clipboardEvent.clipboardData);
        if (!picture) return;

        clipboardEvent.preventDefault();
        handleChange('picture', picture as any);
        updateFileMetadata(selectedFile.path, { picture });
        setSaveMessage('Pasted image from clipboard');
        setTimeout(() => setSaveMessage(null), 2000);
      })();
    };

    window.addEventListener('paste', pasteHandler);
    return () => window.removeEventListener('paste', pasteHandler);
  }, [selectedFile]);

  // Make default left width responsive to screen size
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateLeftWidth = () => setLeftWidth(getResponsiveLeftWidth(window.innerWidth));
      updateLeftWidth();
      window.addEventListener('resize', updateLeftWidth);
      return () => window.removeEventListener('resize', updateLeftWidth);
    }
  }, []);

  const handleOpenFolder = async () => {
    try {
      const handle = await openDirectory();
      if (!handle) return;

      setFolderHandle(handle);
      setScanning(true);
      setSelectedFile(null);
      setMetadata(null);
      setMobileView('tracks');
      setShowRenamePanel(true);

      const foundFiles = await scanDirectoryForAudio(handle);
      setFiles(foundFiles);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const handleSelectFile = async (file: FileEntry) => {
    setSelectedFile(file);
    setMobileView('details');
    setShowRenamePanel(true);
    setIsReading(true);

    try {
      const hasPerm = await checkPermission(file.handle, true);
      if (!hasPerm) {
        alert("Permission to access file was denied.");
        setIsReading(false);
        return;
      }

      const domFile = await file.handle.getFile();
      const tags = await readMetadata(domFile);
      setMetadata(tags);
      addRecentMetadata(tags);
      updateFileMetadata(file.path, tags);
    } catch (e) {
      console.error(e);
      setMetadata(null);
    } finally {
      setIsReading(false);
    }
  };

  const handleChange = (field: keyof AudioTags, value: any) => {
    if (metadata) {
      setMetadata({ ...metadata, [field]: value });
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile || !metadata) return;

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      if (ext !== 'mp3') {
        setSaveMessage('Error: Only MP3 files supported for saving.');
        setIsSaving(false);
        setTimeout(() => setSaveMessage(null), 3000);
        return;
      }

      const hasPerm = await checkPermission(selectedFile.handle, true);
      if (!hasPerm) {
        setSaveMessage('Error: Permission denied.');
        return;
      }

      const domFile = await selectedFile.handle.getFile();
      const success = await writeMetadata(domFile, selectedFile.handle, metadata);
      if (success) {
        addRecentMetadata(metadata);
        markFileAsEdited(selectedFile.path);
        updateFileMetadata(selectedFile.path, metadata);
        setSaveMessage('Saved successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage('Failed to save metadata.');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (e) {
      console.error("Error saving:", e);
      setSaveMessage('Error saving metadata.');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const applyCoverFromFile = (f: FileEntry) => {
    const picture = f.metadata?.picture;
    if (!hasValidPicture(picture) || !f.metadata) return;
    handleChange('picture', picture as any);
    if (selectedFile) useAppStore.getState().updateFileMetadata(selectedFile.path, { picture });
    setShowFindModal(false);
  };

  const COLUMNS = [
    { key: "filename", label: "File" },
    { key: "title", label: "Title" },
    { key: "artist", label: "Artist" },
    { key: "album", label: "Album" },
    { key: "genre", label: "Genre" },
    { key: "year", label: "Year" }
  ];

  useEffect(() => {
    const picture = metadata?.picture;
    if (!showCropModal || !hasValidPicture(picture)) {
      setCropImageUrl(null);
      setCropImageReady(false);
      return;
    }
    const url = URL.createObjectURL(new Blob([picture.data], { type: picture.format }));
    setCropImageUrl(url);
    setCropImageReady(false);
    return () => {
      URL.revokeObjectURL(url);
      setCropImageUrl(null);
      setCropImageReady(false);
    };
  }, [showCropModal, metadata?.picture]);

  useEffect(() => {
    const selectedPicture = selectedFile?.metadata?.picture;
    if (!selectedFile || !hasValidPicture(selectedPicture)) return;
    setMetadata(prev => {
      if (!prev) return prev;
      const nextPicture = selectedPicture;
      if (prev.picture?.data === nextPicture.data && prev.picture?.format === nextPicture.format) return prev;
      return { ...prev, picture: nextPicture as any };
    });
  }, [selectedFile, selectedFile?.metadata?.picture?.data, selectedFile?.metadata?.picture?.format]);

  useEffect(() => {
    if (!showFindModal) return;

    const currentAlbum = metadata?.album || '';
    const validFiles = files.filter(f => hasValidPicture(f.metadata?.picture));
    const sameAlbumFiles = validFiles.filter(f => f.name !== selectedFile?.name && f.metadata?.album === currentAlbum);
    const otherFiles = validFiles.filter(f => f.name !== selectedFile?.name && f.metadata?.album !== currentAlbum);

    debugCover('[Select Cover] modal opened', {
      totalFiles: files.length,
      validCoverFiles: validFiles.length,
      sameAlbum: sameAlbumFiles.length,
      otherCovers: otherFiles.length,
      selected: selectedFile?.name,
      album: currentAlbum,
      filter: findFilter,
    });
  }, [showFindModal, files, metadata?.album, selectedFile?.name, findFilter]);

  const getDisplayedImageBounds = () => {
    const container = cropContainerRef.current;
    const img = cropImageRef.current;
    if (!container || !img) return null;
    const c = container.getBoundingClientRect();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) return null;

    const scale = Math.min(c.width / naturalW, c.height / naturalH);
    const width = naturalW * scale;
    const height = naturalH * scale;
    return {
      x: (c.width - width) / 2,
      y: (c.height - height) / 2,
      width,
      height,
    };
  };

  useEffect(() => {
    if (!showCropModal || !cropImageUrl || !cropImageReady) return;
    const container = cropContainerRef.current;
    const img = cropImageRef.current;
    if (!container || !img) return;

    const initRectFromImage = () => {
      const bounds = getDisplayedImageBounds();
      if (!bounds) return;
      const { width, height, x: left, y: top } = bounds;
      const w = Math.max(120, Math.round(width * 0.55));
      const h = Math.max(120, Math.round(height * 0.55));
      setCropRect({
        x: left + Math.max(0, (width - w) / 2),
        y: top + Math.max(0, (height - h) / 2),
        width: w,
        height: h,
      });
    };

    if (img.complete) initRectFromImage();
    else {
      const onLoad = () => initRectFromImage();
      img.addEventListener('load', onLoad, { once: true });
      return () => img.removeEventListener('load', onLoad);
    }
  }, [showCropModal, cropImageUrl, cropImageReady]);

  useEffect(() => {
    if (!cropAction) return;
    const minSize = 60;

    const clampToBounds = (rect: { x: number; y: number; width: number; height: number }) => {
      const bounds = getDisplayedImageBounds();
      if (!bounds) return rect;
      const snap = 8;
      let { x, y, width, height } = rect;
      width = Math.max(minSize, width);
      height = Math.max(minSize, height);

      const right = x + width;
      const bottom = y + height;
      const boundsRight = bounds.x + bounds.width;
      const boundsBottom = bounds.y + bounds.height;

      if (Math.abs(x - bounds.x) <= snap) x = bounds.x;
      if (Math.abs(y - bounds.y) <= snap) y = bounds.y;
      if (Math.abs(right - boundsRight) <= snap) x = boundsRight - width;
      if (Math.abs(bottom - boundsBottom) <= snap) y = boundsBottom - height;

      if (x < bounds.x) x = bounds.x;
      if (y < bounds.y) y = bounds.y;
      if (x + width > bounds.x + bounds.width) x = bounds.x + bounds.width - width;
      if (y + height > bounds.y + bounds.height) y = bounds.y + bounds.height - height;
      if (width > bounds.width) width = bounds.width;
      if (height > bounds.height) height = bounds.height;
      return { x, y, width, height };
    };

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - cropAction.startX;
      const dy = e.clientY - cropAction.startY;
      const start = cropAction.startRect;
      let next = { ...start };

      if (cropAction.type === 'move') {
        next = { ...start, x: start.x + dx, y: start.y + dy };
      }
      if (cropAction.type !== 'move') {
        const bounds = getDisplayedImageBounds();
        if (!bounds) return;

        const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

        const applyFree = () => {
          const right = start.x + start.width;
          const bottom = start.y + start.height;
          if (cropAction.type === 'nw') {
            const x = clamp(start.x + dx, bounds.x, right - minSize);
            const y = clamp(start.y + dy, bounds.y, bottom - minSize);
            next = { x, y, width: right - x, height: bottom - y };
          } else if (cropAction.type === 'ne') {
            const x = clamp(start.x, bounds.x, right - minSize);
            const y = clamp(start.y + dy, bounds.y, bottom - minSize);
            next = { x, y, width: clamp(start.width + dx, minSize, bounds.width), height: bottom - y };
          } else if (cropAction.type === 'sw') {
            const x = clamp(start.x + dx, bounds.x, right - minSize);
            const y = clamp(start.y, bounds.y, bottom - minSize);
            next = { x, y, width: right - x, height: clamp(start.height + dy, minSize, bounds.height) };
          } else if (cropAction.type === 'se') {
            const x = clamp(start.x, bounds.x, right - minSize);
            const y = clamp(start.y, bounds.y, bottom - minSize);
            next = { x, y, width: clamp(start.width + dx, minSize, bounds.width), height: clamp(start.height + dy, minSize, bounds.height) };
          }
        };

        const applyRatio = () => {
          const ratio = cropAspect || 1;
          const right = start.x + start.width;
          const bottom = start.y + start.height;

          const maxWidthFromBounds = (maxX: number, maxY: number) => Math.min(
            maxX,
            maxY * ratio
          );

          if (cropAction.type === 'nw') {
            const rawWidth = start.width - dx;
            const maxWidth = maxWidthFromBounds(right - bounds.x, bottom - bounds.y);
            const width = clamp(rawWidth, minSize, maxWidth);
            const height = width / ratio;
            next = { x: right - width, y: bottom - height, width, height };
          } else if (cropAction.type === 'ne') {
            const rawWidth = start.width + dx;
            const maxWidth = maxWidthFromBounds(bounds.x + bounds.width - start.x, bottom - bounds.y);
            const width = clamp(rawWidth, minSize, maxWidth);
            const height = width / ratio;
            next = { x: start.x, y: bottom - height, width, height };
          } else if (cropAction.type === 'sw') {
            const rawWidth = start.width - dx;
            const maxWidth = maxWidthFromBounds(right - bounds.x, start.y + start.height - bounds.y);
            const width = clamp(rawWidth, minSize, maxWidth);
            const height = width / ratio;
            next = { x: right - width, y: start.y, width, height };
          } else if (cropAction.type === 'se') {
            const rawWidth = start.width + dx;
            const maxWidth = maxWidthFromBounds(bounds.x + bounds.width - start.x, bounds.y + bounds.height - start.y);
            const width = clamp(rawWidth, minSize, maxWidth);
            const height = width / ratio;
            next = { x: start.x, y: start.y, width, height };
          }
        };

        if (cropAspect) applyRatio();
        else applyFree();
      }

      if (next.width < minSize) {
        if (cropAction.type === 'nw' || cropAction.type === 'sw') next.x = start.x + (start.width - minSize);
        next.width = minSize;
      }
      if (next.height < minSize) {
        if (cropAction.type === 'nw' || cropAction.type === 'ne') next.y = start.y + (start.height - minSize);
        next.height = minSize;
      }

      setCropRect(clampToBounds(next));
    };

    const onUp = () => setCropAction(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cropAction, cropAspect]);

  useEffect(() => {
    if (!showCropModal || !cropAspect) return;
    const container = cropContainerRef.current;
    const img = cropImageRef.current;
    if (!container || !img) return;
    const bounds = getDisplayedImageBounds();
    if (!bounds) return;

    const centerX = cropRect.x + cropRect.width / 2;
    const centerY = cropRect.y + cropRect.height / 2;
    let width = cropRect.width;
    let height = width / cropAspect;
    if (height > bounds.height) {
      height = bounds.height;
      width = height * cropAspect;
    }
    if (width > bounds.width) {
      width = bounds.width;
      height = width / cropAspect;
    }
    const x = Math.min(Math.max(bounds.x, centerX - width / 2), bounds.x + bounds.width - width);
    const y = Math.min(Math.max(bounds.y, centerY - height / 2), bounds.y + bounds.height - height);
    setCropRect({ x, y, width, height });
  }, [cropAspect, showCropModal]);

  return (
    <div className="relative flex h-full flex-col space-y-6" onMouseMove={(e) => { if (isDragging) setLeftWidth(e.clientX - 20) }} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
      <div className="flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open a music folder, inspect tracks, and apply metadata changes without leaving the browser.</p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowShortcuts(true)}
            className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card/85 px-3 py-2 text-sm font-medium text-muted-foreground shadow-[var(--panel-shadow)] transition-[transform,background-color,color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground sm:flex"
          >
            <Keyboard size={16} /> Shortcuts
          </button>

          {folderHandle && (
            <button
              onClick={() => setShowColumnConfig(!showColumnConfig)}
              className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/85 px-3 py-2 text-sm font-medium text-muted-foreground shadow-[var(--panel-shadow)] transition-[transform,background-color,color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
            >
              <Settings2 size={16} /> Columns
            </button>
          )}

          {showColumnConfig && (
            <div className="panel absolute right-0 top-12 z-50 w-52 rounded-xl p-2 sm:right-32">
              <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 px-2">Show Columns</div>
              {COLUMNS.map(col => (
                <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/80">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns[col.key]}
                    onChange={() => toggleColumn(col.key)}
                    className="rounded-md"
                  />
                  <span className="text-sm">{col.label}</span>
                </label>
              ))}
            </div>
          )}

          {folderHandle && (
            <button title="Shortcut: CTRL+O"
              onClick={handleOpenFolder}
              className="rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)]"
            >
              Change Folder
            </button>
          )}
        </div>
      </div>

      {!folderHandle ? (
        <div className="panel-strong flex flex-1 flex-col items-center justify-center rounded-2xl p-8 text-center">
          <h3 className="text-lg font-medium text-card-foreground">No folder selected</h3>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Open a folder to start editing metadata.
          </p>
          <button title="Shortcut: CTRL+O"
            onClick={handleOpenFolder}
            className="rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 font-semibold text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)]"
          >
            Open Folder
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView('tracks')}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${mobileView === 'tracks'
                ? 'border-primary/40 bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]'
                : 'border-border/70 bg-card/85 text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground'
                }`}
            >
              Tracks
            </button>
            <button
              type="button"
              onClick={() => setMobileView('details')}
              disabled={!selectedFile}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mobileView === 'details'
                ? 'border-primary/40 bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] text-primary-foreground shadow-[var(--panel-shadow)]'
                : 'border-border/70 bg-card/85 text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground'
                }`}
            >
              Details
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
            <div className="panel-strong flex h-full w-full overflow-hidden rounded-2xl text-sm">

              <div className="flex h-full w-full flex-col lg:flex-row">
                {/* Left Panel: CSV-like Table */}
                <div
                  className={`order-2 h-full w-full shrink-0 flex-col overflow-hidden border-b border-border/70 bg-background/80 lg:order-1 lg:border-b-0 lg:border-r lg:w-[var(--library-pane-width)] ${mobileView === 'details' ? 'hidden lg:flex' : 'flex'}`}
                  style={{ ['--library-pane-width' as any]: `${Math.max(250, leftWidth)}px` } as React.CSSProperties}
                >
                  <div className="flex h-full flex-col">
                    <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-muted/35 p-3 text-xs font-semibold uppercase text-muted-foreground select-none">
                      <div className="flex-1 min-w-[200px] flex items-center gap-2 cursor-pointer hover:text-foreground" onClick={() => handleSort('filename')}>
                        <span title={folderHandle.name}>{folderHandle.name} ({files.length}) {getSortIcon('filename')}</span>
                      </div>
                      {!hiddenColumns['title'] && <div className="w-[120px] shrink-0 pl-2 border-l cursor-pointer hover:text-foreground" onClick={() => handleSort('title')}>Title {getSortIcon('title')}</div>}
                      {!hiddenColumns['artist'] && <div className="w-[120px] shrink-0 pl-2 border-l cursor-pointer hover:text-foreground" onClick={() => handleSort('artist')}>Artist {getSortIcon('artist')}</div>}
                      {!hiddenColumns['album'] && <div className="w-[120px] shrink-0 pl-2 border-l cursor-pointer hover:text-foreground" onClick={() => handleSort('album')}>Album {getSortIcon('album')}</div>}
                      {!hiddenColumns['genre'] && <div className="w-[100px] shrink-0 pl-2 border-l cursor-pointer hover:text-foreground" onClick={() => handleSort('genre')}>Genre {getSortIcon('genre')}</div>}
                      {!hiddenColumns['year'] && <div className="w-[60px] shrink-0 pl-2 border-l cursor-pointer hover:text-foreground" onClick={() => handleSort('year')}>Year {getSortIcon('year')}</div>}
                    </div>

                    <div className="flex-1 overflow-y-auto bg-background/70 p-1 isolate">
                      {isScanning ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Scanning...</div>
                      ) : sortedFiles.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No audio files found.</div>
                      ) : (
                        <>
                          <div className="space-y-2 lg:hidden">
                            {sortedFiles.map((file) => (
                              <button
                                key={file.path}
                                type="button"
                                onClick={() => handleSelectFile(file)}
                                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-[transform,background-color,color,box-shadow] ${selectedFile?.path === file.path
                                  ? 'border-primary/30 bg-[linear-gradient(135deg,hsl(var(--primary-color)/0.18),hsl(var(--accent-color)/0.12))] text-foreground shadow-[var(--panel-shadow)]'
                                  : file.isEdited
                                    ? 'border-border/70 bg-background/90 text-foreground hover:bg-accent/80'
                                    : 'border-border/70 bg-background/90 text-muted-foreground hover:bg-accent/80 hover:text-foreground'
                                  }`}
                              >
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted/30">
                                  <CoverThumb
                                    picture={file.metadata?.picture}
                                    alt={file.name + ' cover'}
                                    className="h-full w-full object-cover"
                                    onLoadError={() => removeInvalidPicture(file.path, 'library-mobile-list')}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        {file.isEdited ? (
                                          <CheckCircle2 size={14} className="shrink-0" style={{ color: "hsl(var(--success-color))" }} />
                                        ) : null}
                                        <span className="truncate text-sm font-semibold text-foreground">{file.name}</span>
                                      </div>
                                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{file.metadata?.artist || '-'}{file.metadata?.artist && file.metadata?.album ? ' • ' : ''}{file.metadata?.album || ''}</p>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{(file.metadata as any)?.year || file.metadata?.date?.substring(0, 4) || '-'}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                    {file.metadata?.title ? <span className="soft-pill">{file.metadata.title}</span> : null}
                                    {file.metadata?.genre ? <span className="soft-pill">{file.metadata.genre}</span> : null}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>

                          <div className="hidden space-y-0.5 lg:block">
                            {sortedFiles.map((file) => (
                              <div
                                key={file.path}
                                onClick={() => handleSelectFile(file)}
                                className={`group flex cursor-pointer items-center rounded-lg p-1.5 text-xs transition-[transform,background-color,color,box-shadow] ${selectedFile?.path === file.path
                                  ? 'bg-[linear-gradient(135deg,hsl(var(--primary-color)/0.18),hsl(var(--accent-color)/0.14))] text-foreground font-medium shadow-[var(--panel-shadow)]'
                                  : file.isEdited
                                    ? 'text-foreground hover:bg-accent/80'
                                    : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
                                  }`}
                              >
                                <div className="flex-1 min-w-[200px] truncate flex items-center gap-1.5">
                                  {file.isEdited ? (
                                    <CheckCircle2 size={14} className="shrink-0" style={{ color: "hsl(var(--success-color))" }} />
                                  ) : null}
                                  <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-muted/30 flex items-center justify-center mr-2">
                                    <CoverThumb
                                      picture={file.metadata?.picture}
                                      alt={file.name + ' cover'}
                                      className="w-full h-full object-cover"
                                      onLoadError={() => removeInvalidPicture(file.path, 'library-list')}
                                    />
                                  </div>
                                  <span className="truncate">{file.name}</span>
                                </div>
                                {!hiddenColumns['title'] && <div className="w-[120px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.title || '-'}</div>}
                                {!hiddenColumns['artist'] && <div className="w-[120px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.artist || '-'}</div>}
                                {!hiddenColumns['album'] && <div className="w-[120px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.album || '-'}</div>}
                                {!hiddenColumns['genre'] && <div className="w-[100px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.genre || '-'}</div>}
                                {!hiddenColumns['year'] && <div className="w-[60px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{(file.metadata as any)?.year || file.metadata?.date?.substring(0, 4) || '-'}</div>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`order-2 hidden w-2 shrink-0 cursor-col-resize flex-col items-center justify-center border-x border-border/70 bg-muted/45 transition-colors hover:bg-primary/20 select-none lg:flex ${mobileView === 'details' ? 'lg:flex' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
                >
                  <div className="h-10 w-1 rounded-full bg-border" />
                </div>

                {/* Right Panel: Editor */}
                <div className={`order-1 min-w-0 flex-1 flex-col overflow-y-auto bg-card/95 lg:order-3 ${mobileView === 'tracks' ? 'hidden lg:flex' : 'flex'}`}>
                  {!selectedFile ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                      Select a file to edit
                    </div>
                  ) : isReading ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                      Reading...
                    </div>
                  ) : metadata ? (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/70 bg-card/90 p-3 backdrop-blur-sm">
                        <div className="min-w-0 pr-4">
                          <h2 className="text-base font-semibold truncate bg-transparent border-none appearance-none" title={selectedFile.name}>{selectedFile.name}</h2>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedFile.path}</p>
                        </div>


                      </div>

                      <div className="flex-1 p-3 flex flex-col h-full min-h-0 lg:p-5">
                        <form onSubmit={handleSave} className="flex flex-col h-full min-h-0 mx-auto w-full max-w-none pb-2 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,400px)] xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,360px)] 2xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,420px)] 4xl:grid-cols-[minmax(0,1.6fr)_minmax(420px,580px)] lg:grid-rows-[auto,1fr] lg:gap-x-8 lg:gap-y-4 lg:h-auto">
                          <div className="flex flex-col flex-1 min-h-0 space-y-3">
                            <div className="space-y-1">
                              <label className="text-sm font-medium text-foreground">Title</label>
                              <input
                                type="text"
                                value={metadata.title || ''}
                                onChange={(e) => handleChange('title', e.target.value)}
                                className="w-full rounded-xl px-3 py-2"
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
                              <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Artist</label>
                                <input
                                  type="text"
                                  list="artists-list"
                                  value={metadata.artist || ''}
                                  onChange={(e) => handleChange('artist', e.target.value)}
                                  className="w-full rounded-xl px-3 py-2"
                                />
                                <datalist id="artists-list">
                                  {recentArtists.map(a => <option key={a} value={a} />)}
                                </datalist>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Album</label>
                                <input
                                  type="text"
                                  list="albums-list"
                                  value={metadata.album || ''}
                                  onChange={(e) => handleChange('album', e.target.value)}
                                  className="w-full rounded-xl px-3 py-2"
                                />
                                <datalist id="albums-list">
                                  {recentAlbums.map(a => <option key={a} value={a} />)}
                                </datalist>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
                              <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Year / Date</label>
                                <input
                                  type="text"
                                  value={metadata.date || ''}
                                  onChange={(e) => handleChange('date', e.target.value)}
                                  className="w-full rounded-xl px-3 py-2"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-sm font-medium text-foreground">Genre</label>
                                <input
                                  type="text"
                                  list="genres-list"
                                  value={metadata.genre || ''}
                                  onChange={(e) => handleChange('genre', e.target.value)}
                                  className="w-full rounded-xl px-3 py-2"
                                />
                                <datalist id="genres-list">
                                  {recentGenres.map(g => <option key={g} value={g} />)}
                                </datalist>
                              </div>
                            </div>

                            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-border/70 bg-card/95 pb-3 pt-3 shadow-[0_-10px_20px_-14px_rgba(15,23,42,0.28)] lg:static lg:mt-1.5 lg:border-t-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:shadow-none">
                              <button title="Shortcut: CTRL+S"
                                type="submit"
                                disabled={isSaving}
                                className="rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 font-semibold text-primary-foreground shadow-[var(--panel-shadow)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--panel-shadow-lg)] disabled:opacity-50"
                              >
                                {isSaving ? 'Saving...' : 'Save Metadata'}
                              </button>
                              <button
                                type="button"
                                title="Shortcut: Escape"
                                onClick={() => handleSelectFile(selectedFile)}
                                disabled={isSaving}
                                className="rounded-xl border border-border/70 bg-background/80 px-4 py-2 font-medium text-foreground shadow-[var(--panel-shadow)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-accent/80 disabled:opacity-50"
                              >
                                Discard
                              </button>
                              {saveMessage && (
                                <span className={`text-sm ${saveMessage.includes('Error') || saveMessage.includes('Failed') ? 'text-red-500' : ''}`} style={saveMessage.includes('Error') || saveMessage.includes('Failed') ? undefined : { color: "hsl(var(--success-color))" }}>
                                  {saveMessage}
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/30 p-3 shadow-[var(--panel-shadow)] flex flex-col flex-1 min-h-0 lg:mt-1.5 lg:overflow-hidden">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Current Name</p>
                                  <p className="max-w-full truncate text-sm font-mono">{selectedFile.name}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowRenamePanel((prev) => !prev)}
                                  className="rounded-lg border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent/80"
                                >
                                  {showRenamePanel ? 'Hide Rename Presets' : 'Show Rename Presets'}
                                </button>
                              </div>

                              {showRenamePanel && (
                                <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                                  <p className="text-xs text-muted-foreground uppercase font-semibold">Rename Presets</p>
                                  <div className="flex flex-col gap-2">
                                    {filenamePresets.map(preset => {
                                      const preview = getPreviewNameForPreset(preset.format);
                                      const isSame = preview === selectedFile.name;

                                      return (
                                        <div
                                          key={preset.id}
                                          className={`flex flex-col gap-2 rounded-xl border p-3 transition-[transform,background-color,border-color,box-shadow] ${isSame ? 'opacity-50 cursor-not-allowed bg-muted/50' : isSaving ? 'opacity-50 cursor-wait bg-background' : 'cursor-pointer bg-background/85 shadow-[var(--panel-shadow)] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/80 hover:shadow-[var(--panel-shadow-lg)]'}`}
                                          onClick={async () => {
                                            if (isSame || isSaving || !preview) return;

                                            try {
                                              setIsSaving(true);
                                              const hasPerm = await checkPermission(selectedFile.handle, true);
                                              if (!hasPerm) {
                                                setSaveMessage('Permission denied for rename.');
                                                setTimeout(() => setSaveMessage(null), 3000);
                                                return;
                                              }

                                              const ext = selectedFile.name.split('.').pop() || 'mp3';
                                              const newName = preview.endsWith(`.${ext}`) ? preview : `${preview}.${ext}`;
                                              const result = await (selectedFile.handle as any).moveAndRename(newName);
                                              if (result) {
                                                setSaveMessage(`Renamed to ${newName}`);
                                                setTimeout(() => setSaveMessage(null), 3000);
                                                const updated = { ...selectedFile, name: newName };
                                                setSelectedFile(updated);
                                                setFiles(files.map(file => file.path === selectedFile.path ? { ...file, name: newName } : file));
                                              }
                                            } catch (e) {
                                              console.error('Rename error', e);
                                              setSaveMessage('Rename failed.');
                                              setTimeout(() => setSaveMessage(null), 3000);
                                            } finally {
                                              setIsSaving(false);
                                            }
                                          }}
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium text-foreground">{preset.name}</span>
                                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{preset.format}</span>
                                          </div>
                                          <div className="truncate text-xs text-muted-foreground">{preset.format}</div>
                                          <div className="truncate font-mono text-xs" style={{ color: "hsl(var(--success-color))" }}>
                                            {preview}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3 border-t border-border/70 pt-3 lg:border-t-0 lg:pt-0">
                            <div className="text-sm font-medium text-foreground flex items-center justify-between gap-3">
                              <span>Cover Art</span>
                              <div className="flex flex-wrap items-center gap-1.5 shrink-0 isolate">
                                <button type="button" title="Use cover from an existing file in this folder (same album first)" className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground" onClick={() => setShowFindModal(true)}>
                                  <Search size={14} /> Find
                                </button>

                                <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground" title="Upload an image file">
                                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const arrayBuffer = await file.arrayBuffer();
                                    handleChange('picture', { format: file.type, data: arrayBuffer } as any);
                                  }} />
                                  <UploadCloud size={14} /> Upload
                                </label>

                                <button type="button" className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground" title="Add image from URL" onClick={async () => {
                                  const url = prompt("Enter image URL:");
                                  if (!url) return;
                                  try {
                                    const res = await fetch(url);
                                    const blob = await res.blob();
                                    const arrayBuffer = await blob.arrayBuffer();
                                    handleChange('picture', { format: blob.type || 'image/jpeg', data: arrayBuffer } as any);
                                  } catch (e) {
                                    alert('Failed to fetch image from URL. CORS might block this request. Try uploading instead.');
                                  }
                                }}>
                                  <LinkIcon size={14} /> URL
                                </button>

                                <button type="button" className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground" title="Paste image from clipboard" onClick={async () => {
                                  try {
                                    const picture = await readClipboardImage();
                                    if (!picture) {
                                      setSaveMessage('Error: No image found in the clipboard. Copy an image first.');
                                      setTimeout(() => setSaveMessage(null), 3000);
                                      return;
                                    }

                                    handleChange('picture', picture as any);
                                    if (selectedFile) {
                                      updateFileMetadata(selectedFile.path, { picture });
                                    }
                                    setSaveMessage('Pasted image from clipboard');
                                    setTimeout(() => setSaveMessage(null), 2000);
                                  } catch (e) {
                                    console.error('Error pasting image from clipboard', e);
                                    setSaveMessage('Error: Could not read an image from the clipboard.');
                                    setTimeout(() => setSaveMessage(null), 3000);
                                  }
                                }}>
                                  <Clipboard size={14} /> Paste
                                </button>
                              </div>
                            </div>
                            <div className="group relative flex aspect-square w-full max-w-[340px] items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-[var(--panel-shadow)] lg:max-w-none lg:aspect-[4/3] xl:aspect-square 2xl:aspect-[4/3] 4xl:aspect-video">
                              {hasValidPicture(metadata.picture) ? (
                                <>
                                  <CoverThumb
                                    picture={metadata.picture as any}
                                    alt="Cover"
                                    className="w-full h-full object-cover"
                                    onLoadError={() => removeInvalidPicture(selectedFile?.path, 'editor')}
                                  />
                                  <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button type="button" onClick={() => setShowCropModal(true)} className="rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground">Edit</button>
                                    <button type="button" onClick={() => {
                                      const obj = { ...metadata };
                                      delete obj.picture;
                                      setMetadata(obj as any);
                                    }} className="flex items-center gap-2 rounded-xl bg-red-500 px-3 py-1.5 text-sm font-medium text-white shadow-[var(--panel-shadow)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-red-600">
                                      <X size={16} /> Remove
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="text-muted-foreground flex flex-col items-center gap-2 opacity-50 p-3">
                                  <ImageIcon size={48} className="stroke-[1.5]" />
                                  <span className="text-sm font-medium">No Cover Art</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/82 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="panel-strong flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 p-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Keyboard size={20} /> Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="rounded-full p-1 transition-colors hover:bg-accent/80">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 tracking-wider">Navigation</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-border/50 pb-2 items-center"><span>Next Track</span><div className="space-x-1 flex"><kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">N</kbd> <span className="text-muted-foreground px-1">or</span> <kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">↓</kbd></div></div>
                  <div className="flex justify-between border-b border-border/50 pb-2 items-center"><span>Previous Track</span><div className="space-x-1 flex"><kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">P</kbd> <span className="text-muted-foreground px-1">or</span> <kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">↑</kbd></div></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 tracking-wider">Playback</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-border/50 pb-2 items-center"><span>Play / Pause</span><kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">Spacebar</kbd></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 tracking-wider">Actions</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-border/50 pb-2 items-center"><span>Show Shortcuts</span><kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">?</kbd></div>
                  <div className="flex justify-between border-b border-border/50 pb-2 items-center"><span>Open Folder</span><kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">Ctrl + O</kbd></div>
                  <div className="flex justify-between border-b border-border/50 pb-2 items-center"><span>Save Metadata</span><kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">Ctrl + S</kbd></div>
                  <div className="flex justify-between border-b border-border/50 pb-2 items-center"><span>Discard Changes</span><kbd className="bg-muted border shadow-sm px-2 py-0.5 rounded text-xs font-mono">Escape</kbd></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showFindModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/82 p-4 backdrop-blur-sm">
          <div className="panel-strong w-full max-w-4xl rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Select Cover</h3>
              <button onClick={() => setShowFindModal(false)} className="rounded-full p-1 transition-colors hover:bg-accent/80"><X size={18} /></button>
            </div>
            <div className="mb-3">
              <input type="text" placeholder="Filter filenames..." value={findFilter} onChange={(e) => setFindFilter(e.target.value)} className="w-full rounded-xl px-3 py-2" />
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-sm font-medium mb-2">Same album</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {files.filter(f => hasValidPicture(f.metadata?.picture) && f.name !== selectedFile?.name && (!findFilter || f.name.toLowerCase().includes(findFilter.toLowerCase())) && f.metadata?.album === metadata?.album).map(f => (
                    <div key={f.path} className="rounded-lg border p-2 flex flex-col items-center gap-2 min-w-0">
                      <div className="w-20 h-20 overflow-hidden rounded-md bg-muted/30">
                        <CoverThumb
                          picture={f.metadata?.picture}
                          alt={f.name + ' cover'}
                          className="w-full h-full object-cover"
                          onLoadError={() => removeInvalidPicture(f.path, 'find-same-album')}
                        />
                      </div>
                      <div className="text-[11px] leading-4 text-center line-clamp-2 w-full" title={f.name}>{f.name}</div>
                      <button onClick={() => applyCoverFromFile(f)} className="mt-1 rounded-md px-2 py-1 bg-background/80">Apply</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Other covers</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {files.filter(f => hasValidPicture(f.metadata?.picture) && f.name !== selectedFile?.name && (!findFilter || f.name.toLowerCase().includes(findFilter.toLowerCase())) && f.metadata?.album !== metadata?.album).map(f => (
                    <div key={f.path} className="rounded-lg border p-2 flex flex-col items-center gap-2 min-w-0">
                      <div className="w-16 h-16 overflow-hidden rounded-md bg-muted/30">
                        <CoverThumb
                          picture={f.metadata?.picture}
                          alt={f.name + ' cover'}
                          className="w-full h-full object-cover"
                          onLoadError={() => removeInvalidPicture(f.path, 'find-other-covers')}
                        />
                      </div>
                      <div className="text-[11px] leading-4 text-center line-clamp-2 w-full" title={f.name}>{f.name}</div>
                      <button onClick={() => applyCoverFromFile(f)} className="mt-1 rounded-md px-2 py-1 bg-background/80">Apply</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCropModal && hasValidPicture(metadata?.picture) && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card/95 rounded-2xl p-4 w-full max-w-4xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Edit Cover</h3>
              <button onClick={() => setShowCropModal(false)} className="rounded-full p-1 transition-colors hover:bg-accent/80"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Drag inside the frame to move it. Drag corners to resize and set any aspect ratio.</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Aspect ratio:</span>
                <button type="button" onClick={() => setCropAspect(null)} className={`rounded-md px-2 py-1 text-xs border ${cropAspect === null ? 'bg-accent/80 border-primary/40' : 'bg-background/70 border-border/70'}`}>Free</button>
                <button type="button" onClick={() => setCropAspect(1)} className={`rounded-md px-2 py-1 text-xs border ${cropAspect === 1 ? 'bg-accent/80 border-primary/40' : 'bg-background/70 border-border/70'}`}>1:1</button>
                <button type="button" onClick={() => setCropAspect(4 / 3)} className={`rounded-md px-2 py-1 text-xs border ${cropAspect === 4 / 3 ? 'bg-accent/80 border-primary/40' : 'bg-background/70 border-border/70'}`}>4:3</button>
                <button type="button" onClick={() => setCropAspect(16 / 9)} className={`rounded-md px-2 py-1 text-xs border ${cropAspect === 16 / 9 ? 'bg-accent/80 border-primary/40' : 'bg-background/70 border-border/70'}`}>16:9</button>
                <button type="button" onClick={() => setCropAspect(3 / 4)} className={`rounded-md px-2 py-1 text-xs border ${cropAspect === 3 / 4 ? 'bg-accent/80 border-primary/40' : 'bg-background/70 border-border/70'}`}>3:4</button>
                <button type="button" onClick={() => setCropAspect(9 / 16)} className={`rounded-md px-2 py-1 text-xs border ${cropAspect === 9 / 16 ? 'bg-accent/80 border-primary/40' : 'bg-background/70 border-border/70'}`}>9:16</button>
              </div>
              <div ref={(el) => (cropContainerRef.current = el)} className="relative h-[56vh] min-h-[340px] bg-muted/20 overflow-hidden rounded-lg border border-border/70">
                <img
                  ref={cropImageRef}
                  alt="crop-preview"
                  src={cropImageUrl || undefined}
                  className={`w-full h-full object-contain select-none pointer-events-none transition-opacity ${cropImageReady ? 'opacity-100' : 'opacity-0'}`}
                  draggable={false}
                  onLoad={() => setCropImageReady(true)}
                  onError={() => setCropImageReady(false)}
                />

                {!cropImageReady && cropImageUrl && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Loading cover...
                  </div>
                )}

                <div
                  className="absolute border-2 border-white/90 bg-black/10 cursor-move"
                  style={{ left: cropRect.x, top: cropRect.y, width: cropRect.width, height: cropRect.height }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setCropAction({ type: 'move', startX: e.clientX, startY: e.clientY, startRect: { ...cropRect } });
                  }}
                >
                  <div className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-white cursor-nwse-resize" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setCropAction({ type: 'nw', startX: e.clientX, startY: e.clientY, startRect: { ...cropRect } }); }} />
                  <div className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-white cursor-nesw-resize" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setCropAction({ type: 'ne', startX: e.clientX, startY: e.clientY, startRect: { ...cropRect } }); }} />
                  <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full bg-white cursor-nesw-resize" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setCropAction({ type: 'sw', startX: e.clientX, startY: e.clientY, startRect: { ...cropRect } }); }} />
                  <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full bg-white cursor-nwse-resize" onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setCropAction({ type: 'se', startX: e.clientX, startY: e.clientY, startRect: { ...cropRect } }); }} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={async () => {
                    try {
                      const container = cropContainerRef.current;
                      const imgEl = cropImageRef.current;
                      if (!container || !imgEl) return;

                      const imageBounds = getDisplayedImageBounds();
                      if (!imageBounds) return;

                      const clipX = Math.max(imageBounds.x, cropRect.x);
                      const clipY = Math.max(imageBounds.y, cropRect.y);
                      const clipW = Math.max(1, Math.min(imageBounds.x + imageBounds.width, cropRect.x + cropRect.width) - clipX);
                      const clipH = Math.max(1, Math.min(imageBounds.y + imageBounds.height, cropRect.y + cropRect.height) - clipY);

                      const naturalW = imgEl.naturalWidth;
                      const naturalH = imgEl.naturalHeight;

                      const sx = Math.max(0, ((clipX - imageBounds.x) / imageBounds.width) * naturalW);
                      const sy = Math.max(0, ((clipY - imageBounds.y) / imageBounds.height) * naturalH);
                      const sWidth = Math.max(1, (clipW / imageBounds.width) * naturalW);
                      const sHeight = Math.max(1, (clipH / imageBounds.height) * naturalH);

                      const srcX = Math.round(sx);
                      const srcY = Math.round(sy);
                      const srcW = Math.round(sWidth);
                      const srcH = Math.round(sHeight);

                      const canvas = document.createElement('canvas');
                      canvas.width = Math.max(1, srcW);
                      canvas.height = Math.max(1, srcH);
                      const ctx = canvas.getContext('2d');
                      if (!ctx) throw new Error('No canvas context');
                      ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);

                      const outFormat = metadata?.picture?.format || 'image/jpeg';
                      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, outFormat, 0.92));
                      if (!blob) throw new Error('Failed to create cropped image');

                      const arrayBuffer = await blob.arrayBuffer();
                      const newPic = { format: blob.type || outFormat, data: arrayBuffer };
                      handleChange('picture', newPic as any);
                      if (selectedFile) useAppStore.getState().updateFileMetadata(selectedFile.path, { picture: newPic });
                      setShowCropModal(false);
                      setSaveMessage('Cover crop applied');
                      setTimeout(() => setSaveMessage(null), 2000);
                    } catch (e) {
                      console.error('crop failed', e);
                      alert('Failed to crop image');
                    }
                  }}
                  className="rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-color)),hsl(var(--primary-dark)))] px-4 py-2 text-white"
                >
                  Apply
                </button>
                <button onClick={() => setShowCropModal(false)} className="rounded-xl border px-4 py-2">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
