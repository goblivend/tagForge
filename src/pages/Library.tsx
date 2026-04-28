import React, { useState, useEffect, useMemo } from "react";
import { useAppStore, FileEntry } from "../store";
import { openDirectory, scanDirectoryForAudio, checkPermission } from "../services/fsAccess";
import { readMetadata, writeMetadata, AudioTags } from "../services/metadata";

import { Settings2, CheckCircle2, Image as ImageIcon, UploadCloud, Link as LinkIcon, Keyboard, Search, X } from "lucide-react";

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

  const [leftWidth, setLeftWidth] = useState(400); // Draggable resizer width
  const [isDragging, setIsDragging] = useState(false);


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

  const handleOpenFolder = async () => {
    try {
      const handle = await openDirectory();
      if (!handle) return;
      
      setFolderHandle(handle);
      setScanning(true);
      setSelectedFile(null);
      setMetadata(null);
      
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

  const COLUMNS = [
    { key: "filename", label: "File" },
    { key: "title", label: "Title" },
    { key: "artist", label: "Artist" },
    { key: "album", label: "Album" },
    { key: "genre", label: "Genre" },
    { key: "year", label: "Year" }
  ];

  return (
    <div className="space-y-6 h-full flex flex-col relative" onMouseMove={(e) => { if(isDragging) setLeftWidth(e.clientX - 20) }} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open a music folder, inspect tracks, and apply metadata changes without leaving the browser.</p>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/85 px-3 py-2 text-sm font-medium text-muted-foreground shadow-[var(--panel-shadow)] transition-[transform,background-color,color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-accent-foreground"
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
            <div className="panel absolute right-32 top-12 z-50 w-52 rounded-xl p-2">
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
        <div className="flex flex-1 gap-6 min-h-0">
          <div className="panel-strong flex h-full w-full overflow-hidden rounded-2xl text-sm">
            
            <div className="flex h-full w-full">
                {/* Left Panel: CSV-like Table */}
                <div className="flex h-full shrink-0 flex-col overflow-hidden border-r border-border/70 bg-background/80" style={{ width: Math.max(250, leftWidth) + 'px' }}>
                  <div className="h-full flex flex-col">
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
                        <div className="space-y-0.5">
                          {sortedFiles.map((file) => (
                            <div 
                              key={file.path} 
                              onClick={() => handleSelectFile(file)}
                              className={`group flex cursor-pointer items-center rounded-lg p-1.5 text-xs transition-[transform,background-color,color,box-shadow] ${
                                selectedFile?.path === file.path 
                                  ? 'bg-[linear-gradient(135deg,hsl(var(--primary-color)/0.18),hsl(var(--accent-color)/0.14))] text-foreground font-medium shadow-[var(--panel-shadow)]' 
                                  : file.isEdited 
                                    ? 'text-foreground hover:bg-accent/80'
                                    : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground'
                              }`}
                            >
                              <div className="flex-1 min-w-[200px] truncate flex items-center gap-1.5">
                                {file.isEdited ? (
                                  <CheckCircle2 size={14} className="shrink-0" style={{ color: "hsl(var(--success-color))" }} />
                                ) : (
                                  <span className="w-3.5 h-3.5 inline-block shrink-0"></span> // spacer
                                )}
                                <span className="truncate">{file.name}</span>
                              </div>
                              {!hiddenColumns['title'] && <div className="w-[120px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.title || '-'}</div>}
                              {!hiddenColumns['artist'] && <div className="w-[120px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.artist || '-'}</div>}
                              {!hiddenColumns['album'] && <div className="w-[120px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.album || '-'}</div>}
                              {!hiddenColumns['genre'] && <div className="w-[100px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{file.metadata?.genre || '-'}</div>}
                              {!hiddenColumns['year'] && <div className="w-[60px] shrink-0 pl-2 border-l border-border/40 truncate opacity-70 group-hover:opacity-100 transition-opacity">{(file.metadata as any)?.year || file.metadata?.date?.substring(0,4) || '-'}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              <div 
                className="flex w-2 shrink-0 cursor-col-resize flex-col items-center justify-center border-x border-border/70 bg-muted/45 transition-colors hover:bg-primary/20 select-none"
                onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
              >
                <div className="h-10 w-1 rounded-full bg-border" />
              </div>

                {/* Right Panel: Editor */}
                <div className="flex h-full min-w-[300px] flex-1 flex-col overflow-y-auto bg-card/95">
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
                      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border/70 bg-card/90 p-4 backdrop-blur-sm">
                        <div className="min-w-0 pr-4">
                          <h2 className="text-base font-semibold truncate bg-transparent border-none appearance-none" title={selectedFile.name}>{selectedFile.name}</h2>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedFile.path}</p>
                        </div>
                        

                      </div>
                      
                      <div className="flex-1 p-4 pb-12 content-visibility-auto">
                        <form onSubmit={handleSave} className="mx-auto max-w-[500px] space-y-4 pb-4">
                          <div className="space-y-1.5">
                          <label className="text-sm font-medium text-foreground">Title</label>
                          <input 
                            type="text" 
                            value={metadata.title || ''}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className="w-full rounded-xl px-3 py-2"
                          />
                        </div>
                        
                        <div className="space-y-2">
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
                        
                        <div className="space-y-2">
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
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Year / Date</label>
                            <input 
                              type="text" 
                              value={metadata.date || ''}
                              onChange={(e) => handleChange('date', e.target.value)}
                              className="w-full rounded-xl px-3 py-2"
                            />
                          </div>
                          <div className="space-y-2">
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

                        <div className="space-y-4 border-t border-border/70 pt-4">
                          <label className="text-sm font-medium text-foreground flex items-center justify-between gap-4">
                            <span>Cover Art</span>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <button type="button" title="Use cover from an existing file in this folder (same album first)" className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground transition-[transform,background-color,color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-foreground" onClick={async () => {
                                 if (!metadata) return;
                                 const cachedSameAlbum = files.find(f => f.metadata?.album === metadata.album && f.metadata?.picture && f.name !== selectedFile?.name);
                                 if (cachedSameAlbum && cachedSameAlbum.metadata?.picture) {
                                   handleChange('picture', cachedSameAlbum.metadata.picture as any);
                                   return;
                                 }
                                 
                                 // Fallback to manual prompt
                                 const fileName = prompt('Enter exact filename in this folder to copy cover from (e.g. 01.mp3):');
                                 if (!fileName) return;
                                 const target = files.find(f => f.name.toLowerCase() === fileName.toLowerCase());
                                 if (target) {
                                    const domFile = await target.handle.getFile();
                                    const targetMeta = await readMetadata(domFile);
                                    if (targetMeta.picture) {
                                        handleChange('picture', targetMeta.picture as any);
                                    } else {
                                        alert('No cover found in that file.');
                                    }
                                 } else {
                                    alert('File not found in the current folder.');
                                 }
                              }}>
                                <Search size={14} /> Find
                              </button>
                              
                              <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground transition-[transform,background-color,color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-foreground" title="Upload an image file">
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                   const file = e.target.files?.[0];
                                   if(!file) return;
                                   const arrayBuffer = await file.arrayBuffer();
                                   handleChange('picture', { format: file.type, data: arrayBuffer } as any);
                                }} />
                                <UploadCloud size={14} /> Upload
                              </label>
                              
                              <button type="button" className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1 px-2 text-xs text-muted-foreground transition-[transform,background-color,color] hover:-translate-y-0.5 hover:bg-accent/80 hover:text-foreground" title="Add image from URL" onClick={async () => {
                                  const url = prompt("Enter image URL:");
                                  if (!url) return;
                                  try {
                                     const res = await fetch(url);
                                     const blob = await res.blob();
                                     const arrayBuffer = await blob.arrayBuffer();
                                     handleChange('picture', { format: blob.type || 'image/jpeg', data: arrayBuffer } as any);
                                  } catch(e) {
                                     alert('Failed to fetch image from URL. CORS might block this request. Try uploading instead.');
                                  }
                              }}>
                                <LinkIcon size={14} /> URL
                              </button>
                            </div>
                          </label>
                          <div className="group relative mb-4 flex aspect-square w-full max-w-[250px] items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/30 shadow-[var(--panel-shadow)]">
                              {metadata.picture ? (
                                 <>
                                   <img 
                                     src={URL.createObjectURL(new Blob([metadata.picture.data], { type: metadata.picture.format }))} 
                                     alt="Cover" 
                                     className="w-full h-full object-cover" 
                                     onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                                   />
                                   <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                                     <button type="button" onClick={() => {
                                        const obj = { ...metadata };
                                        delete obj.picture;
                                        setMetadata(obj as any);
                                     }} className="flex items-center gap-2 rounded-xl bg-red-500 px-3 py-1.5 text-sm font-medium text-white shadow-[var(--panel-shadow)] transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-red-600">
                                       <X size={16} /> Remove Cover
                                     </button>
                                   </div>
                                 </>
                              ) : (
                                 <div className="text-muted-foreground flex flex-col items-center gap-2 opacity-50 p-4">
                                   <ImageIcon size={48} className="stroke-[1.5]" />
                                   <span className="text-sm font-medium">No Cover Art</span>
                                 </div>
                              )}
                          </div>
                        </div>

                        <div className="sticky bottom-0 z-10 flex items-center gap-4 border-t border-border/70 bg-card/95 pb-4 pt-4 shadow-[0_-10px_20px_-14px_rgba(15,23,42,0.28)]">
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
                            <span className={`ml-2 text-sm ${saveMessage.includes('Error') || saveMessage.includes('Failed') ? 'text-red-500' : ''}`} style={saveMessage.includes('Error') || saveMessage.includes('Failed') ? undefined : { color: "hsl(var(--success-color))" }}>
                              {saveMessage}
                            </span>
                          )}
                        </div>
                      </form>

                      <div className="mx-auto mt-4 max-w-lg border-t border-border/70 pt-6">
                        <h3 className="text-md font-medium text-foreground mb-4">Rename File</h3>
                        <div className="space-y-4 rounded-2xl border border-border/80 bg-muted/30 p-4 shadow-[var(--panel-shadow)]">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Current Name</p>
                            <p className="text-sm font-mono truncate">{selectedFile.name}</p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground uppercase font-semibold">Rename Presets</p>
                            <div className="flex flex-col gap-2">
                            {filenamePresets.map(preset => {
                              const preview = getPreviewNameForPreset(preset.format);
                              const isSame = preview === selectedFile.name;
                              
                              return (
                                <div 
                                  key={preset.id} 
                                  className={`flex flex-col gap-2 rounded-xl border p-3 transition-[transform,background-color,border-color,box-shadow] ${
                                    isSame 
                                      ? 'opacity-50 cursor-not-allowed bg-muted/50' 
                                    : isSaving 
                                      ? 'opacity-50 cursor-wait bg-background' 
                                      : 'cursor-pointer bg-background/85 shadow-[var(--panel-shadow)] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/80 hover:shadow-[var(--panel-shadow-lg)]'
                                  }`}
                                  onClick={async () => {
                                    if (isSame || isSaving || !preview) return;
                                    
                                    try {
                                      setIsSaving(true);
                                      // @ts-ignore - 'move' is Chromium-specific but works in File System Access API
                                      if (typeof selectedFile.handle.move === 'function') {
                                        // @ts-ignore
                                        await selectedFile.handle.move(preview);
                                        
                                        // Re-scan folder to update tree locally
                                        if (folderHandle) {
                                          const foundFiles = await scanDirectoryForAudio(folderHandle);
                                          setFiles(foundFiles);
                                          
                                          // Re-select conceptually by fetching new entry
                                          const newEntry = foundFiles.find(f => f.name === preview);
                                          if (newEntry) {
                                            setSelectedFile(newEntry);
                                            if (false) {
                                               window.dispatchEvent(new CustomEvent('toggle-audio-play'));
                                            }
                                            useAppStore.getState().markFileAsEdited(newEntry.path);
                                          }
                                        }
                                        setSaveMessage('Renamed successfully!');
                                        setTimeout(() => setSaveMessage(null), 3000);
                                      } else {
                                        alert("Your browser does not support renaming files via FileSystemFileHandle.move(). Please use Chrome or Edge 105+.");
                                      }
                                    } catch (err) {
                                      console.error(err);
                                      alert("Failed to rename file. Make sure it isn't playing or opened in another program.");
                                    } finally {
                                      setIsSaving(false);
                                    }
                                  }}
                                >
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-semibold text-foreground/80">{preset.name}</span>
                                    <span className="text-muted-foreground font-mono text-[10px]">{preset.format}</span>
                                  </div>
                                  <div className="truncate text-sm font-mono" style={{ color: "hsl(var(--success-color))" }}>
                                    {preview}
                                  </div>
                                </div>
                              );
                            })}
                            </div>
                          </div>
                          <p className="text-xs text-center text-muted-foreground pt-1">You can change presets in Settings</p>
                        </div>
                      </div>
                      </div>
                    </div>
                  ) : null}
                </div>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/82 p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="panel-strong flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/35 p-4">
                 <h2 className="text-xl font-bold flex items-center gap-2"><Keyboard size={20}/> Keyboard Shortcuts</h2>
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
    </div>
  );
}
