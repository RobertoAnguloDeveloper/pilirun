'use client';
import { useEffect, useRef } from 'react';
import { drawLandscape, drawFox } from '@/game/renderer';
import type { Character, Track } from '@/lib/types';

export function BackgroundRunner({
  track,
  character,
  reduced,
}: {
  track: Track;
  character: Character;
  reduced: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let frameId = 0;
    let distance = 0;
    let lastTime = performance.now();
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener('resize', resize);
    resize();

    // Prepare custom character image and animated run frames
    let avatarImg: HTMLImageElement | null = null;
    const runFrames: HTMLImageElement[] = [];
    if (character.frames?.run && character.frames.run.length > 0) {
      character.frames.run.forEach((src) => {
        const img = new Image();
        img.src = src;
        runFrames.push(img);
      });
    } else if (character.image) {
      avatarImg = new Image();
      avatarImg.src = character.image;
    }

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Ambient auto-run speed (smooth and scenic)
      const speed = reduced ? 140 : 250;
      distance += speed * dt;

      // Render world landscape seamlessly
      drawLandscape(ctx, width, height, track.world, distance);

      // Ground position
      const ground = height * 0.79;
      const baseScale = Math.min(1.4, Math.max(0.8, height / 520));
      const charScale = character.scale ?? 1.0;
      const scale = baseScale * charScale;
      const foxX = width * 0.22;
      const stride = distance * 0.05;
      const isJumping = false;
      const isSliding = false;

      // Character shadow right at ground line
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(foxX, ground, 28 * scale, 7 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Determine active sprite frame (multi-frame animation or single sprite)
      let activeImg = avatarImg;
      if (runFrames.length > 0) {
        const frameIdx = Math.floor(Math.abs(stride * 1.5)) % runFrames.length;
        if (runFrames[frameIdx]?.complete && runFrames[frameIdx].naturalWidth) {
          activeImg = runFrames[frameIdx];
        }
      }

      const spriteWidth = 60 * scale;
      const spriteHeight = 60 * scale;

      // Render character with seamless transparent rendering anchored at ground
      if (activeImg && activeImg.complete && activeImg.naturalWidth) {
        ctx.save();
        ctx.translate(foxX, ground);
        ctx.rotate(Math.sin(stride) * 0.035);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(activeImg, -spriteWidth / 2, -spriteHeight + 2 * scale, spriteWidth, spriteHeight);
        ctx.restore();
      } else if (character.pixels) {
        ctx.save();
        ctx.translate(foxX, ground);
        const unit = 3.8 * scale;
        character.pixels.forEach((c, i) => {
          if (c !== 'transparent') {
            ctx.fillStyle = c;
            ctx.fillRect(
              (i % 16) * unit - 30 * scale,
              Math.floor(i / 16) * unit - 60 * scale,
              unit + 0.2,
              unit + 0.2,
            );
          }
        });
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(foxX, ground - 28 * scale);
        drawFox(
          ctx,
          0,
          0,
          55 * scale,
          character.color,
          stride,
          false,
          isJumping,
          0,
          isSliding,
        );
        ctx.restore();
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameId);
    };
  }, [track, character, reduced]);

  return (
    <div className="game-bg-canvas-container" aria-hidden="true">
      <canvas ref={canvasRef} className="game-bg-canvas" />
      <div className="game-bg-overlay-vignette" />
    </div>
  );
}
