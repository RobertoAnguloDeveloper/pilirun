import { describe, expect, it } from 'vitest';
import { CHARACTERS, mergeCharacters } from '../src/lib/worlds';

describe('editable built-in characters', () => {
  it('replaces a built-in by id while retaining custom characters exactly once', () => {
    const editedPili = { ...CHARACTERS[0], name: 'Conejito editable', scale: 0.85 };
    const custom = { id: 'custom', name: 'Custom', color: '#ffffff' };
    const merged = mergeCharacters(CHARACTERS, [editedPili, custom]);

    expect(merged).toHaveLength(CHARACTERS.length + 1);
    expect(merged.filter((character) => character.id === 'pili')).toEqual([editedPili]);
    expect(merged.at(-1)).toEqual(custom);
  });

  it('has Conejito as the only built-in character and removes Menta and Luna', () => {
    expect(CHARACTERS).toHaveLength(1);
    expect(CHARACTERS[0].id).toBe('pili');
    expect(CHARACTERS[0].name).toBe('Conejito');
    expect(CHARACTERS.find((c) => c.id === 'menta')).toBeUndefined();
    expect(CHARACTERS.find((c) => c.id === 'luna')).toBeUndefined();

    // Verify mergeCharacters strips legacy saved menta and luna
    const legacySaved = [
      { id: 'menta', name: 'Menta', color: '#82b79b' },
      { id: 'luna', name: 'Luna', color: '#b8a5d0' },
    ];
    const merged = mergeCharacters(CHARACTERS, legacySaved);
    expect(merged.some((c) => c.id === 'menta')).toBe(false);
    expect(merged.some((c) => c.id === 'luna')).toBe(false);
  });
});
