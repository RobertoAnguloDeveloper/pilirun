import type { TrackItem } from './types';
import { POWERS, type PowerId } from './combat';
export type ObstacleMaterial = 'wood' | 'stone' | 'indestructible';
export function obstacleMaterial(item: TrackItem): ObstacleMaterial {
  return item.material ?? (item.kind === 'rock' ? 'stone' : ['branch', 'log'].includes(item.kind) ? 'wood' : 'indestructible');
}
export function obstacleHealth(item: TrackItem): number { return item.health ?? (item.kind === 'branch' ? 25 : item.kind === 'rock' ? 90 : 60); }
export function obstacleDamage(item: TrackItem, powerId: string): number {
  const material = obstacleMaterial(item);
  const allowed = material === 'wood' ? ['flame_burst', 'leaf_storm', 'thunder_dash', 'starlight_beam'] : material === 'stone' ? ['thunder_dash', 'starlight_beam'] : [];
  return allowed.includes(powerId) ? POWERS[powerId as PowerId].damage : 0;
}
/** Fraction along a swept projectile segment where it first meets an expanded AABB. */
export function segmentHit(x: number, y: number, nextX: number, nextY: number, left: number, right: number, bottom: number, top: number): number {
  let enter = 0, leave = 1;
  const dx = nextX - x, dy = nextY - y;
  if (dx === 0) { if (x < left || x > right) return Infinity; }
  else { const a = (left - x) / dx, b = (right - x) / dx; enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b)); }
  if (dy === 0) { if (y < bottom || y > top) return Infinity; }
  else { const a = (bottom - y) / dy, b = (top - y) / dy; enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b)); }
  return enter <= leave ? enter : Infinity;
}
