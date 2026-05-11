import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names and deduplicates Tailwind conflicts', () => {
    const result = cn('px-2 py-1 text-sm', 'px-4', false && 'hidden', 'font-medium');
    expect(result).toContain('px-4');
    expect(result).not.toContain('px-2');
    expect(result).toContain('py-1');
    expect(result).toContain('text-sm');
    expect(result).toContain('font-medium');
  });

  it('handles empty inputs safely', () => {
    expect(cn()).toBe('');
    expect(cn(undefined, null, false)).toBe('');
  });
});
