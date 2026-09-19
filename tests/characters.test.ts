import { describe, expect, it } from 'vitest';
import { CHARACTERS, mergeCharacters } from '../src/lib/worlds';

describe('editable built-in characters', () => {
  it('replaces a built-in by id while retaining custom characters exactly once', () => {
    const editedPili = { ...CHARACTERS[0], name: 'Pili editable', scale: 0.85 };
    const custom = { id: 'custom', name: 'Custom', color: '#ffffff' };
    const merged = mergeCharacters(CHARACTERS, [editedPili, custom]);

    expect(merged).toHaveLength(CHARACTERS.length + 1);
    expect(merged.filter((character) => character.id === 'pili')).toEqual([editedPili]);
    expect(merged.at(-1)).toEqual(custom);
  });

  it('provides Luna with default starter pixel art', () => {
    const luna = CHARACTERS.find((c) => c.id === 'luna');
    expect(luna).toBeDefined();
    expect(luna?.pixels).toBeDefined();
    expect(luna?.pixels).toHaveLength(256);
    expect(luna?.pixels?.filter((p) => p !== 'transparent').length).toBeGreaterThan(20);
  });
});
