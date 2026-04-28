import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { AudioTags } from "../services/metadata";

export interface FileEntry {
  handle: FileSystemFileHandle;
  path: string;
  name: string;
  isEdited?: boolean;
  metadata?: Partial<AudioTags>;
}

export interface FilenamePreset {
  id: string;
  name: string;
  format: string;
}

interface AppState {
  folderHandle: FileSystemDirectoryHandle | null;
  files: FileEntry[];
  selectedFile: FileEntry | null;
  playingFile: FileEntry | null;
  isScanning: boolean;
  
  // Autocomplete tracking
  recentArtists: string[];
  recentAlbums: string[];
  recentGenres: string[];
  
  // Library View Settings
  hiddenColumns: Record<string, boolean>;
  toggleColumn: (col: string) => void;
  
  filenamePresets: FilenamePreset[];
  activePresetId: string;
  
  setFolderHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setFiles: (files: FileEntry[]) => void;
  setSelectedFile: (file: FileEntry | null) => void;
  setPlayingFile: (file: FileEntry | null) => void;
  setScanning: (isScanning: boolean) => void;
  addRecentMetadata: (tags: { artist?: string; album?: string; genre?: string }) => void;
  
  addFilenamePreset: (preset: FilenamePreset) => void;
  removeFilenamePreset: (id: string) => void;
  setActivePresetId: (id: string) => void;
  updateFilenamePreset: (id: string, preset: Partial<FilenamePreset>) => void;
  markFileAsEdited: (path: string) => void;
  updateFileMetadata: (path: string, metadata: FileEntry['metadata']) => void;
  
  clearState: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      folderHandle: null,
      files: [],
      selectedFile: null,
      playingFile: null,
      isScanning: false,
      recentArtists: [],
      recentAlbums: [],
      recentGenres: [],
      
      hiddenColumns: {},
      toggleColumn: (col) => set(state => ({
        hiddenColumns: { ...state.hiddenColumns, [col]: !state.hiddenColumns[col] }
      })),

      filenamePresets: [
        { id: 'music', name: 'Music', format: "{artist} - {title}" },
        { id: 'movies', name: 'Movie', format: "{album} - {artist} - {title}" }
      ],
      activePresetId: 'music',

      setFolderHandle: (handle) => set({ folderHandle: handle }),
      setFiles: (files) => set((state) => {
        // Retain isEdited status and cached metadata when files are re-scanned locally
        const oldFilesMap = new Map(state.files.map(f => [f.path, f]));
        const newFiles = files.map(f => {
          const old = oldFilesMap.get(f.path);
          return {
            ...f,
            isEdited: old?.isEdited || f.isEdited,
            metadata: old?.metadata || f.metadata
          };
        });
        return { files: newFiles };
      }),
      setSelectedFile: (selectedFile) => set((state) => {
        // Apply previously-cached metadata if selecting a file already cached
        const current = selectedFile ? state.files.find(f => f.path === selectedFile.path) : null;
        return { selectedFile: current || selectedFile };
      }),
      setPlayingFile: (playingFile) => set({ playingFile }),
      setScanning: (isScanning) => set({ isScanning }),
      addRecentMetadata: (tags) => set((state) => {
        const newArtists = new Set(state.recentArtists);
        const newAlbums = new Set(state.recentAlbums);
        const newGenres = new Set(state.recentGenres);
        
        if (tags.artist?.trim()) newArtists.add(tags.artist.trim());
        if (tags.album?.trim()) newAlbums.add(tags.album.trim());
        if (tags.genre?.trim()) newGenres.add(tags.genre.trim());
        
        return {
          recentArtists: Array.from(newArtists).sort(),
          recentAlbums: Array.from(newAlbums).sort(),
          recentGenres: Array.from(newGenres).sort(),
        };
      }),
      addFilenamePreset: (preset) => set((state) => ({ 
        filenamePresets: [...state.filenamePresets, preset] 
      })),
      removeFilenamePreset: (id) => set((state) => ({ 
        filenamePresets: state.filenamePresets.filter(p => p.id !== id),
        activePresetId: state.activePresetId === id && state.filenamePresets.length > 1 
          ? state.filenamePresets.find(p => p.id !== id)?.id || state.filenamePresets[0].id 
          : state.activePresetId
      })),
      setActivePresetId: (id) => set({ activePresetId: id }),
      updateFilenamePreset: (id, preset) => set((state) => ({
        filenamePresets: state.filenamePresets.map(p => p.id === id ? { ...p, ...preset } : p)
      })),
      markFileAsEdited: (path) => set((state) => ({
        files: state.files.map(f => f.path === path ? { ...f, isEdited: true } : f),
        selectedFile: state.selectedFile?.path === path ? { ...state.selectedFile, isEdited: true } : state.selectedFile
      })),
      updateFileMetadata: (path, metadata) => set((state) => ({
        files: state.files.map(f => f.path === path ? { ...f, metadata: { ...f.metadata, ...metadata } } : f),
        selectedFile: state.selectedFile?.path === path ? { ...state.selectedFile, metadata: { ...state.selectedFile.metadata, ...metadata } } : state.selectedFile
      })),
      clearState: () => set({ 
        folderHandle: null, 
        files: [], 
        selectedFile: null, 
        playingFile: null, 
        isScanning: false,
        recentArtists: [],
        recentAlbums: [],
        recentGenres: [],
        hiddenColumns: {}
      }),
    }),
    {
      name: 'metta-setter-storage',
      partialize: (state) => ({
        filenamePresets: state.filenamePresets,
        hiddenColumns: state.hiddenColumns,
        recentArtists: state.recentArtists,
        recentAlbums: state.recentAlbums,
        recentGenres: state.recentGenres,
      }),
    }
  )
);
