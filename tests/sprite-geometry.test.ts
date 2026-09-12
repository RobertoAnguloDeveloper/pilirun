import { describe, expect, it } from 'vitest';
import { alphaBounds, pixelBounds } from '../src/lib/sprite-geometry';

describe('sprite feet bounds', () => {
  it('excludes bottom padding and translucent shadows without discarding opaque feet', () => {
    const width = 12,
      height = 16,
      data = new Uint8Array(width * height * 4);
    for (let y = 2; y < 11; y++) for (let x = 3; x < 8; x++) data[(y * width + x) * 4 + 3] = 255;
    for (let x = 1; x < 11; x++) data[(12 * width + x) * 4 + 3] = 60;
    expect(alphaBounds(data, width, height)).toEqual({ x: 3, y: 2, width: 5, height: 9 });
  });
  it('anchors sparse pixel art to its last painted row', () => {
    const pixels = Array(256).fill('transparent');
    pixels[2 * 16 + 6] = '#ffffff';
    pixels[12 * 16 + 10] = '#ffffff';
    expect(pixelBounds(pixels)).toEqual({ x: 6, y: 2, width: 5, height: 11 });
  });
  it('keeps an empty frame finite', () => {
    expect(alphaBounds(new Uint8Array(64), 4, 4)).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });
});
