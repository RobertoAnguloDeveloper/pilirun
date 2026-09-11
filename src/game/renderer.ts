import { WORLDS } from '../lib/worlds';
import type { Character, WorldId } from '../lib/types';
import type { Simulation } from './simulation';
export function drawFox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  stride = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  // Geometric silhouette stays crisp at small sizes and avoids texture downloads.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, 21);
  ctx.quadraticCurveTo(-56, 22, -45, -10);
  ctx.lineTo(-29, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3d7';
  ctx.beginPath();
  ctx.moveTo(-45, -10);
  ctx.lineTo(-38, 13);
  ctx.lineTo(-30, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-3, 13, 23, 17, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-19 + Math.sin(stride) * 5, 22, 10, 14);
  ctx.fillRect(10 - Math.sin(stride) * 5, 21, 9, 15);
  ctx.beginPath();
  ctx.moveTo(-13, -12);
  ctx.lineTo(-13, -36);
  ctx.lineTo(0, -23);
  ctx.lineTo(16, -26);
  ctx.lineTo(28, -40);
  ctx.lineTo(30, -14);
  ctx.lineTo(39, -3);
  ctx.lineTo(23, 11);
  ctx.lineTo(-8, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#563f36';
  ctx.beginPath();
  ctx.moveTo(-9, -28);
  ctx.lineTo(-8, -14);
  ctx.lineTo(0, -20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(24, -31);
  ctx.lineTo(19, -21);
  ctx.lineTo(27, -18);
  ctx.fill();
  ctx.fillStyle = '#fff3d7';
  ctx.beginPath();
  ctx.moveTo(-7, -1);
  ctx.quadraticCurveTo(8, 14, 34, -5);
  ctx.lineTo(39, -3);
  ctx.lineTo(23, 11);
  ctx.lineTo(-8, 6);
  ctx.fill();
  ctx.fillStyle = '#243b32';
  ctx.fillRect(19, -13, 4, 5);
  ctx.beginPath();
  ctx.arc(36, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#315c49';
  ctx.fillRect(-10, 5, 33, 5);
  ctx.fillRect(-12, 8, 9, 15);
  ctx.restore();
}
export function drawLandscape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  world: WorldId,
  distance: number,
  reduced = false,
) {
  const palette = WORLDS[world],
    ground = height * 0.79;
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = world === 'night' ? '#efeaca' : '#f9f4cf';
  ctx.beginPath();
  ctx.arc(width * 0.75, height * 0.24, height * 0.09, 0, Math.PI * 2);
  ctx.fill();
  if (world === 'night') {
    ctx.fillStyle = '#dce6e8';
    for (let i = 0; i < 35; i++)
      ctx.fillRect((i * 117.7) % width, (i * 43.1) % (height * 0.53), 2, 2);
  } else {
    ctx.fillStyle = '#f4f7e8';
    for (let i = 0; i < 4; i++) {
      const x =
        ((((i * 263 - distance * (reduced ? 0 : 0.04)) % (width + 170)) + width + 170) %
          (width + 170)) -
        85;
      ctx.beginPath();
      ctx.ellipse(x, height * (0.18 + (i % 2) * 0.11), 54, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let layer = 0; layer < 3; layer++) {
    ctx.fillStyle =
      layer === 0 ? palette.mountain : layer === 1 ? palette.trees + '55' : palette.trees + '77';
    const drift = reduced ? 0 : distance * (0.08 + layer * 0.1),
      step = 330 - layer * 60;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    for (let x = -step; x <= width + step; x += step) {
      const px = x - (drift % step);
      ctx.lineTo(px, ground - height * (0.15 + layer * 0.03));
      ctx.quadraticCurveTo(
        px + step * 0.45,
        height * (0.23 + layer * 0.13),
        px + step,
        ground - height * (0.15 + layer * 0.03),
      );
    }
    ctx.lineTo(width + step, ground);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = palette.trees;
  for (let i = -1; i < width / 200 + 2; i++) {
    const x = i * 200 - (reduced ? 0 : (distance * 0.45) % 200),
      treeHeight = height * (0.28 + (Math.abs(i) % 3) * 0.05);
    if (world === 'sunset') {
      ctx.fillRect(x, ground - treeHeight * 0.6, 10, treeHeight * 0.6);
      ctx.beginPath();
      ctx.ellipse(x + 4, ground - treeHeight * 0.6, 34, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - 4, ground - treeHeight, 8, treeHeight);
      for (let j = 0; j < 3; j++) {
        const y = ground - treeHeight + j * treeHeight * 0.22;
        ctx.beginPath();
        ctx.moveTo(x, y - treeHeight * 0.22);
        ctx.lineTo(x - treeHeight * (0.2 + j * 0.06), y + treeHeight * 0.34);
        ctx.lineTo(x + treeHeight * (0.2 + j * 0.06), y + treeHeight * 0.34);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, ground, width, height - ground);
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(0, ground, width, 4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff15';
  for (let i = 0; i < 32; i++)
    ctx.fillRect(
      (((i * 73 - distance) % (width + 40)) + width + 40) % (width + 40),
      ground + 20 + (i % 4) * 15,
      12,
      3,
    );
}
export class Renderer {
  private image?: HTMLImageElement;
  constructor(
    private ctx: CanvasRenderingContext2D,
    private character: Character,
  ) {
    if (character.image) {
      this.image = new Image();
      this.image.src = character.image;
    }
  }
  render(game: Simulation, width: number, height: number, reduced: boolean) {
    const ctx = this.ctx,
      ground = height * 0.79,
      scale = Math.min(1, height / 430),
      px = width * 0.23;
    drawLandscape(ctx, width, height, game.track.world, game.distance, reduced);
    ctx.save();
    for (const item of game.track.items) {
      const x = px + (item.x - game.distance) * scale;
      if (x < -60 || x > width + 60 || game.consumed.has(item.id)) continue;
      ctx.save();
      ctx.translate(x, ground);
      ctx.scale(scale, scale);
      if (item.kind === 'coin') {
        ctx.fillStyle = '#ffe08a';
        ctx.beginPath();
        ctx.arc(0, -62, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b68b39';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#b68b39';
        ctx.fillRect(-1, -67, 2, 10);
      } else if (item.kind === 'log') {
        ctx.fillStyle = '#866248';
        ctx.fillRect(-24, -31, 48, 31);
        ctx.fillStyle = '#c39a6a';
        ctx.beginPath();
        ctx.ellipse(22, -15, 7, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#533e34';
        ctx.strokeRect(-24, -31, 48, 31);
      } else if (item.kind === 'rock') {
        ctx.fillStyle = '#95a49b';
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(-20, -31);
        ctx.lineTo(1, -47);
        ctx.lineTo(22, -32);
        ctx.lineTo(29, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c3ccc0';
        ctx.beginPath();
        ctx.moveTo(-20, -31);
        ctx.lineTo(1, -47);
        ctx.lineTo(8, -25);
        ctx.fill();
      } else if (item.kind === 'branch') {
        ctx.fillStyle = '#70533e';
        ctx.fillRect(-26, -85, 52, 38);
        ctx.fillStyle = '#76a565';
        ctx.beginPath();
        ctx.ellipse(0, -86, 36, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle =
          item.kind === 'shield' ? '#afdbef' : item.kind === 'boost' ? '#e5bafa' : '#d8f36a';
        ctx.beginPath();
        ctx.roundRect(-15, -85, 30, 30, 9);
        ctx.fill();
        ctx.fillStyle = '#274c3f';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.kind === 'shield' ? '◇' : item.kind === 'boost' ? 'ϟ' : '+', 0, -63);
      }
      ctx.restore();
    }
    const nextCheckpoint = (game.checkpoint + 1) * 3000;
    if (nextCheckpoint <= game.track.length) {
      const x = px + (nextCheckpoint - game.distance) * scale;
      if (x > -40 && x < width + 40) {
        ctx.strokeStyle = '#e5efc6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, ground);
        ctx.lineTo(x, ground - 100 * scale);
        ctx.stroke();
        ctx.fillStyle = '#d8f36a';
        ctx.fillRect(x, ground - 100 * scale, 38 * scale, 22 * scale);
      }
    }
    ctx.globalAlpha = game.hurt > 0 && Math.floor(game.hurt * 12) % 2 ? 0.4 : 1;
    ctx.translate(px, ground - game.height * scale - (game.slide > 0 ? 16 : 31) * scale);
    if (game.slide > 0) ctx.scale(1.15, 0.55);
    if (game.shield > 0) {
      ctx.strokeStyle = '#bfe8fa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 47 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.image?.complete && this.image.naturalWidth) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-30 * scale, -30 * scale, 60 * scale, 60 * scale, 12);
      ctx.clip();
      ctx.drawImage(this.image, -30 * scale, -30 * scale, 60 * scale, 60 * scale);
      ctx.restore();
    } else if (this.character.pixels) {
      const unit = 4 * scale;
      this.character.pixels.forEach((c, i) => {
        if (c !== 'transparent') {
          ctx.fillStyle = c;
          ctx.fillRect(
            (i % 16) * unit - 32 * scale,
            Math.floor(i / 16) * unit - 32 * scale,
            unit + 0.2,
            unit + 0.2,
          );
        }
      });
    } else
      drawFox(ctx, 0, 0, 57 * scale, this.character.color, game.height ? 0 : game.distance * 0.045);
    ctx.restore();
  }
}
