'use client';
import { frameScale, drawGroundedSprite, measureSprite, pixelBounds, PLAYER_HEIGHT, PLAYER_SLIDE_HEIGHT } from '@/lib/sprite-geometry';
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
export function Avatar({ character, size = 80, movement = 'run', frameIndex, showGround = false, previewZoom = 1 }: { character: Character; size?: number; movement?: keyof NonNullable<Character['frames']>; frameIndex?: number; showGround?: boolean; previewZoom?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const start = performance.now();
    let imgElement: HTMLImageElement | null = null;
    const runFrames: HTMLImageElement[] = [];
    let frameId: number;
    let lastValidImage: HTMLImageElement | null = null;
    let lastValidIndex = 0;
    if (character.frames?.[movement] && character.frames[movement]!.length > 0) {
      character.frames[movement]!.forEach((src) => {
        const img = new Image();
        img.onload = () => measureSprite(img);
        img.src = src;
        runFrames.push(img);
      });
    } else if (character.image) {
      imgElement = new Image();
      imgElement.onload = () => measureSprite(imgElement!);
      imgElement.src = character.image;
    }

    const bounds = character.pixels ? pixelBounds(character.pixels) : undefined;
    const renderFrame = (now: number) => {
      const elapsed = (now - start) / 1000;
      const breathe = Math.sin(elapsed * 3) * 2;
      ctx.clearRect(0, 0, 160, 160);

      // Determine active sprite frame (multi-frame animation or single image)
      let activeImg = lastValidImage ?? imgElement;
      let activeIndex = lastValidIndex;
      if (runFrames.length > 0) {
        const idx = frameIndex === undefined ? Math.floor(elapsed * 8) % runFrames.length : Math.min(frameIndex, runFrames.length - 1);
        if (runFrames[idx]?.complete && runFrames[idx].naturalWidth) {
          activeImg = runFrames[idx];
          activeIndex = idx;
          lastValidImage = activeImg;
          lastValidIndex = idx;
        }
      }

      const charScale = character.scale ?? 1.0;
      const displayHeight = 58 * charScale * (movement === 'slide' ? PLAYER_SLIDE_HEIGHT / PLAYER_HEIGHT : 1);
      if (showGround) {
        ctx.fillStyle = '#d8f36a';
        ctx.fillRect(0, 145, 160, 1);
      }
      ctx.save();
      ctx.translate(80, 145);
      ctx.scale(previewZoom, previewZoom);
      ctx.translate(-80, -145);

      if (activeImg) {
        if (activeImg.complete && activeImg.naturalWidth) {
          ctx.save();
          // Anchor ground at y = 145, bottom of feet touch the baseline
          ctx.translate(80, 145);
          ctx.imageSmoothingEnabled = false;
          drawGroundedSprite(ctx, activeImg, displayHeight * frameScale(character, movement, activeIndex),
            character.frameBaselines?.[activeImg.getAttribute('src')!]);
          ctx.restore();
        }
      } else if (character.pixels) {
        ctx.save();
        ctx.translate(80, 145);
        const unit = displayHeight / bounds!.height;
        character.pixels.forEach((color, i) => {
          if (color !== 'transparent') {
            ctx.fillStyle = color;
            ctx.fillRect(((i % 16) - bounds!.x - bounds!.width / 2) * unit,
              (Math.floor(i / 16) - bounds!.y - bounds!.height) * unit, unit, unit);
          }
        });
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(80, 145);
        ctx.scale(charScale, charScale);
        drawFox(ctx, 0, -32 + breathe, 90, character.color, elapsed * 2);
        ctx.restore();
      }

      ctx.restore();
      frameId = requestAnimationFrame(renderFrame);
    };

    frameId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(frameId);
      for (const image of runFrames) image.onload = null;
      if (imgElement) imgElement.onload = null;
    };
  }, [character, movement, frameIndex, showGround, previewZoom]);
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
