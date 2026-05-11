import { describe, expect, it } from 'vitest';
import { scanFilesForAudio } from './fsAccess';

describe('scanFilesForAudio', () => {
  it('keeps supported audio and playlist extensions', () => {
    const files = [
      new File(['a'], 'a.mp3'),
      new File(['a'], 'b.M4A'),
      new File(['a'], 'c.wav'),
      new File(['a'], 'd.flac'),
      new File(['a'], 'e.ogg'),
      new File(['a'], 'f.opus'),
      new File(['a'], 'g.aac'),
      new File(['a'], 'h.m3u'),
      new File(['a'], 'i.m3u8'),
      new File(['a'], 'notes.txt'),
      new File(['a'], 'cover.jpg'),
    ];

    const entries = scanFilesForAudio(files);
    const names = entries.map((entry) => entry.name);

    expect(names).toEqual([
      'a.mp3',
      'b.M4A',
      'c.wav',
      'd.flac',
      'e.ogg',
      'f.opus',
      'g.aac',
      'h.m3u',
      'i.m3u8',
    ]);
  });

  it('uses file name as path when webkitRelativePath is absent', () => {
    const entries = scanFilesForAudio([new File(['a'], 'track.mp3')]);

    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('track.mp3');
    expect(entries[0].name).toBe('track.mp3');
    expect(entries[0].file).toBeInstanceOf(File);
  });
});
