'use client';
import { useEffect, useRef } from 'react';
import { drawFox, drawLandscape } from '@/game/renderer';
import type { Character, WorldId } from '@/lib/types';
export function Landscape({
  world = 'forest',
  fox = false,
  className = '',
}: {
  world?: WorldId;
  fox?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const draw = () => {
      const rect = canvas.getBoundingClientRect(),
        ratio = Math.min(devicePixelRatio, 2);
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(ratio, ratio);
      drawLandscape(ctx, rect.width, rect.height, world, 0);
      if (fox) drawFox(ctx, rect.width * 0.72, rect.height * 0.79 - 35, 72, '#ec9565');
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [world, fox]);
  return <canvas ref={ref} aria-hidden="true" className={`landscape ${className}`} />;
}
export function Avatar({ character, size = 80 }: { character: Character; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, 160, 160);
    if (character.image) {
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, 160, 160);
        ctx.drawImage(image, 15, 15, 130, 130);
      };
      image.src = character.image;
      return () => {
        image.onload = null;
      };
    }
    if (character.pixels)
      character.pixels.forEach((color, i) => {
        if (color !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect((i % 16) * 8 + 16, Math.floor(i / 16) * 8 + 16, 8, 8);
        }
      });
    else drawFox(ctx, 88, 86, 110, character.color);
  }, [character]);
  return (
    <canvas
      ref={ref}
      width={160}
      height={160}
      style={{ width: size, height: size }}
      role="img"
      aria-label={character.name}
    />
  );
}
