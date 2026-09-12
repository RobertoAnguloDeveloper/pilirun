import type { WorldId } from './types';

export type TimeOfDay =
  | 'late_night'
  | 'dawn'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'sunset'
  | 'dusk'
  | 'night';

export interface TimePeriodDef {
  id: TimeOfDay;
  name: string;
  hourRange: [number, number]; // [startHour, endHour]
  skyTop: string;
  skyBottom: string;
  sunMoonType: 'sun' | 'moon';
  sunMoonAngle: number; // 0 to 180 degrees
  sunMoonColor: string;
  sunMoonGlow: string;
  sunMoonSize: number;
  starAlpha: number;
  ambientLight: number; // 0.2 (dark) to 1.0 (bright)
  fogColor: string;
  shadowDirection: number; // -1 (morning/east), 0 (zenith), 1 (evening/west)
  bonusDescription: string;
  solarModifier: number; // Multiplier for solar/fire powers
  lunarModifier: number; // Multiplier for cosmic/lunar powers
  energyRegenBonus: number; // Flat bonus to energy regen rate
}

export const TIME_PERIODS: Record<TimeOfDay, TimePeriodDef> = {
  late_night: {
    id: 'late_night',
    name: 'Madrugada Profunda',
    hourRange: [0, 5],
    skyTop: '#08091a',
    skyBottom: '#141c38',
    sunMoonType: 'moon',
    sunMoonAngle: 90,
    sunMoonColor: '#e2e8f0',
    sunMoonGlow: 'rgba(226, 232, 240, 0.4)',
    sunMoonSize: 32,
    starAlpha: 0.95,
    ambientLight: 0.45,
    fogColor: 'rgba(10, 15, 35, 0.65)',
    shadowDirection: 0,
    bonusDescription: 'Noche profunda: Poderes estelares y auras brillan con +25% de potencia.',
    solarModifier: 0.85,
    lunarModifier: 1.25,
    energyRegenBonus: 1.0,
  },
  dawn: {
    id: 'dawn',
    name: 'Amanecer',
    hourRange: [5, 7],
    skyTop: '#4a306d',
    skyBottom: '#fca5a5',
    sunMoonType: 'sun',
    sunMoonAngle: 20,
    sunMoonColor: '#fde047',
    sunMoonGlow: 'rgba(253, 224, 71, 0.5)',
    sunMoonSize: 36,
    starAlpha: 0.25,
    ambientLight: 0.75,
    fogColor: 'rgba(254, 205, 211, 0.4)',
    shadowDirection: -0.85,
    bonusDescription: 'Despertar de la naturaleza: La energía vital se regenera +20% más rápido.',
    solarModifier: 1.05,
    lunarModifier: 1.0,
    energyRegenBonus: 1.2,
  },
  morning: {
    id: 'morning',
    name: 'Mañana',
    hourRange: [7, 11.5],
    skyTop: '#38bdf8',
    skyBottom: '#bae6fd',
    sunMoonType: 'sun',
    sunMoonAngle: 55,
    sunMoonColor: '#fef08a',
    sunMoonGlow: 'rgba(254, 240, 138, 0.65)',
    sunMoonSize: 40,
    starAlpha: 0,
    ambientLight: 0.95,
    fogColor: 'rgba(224, 242, 254, 0.2)',
    shadowDirection: -0.5,
    bonusDescription: 'Luz matutina fresca: Claridad total y +10% de velocidad.',
    solarModifier: 1.15,
    lunarModifier: 0.9,
    energyRegenBonus: 1.1,
  },
  midday: {
    id: 'midday',
    name: 'Mediodía',
    hourRange: [11.5, 14],
    skyTop: '#0284c7',
    skyBottom: '#e0f2fe',
    sunMoonType: 'sun',
    sunMoonAngle: 90,
    sunMoonColor: '#ffffff',
    sunMoonGlow: 'rgba(255, 255, 255, 0.85)',
    sunMoonSize: 46,
    starAlpha: 0,
    ambientLight: 1.0,
    fogColor: 'rgba(255, 255, 255, 0.1)',
    shadowDirection: 0,
    bonusDescription: 'Cénit solar: Máximo poder solar y fuego (+20% de daño ígneo).',
    solarModifier: 1.2,
    lunarModifier: 0.85,
    energyRegenBonus: 1.0,
  },
  afternoon: {
    id: 'afternoon',
    name: 'Tarde',
    hourRange: [14, 17.5],
    skyTop: '#0ea5e9',
    skyBottom: '#fed7aa',
    sunMoonType: 'sun',
    sunMoonAngle: 125,
    sunMoonColor: '#fbbf24',
    sunMoonGlow: 'rgba(251, 191, 36, 0.6)',
    sunMoonSize: 42,
    starAlpha: 0,
    ambientLight: 0.9,
    fogColor: 'rgba(254, 215, 170, 0.25)',
    shadowDirection: 0.5,
    bonusDescription: 'Viento templado: Movimiento ágil y +15% de regeneración de energía.',
    solarModifier: 1.1,
    lunarModifier: 0.95,
    energyRegenBonus: 1.15,
  },
  sunset: {
    id: 'sunset',
    name: 'Atardecer (Ocaso)',
    hourRange: [17.5, 19],
    skyTop: '#b91c1c',
    skyBottom: '#fb923c',
    sunMoonType: 'sun',
    sunMoonAngle: 165,
    sunMoonColor: '#ea580c',
    sunMoonGlow: 'rgba(234, 88, 12, 0.75)',
    sunMoonSize: 48,
    starAlpha: 0.15,
    ambientLight: 0.8,
    fogColor: 'rgba(251, 146, 60, 0.4)',
    shadowDirection: 0.85,
    bonusDescription: 'Ocaso llameante: Ataques ígneos y de impacto causan +15% de daño.',
    solarModifier: 1.15,
    lunarModifier: 1.05,
    energyRegenBonus: 1.05,
  },
  dusk: {
    id: 'dusk',
    name: 'Crepúsculo',
    hourRange: [19, 20.5],
    skyTop: '#311042',
    skyBottom: '#6366f1',
    sunMoonType: 'moon',
    sunMoonAngle: 25,
    sunMoonColor: '#c7d2fe',
    sunMoonGlow: 'rgba(199, 210, 254, 0.5)',
    sunMoonSize: 34,
    starAlpha: 0.6,
    ambientLight: 0.65,
    fogColor: 'rgba(99, 102, 241, 0.35)',
    shadowDirection: -0.6,
    bonusDescription: 'Luz crepuscular: Equilibrio perfecto entre poderes solares y nocturnos.',
    solarModifier: 1.05,
    lunarModifier: 1.1,
    energyRegenBonus: 1.1,
  },
  night: {
    id: 'night',
    name: 'Noche',
    hourRange: [20.5, 24],
    skyTop: '#0f172a',
    skyBottom: '#1e1b4b',
    sunMoonType: 'moon',
    sunMoonAngle: 65,
    sunMoonColor: '#f1f5f9',
    sunMoonGlow: 'rgba(241, 245, 249, 0.55)',
    sunMoonSize: 36,
    starAlpha: 0.9,
    ambientLight: 0.5,
    fogColor: 'rgba(30, 27, 75, 0.55)',
    shadowDirection: -0.2,
    bonusDescription: 'Manto estelar: Escudos duran +20% y poderes cósmicos potenciados (+15%).',
    solarModifier: 0.9,
    lunarModifier: 1.2,
    energyRegenBonus: 1.05,
  },
};

/**
 * Determine TimeOfDay based on local hour (0.0 to 24.0)
 */
export function getTimeOfDayFromHour(hour: number): TimeOfDay {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 0 && h < 5) return 'late_night';
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 11.5) return 'morning';
  if (h >= 11.5 && h < 14) return 'midday';
  if (h >= 14 && h < 17.5) return 'afternoon';
  if (h >= 17.5 && h < 19) return 'sunset';
  if (h >= 19 && h < 20.5) return 'dusk';
  return 'night';
}

/**
 * Get the current local time of day from device clock
 */
export function getCurrentDeviceTimeOfDay(): { timeOfDay: TimeOfDay; currentHour: number } {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  return {
    timeOfDay: getTimeOfDayFromHour(currentHour),
    currentHour,
  };
}

/**
 * Interpolate RGB hex colors for smooth transitions
 */
export function interpolateColor(color1: string, color2: string, factor: number): string {
  const parseHex = (hex: string) => {
    const c = hex.replace('#', '');
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
  };
  const [r1, g1, b1] = parseHex(color1);
  const [r2, g2, b2] = parseHex(color2);
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}
