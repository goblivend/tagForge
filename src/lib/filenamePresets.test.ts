import { describe, expect, it } from 'vitest';
import {
  applyPresetFormat,
  findFirstMatchingPreset,
  findPresetByGeneratedName,
  getPreviewNameForPreset,
  getRenamedPathForFile,
  matchesPresetFormat,
  presetFormatToBaseNameRegex,
  sanitizePresetStem,
  splitFileName,
} from './filenamePresets';
import type { FilenamePreset } from '../store';

describe('filenamePresets', () => {
  const metadata = {
    artist: 'Metallica',
    title: 'One',
    album: '...And Justice for All',
    genre: 'Metal',
    date: '1988',
  };

  const presets: FilenamePreset[] = [
    { id: 'p1', name: 'Artist - Title', format: '{artist} - {title}' },
    { id: 'p2', name: 'Album - Artist - Title', format: '{album} - {artist} - {title}' },
  ];

  it('splits extension correctly', () => {
    expect(splitFileName('song.mp3')).toEqual({ basename: 'song', extension: 'mp3' });
    expect(splitFileName('song')).toEqual({ basename: 'song', extension: '' });
  });

  it('applies token replacements with metadata', () => {
    expect(applyPresetFormat('{artist} - {title}', metadata)).toBe('Metallica - One');
  });

  it('applies fallback values for missing fields', () => {
    expect(applyPresetFormat('{artist} - {title}', { artist: '', title: '' } as any)).toBe('Unknown Artist - Unknown Title');
  });

  it('sanitizes invalid filename characters', () => {
    expect(sanitizePresetStem(' A/B:C*D?E"F<G>H| ')).toBe('A_B_C_D_E_F_G_H_');
  });

  it('preserves original extension in generated preview name', () => {
    expect(getPreviewNameForPreset('{artist} - {title}', metadata, 'track.m4a')).toBe('Metallica - One.m4a');
  });

  it('rewrites path with preserved directory', () => {
    expect(getRenamedPathForFile('album/old.mp3', 'new.mp3')).toBe('album/new.mp3');
    expect(getRenamedPathForFile('old.mp3', 'new.mp3')).toBe('new.mp3');
  });

  it('builds regex from preset format and matches base names', () => {
    const regex = presetFormatToBaseNameRegex('{artist} - {title}');
    expect(regex.test('Metallica - One')).toBe(true);
    expect(regex.test('NotMatchingFormat')).toBe(false);
  });

  it('matches preset format against full file name', () => {
    expect(matchesPresetFormat('Metallica - One.mp3', '{artist} - {title}')).toBe(true);
    expect(matchesPresetFormat('Metallica_One.mp3', '{artist} - {title}')).toBe(false);
  });

  it('finds first matching preset', () => {
    expect(findFirstMatchingPreset('Metallica - One.mp3', presets)?.id).toBe('p1');
  });

  it('finds preset by exact generated file name and metadata', () => {
    const found = findPresetByGeneratedName('...And Justice for All - Metallica - One.mp3', metadata as any, presets);
    expect(found?.id).toBe('p2');
  });

  it('returns null when no preset matches', () => {
    expect(findFirstMatchingPreset('random-name.mp3', presets)).toBeNull();
    expect(findPresetByGeneratedName('random-name.mp3', metadata as any, presets)).toBeNull();
  });
});
