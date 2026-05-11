import { describe, expect, it } from 'vitest';
import {
  computeAlbumArtistForAlbum,
  computeAlbumArtistsByAlbum,
  getAlbumArtistForFile,
  getTrackContributingArtists,
  shouldApplyAlbumArtist,
} from './albumArtists';

const files = [
  {
    path: 'a.mp3',
    name: 'a.mp3',
    metadata: {
      album: 'Alpha',
      artist: 'Singer A; Singer B',
      contributingArtists: 'Singer A; Singer B',
    },
  },
  {
    path: 'b.mp3',
    name: 'b.mp3',
    metadata: {
      album: 'Alpha',
      artist: 'Singer B; Singer C',
      contributingArtists: 'Singer B; Singer C',
    },
  },
  {
    path: 'c.mp3',
    name: 'c.mp3',
    metadata: {
      album: 'Beta',
      artist: 'Solo D',
    },
  },
] as any[];

describe('album artist helpers', () => {
  it('prefers contributingArtists over artist field', () => {
    const result = getTrackContributingArtists({
      artist: 'Fallback Artist',
      contributingArtists: 'Main One; Main Two',
    } as any);

    expect(result).toEqual(['Main One', 'Main Two']);
  });

  it('falls back to artist list split when contributingArtists is missing', () => {
    expect(getTrackContributingArtists({ artist: 'A; B; C' } as any)).toEqual(['A', 'B', 'C']);
  });

  it('computes album artist list with deduped order', () => {
    expect(computeAlbumArtistForAlbum(files as any, 'Alpha')).toBe('Singer A; Singer B; Singer C');
  });

  it('builds album artist map per album', () => {
    const map = computeAlbumArtistsByAlbum(files as any);

    expect(map.get('Alpha')).toBe('Singer A; Singer B; Singer C');
    expect(map.get('Beta')).toBe('Solo D');
  });

  it('computes album artist for a single file using album grouping', () => {
    expect(getAlbumArtistForFile(files as any, files[0] as any)).toBe('Singer A; Singer B; Singer C');
  });

  it('evaluates whether album artist should be applied', () => {
    expect(shouldApplyAlbumArtist('Old', 'New')).toBe(true);
    expect(shouldApplyAlbumArtist('Same', 'Same')).toBe(false);
    expect(shouldApplyAlbumArtist('Anything', '')).toBe(false);
  });
});
