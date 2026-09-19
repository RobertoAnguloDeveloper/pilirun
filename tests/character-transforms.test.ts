import { describe, expect, it } from 'vitest';
import {
  rotatePixels90,
  flipPixelsH,
  flipPixelsV,
} from '../src/components/character-editor';

describe('Sprite transformations', () => {
  it('correctly rotates a 16x16 pixel array 90 degrees clockwise and 4 times back to origin', () => {
    const original = Array<string>(256).fill('transparent');
    // Set a pixel at row 0, col 5
    original[0 * 16 + 5] = '#ff0000';

    const rot90 = rotatePixels90(original, true);
    // After 90 deg clockwise, (r=0, c=5) becomes (r=5, c=15-0=15)
    expect(rot90[5 * 16 + 15]).toBe('#ff0000');
    expect(rot90[0 * 16 + 5]).toBe('transparent');

    const rot180 = rotatePixels90(rot90, true);
    const rot270 = rotatePixels90(rot180, true);
    const rot360 = rotatePixels90(rot270, true);

    expect(rot360).toEqual(original);
  });

  it('correctly rotates a 16x16 pixel array 90 degrees counter-clockwise', () => {
    const original = Array<string>(256).fill('transparent');
    original[2 * 16 + 4] = '#00ff00';

    const rotCCW = rotatePixels90(original, false);
    // After 90 deg counter-clockwise, (r=2, c=4) becomes (r=15-4=11, c=2)
    expect(rotCCW[11 * 16 + 2]).toBe('#00ff00');

    const back = rotatePixels90(rotCCW, true);
    expect(back).toEqual(original);
  });

  it('correctly flips a 16x16 pixel array horizontally', () => {
    const original = Array<string>(256).fill('transparent');
    original[3 * 16 + 2] = '#0000ff';

    const flipped = flipPixelsH(original);
    // (r=3, c=2) -> (r=3, c=15-2=13)
    expect(flipped[3 * 16 + 13]).toBe('#0000ff');
    expect(flipped[3 * 16 + 2]).toBe('transparent');

    const doubleFlipped = flipPixelsH(flipped);
    expect(doubleFlipped).toEqual(original);
  });

  it('correctly flips a 16x16 pixel array vertically', () => {
    const original = Array<string>(256).fill('transparent');
    original[2 * 16 + 7] = '#ffff00';

    const flipped = flipPixelsV(original);
    // (r=2, c=7) -> (r=15-2=13, c=7)
    expect(flipped[13 * 16 + 7]).toBe('#ffff00');
    expect(flipped[2 * 16 + 7]).toBe('transparent');

    const doubleFlipped = flipPixelsV(flipped);
    expect(doubleFlipped).toEqual(original);
  });
});
