import { describe, expect, it } from 'vitest';
import {
  canReadMetadataForFileName,
  canWriteMetadataForFileName,
  getFormatLegendItems,
  isPlaylistFile,
  writeMetadata,
  type AudioTags,
} from './metadata';

const TAGS: AudioTags = {
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  albumArtist: 'Album Artist',
  contributingArtists: 'Artist A; Artist B',
  date: '2024',
  genre: 'Rock',
};

describe('metadata capability helpers', () => {
  it('marks MP3 as writable, M4A family as read-only', () => {
    expect(canWriteMetadataForFileName('track.mp3')).toBe(true);
    // M4A write is disabled: mp3tag.js uses incompatible ID3v2 tagging in MP4
    expect(canWriteMetadataForFileName('track.m4a')).toBe(false);
    expect(canWriteMetadataForFileName('track.m4b')).toBe(false);
    expect(canWriteMetadataForFileName('track.m4p')).toBe(false);
    // But M4A/M4B/M4P are readable
    expect(canReadMetadataForFileName('track.m4a')).toBe(true);
    expect(canReadMetadataForFileName('track.m4b')).toBe(true);
    expect(canReadMetadataForFileName('track.m4p')).toBe(true);
  });

  it('marks WAV/FLAC as read-only metadata', () => {
    expect(canReadMetadataForFileName('track.wav')).toBe(true);
    expect(canWriteMetadataForFileName('track.wav')).toBe(false);
    expect(canReadMetadataForFileName('track.flac')).toBe(true);
    expect(canWriteMetadataForFileName('track.flac')).toBe(false);
  });

  it('marks playlist files as playlist-only', () => {
    expect(isPlaylistFile('set.m3u')).toBe(true);
    expect(isPlaylistFile('set.m3u8')).toBe(true);
    expect(canReadMetadataForFileName('set.m3u')).toBe(false);
    expect(canWriteMetadataForFileName('set.m3u8')).toBe(false);
  });

  it('returns false for unknown extension capabilities', () => {
    expect(canReadMetadataForFileName('unknown.xyz')).toBe(false);
    expect(canWriteMetadataForFileName('unknown.xyz')).toBe(false);
    expect(isPlaylistFile('unknown.xyz')).toBe(false);
  });

  it('returns a sorted legend with key expected entries', () => {
    const legend = getFormatLegendItems();
    const extensions = legend.map((item) => item.extension);

    expect(extensions).toEqual([...extensions].sort());

    const mp3 = legend.find((item) => item.extension === 'mp3');
    const wav = legend.find((item) => item.extension === 'wav');
    const m3u = legend.find((item) => item.extension === 'm3u');

    expect(mp3).toEqual({
      extension: 'mp3',
      canReadMetadata: true,
      canWriteMetadata: true,
      playlistOnly: false,
    });

    expect(wav).toEqual({
      extension: 'wav',
      canReadMetadata: true,
      canWriteMetadata: false,
      playlistOnly: false,
    });

    expect(m3u).toEqual({
      extension: 'm3u',
      canReadMetadata: false,
      canWriteMetadata: false,
      playlistOnly: true,
    });
  });
});

describe('writeMetadata guard paths', () => {
  it('returns playlist error before attempting writes', async () => {
    const file = new File(['#EXTM3U'], 'list.m3u', { type: 'audio/x-mpegurl' });
    const result = await writeMetadata(file, {} as FileSystemFileHandle, TAGS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('playlist file');
  });

  it('returns read-only error for non-writable metadata formats', async () => {
    const file = new File(['RIFF'], 'track.wav', { type: 'audio/wav' });
    const result = await writeMetadata(file, {} as FileSystemFileHandle, TAGS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('read-only');
  });

  it('returns read-only error for unknown formats', async () => {
    const file = new File(['abc'], 'track.xyz', { type: 'application/octet-stream' });
    const result = await writeMetadata(file, {} as FileSystemFileHandle, TAGS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('read-only');
  });
});
