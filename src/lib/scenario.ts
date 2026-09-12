import type {
  ItemKind,
  Scenario,
  ScenarioAssetMeta,
  ScenarioLayer,
  ScenarioObject,
  Track,
  WorldId,
} from './types';
import { validateTrack, WORLDS } from './worlds';

export const MAX_SCENARIO_LAYERS = 12;
export const MAX_SCENARIO_OBJECTS = 400;
export const MAX_INTERACTIVE_OBJECTS = 200;
export const MAX_SCENARIO_ASSETS = 20;
export const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

export const ITEM_KINDS: ItemKind[] = [
  'log',
  'rock',
  'branch',
  'coin',
  'shield',
  'boost',
  'time',
  'spring',
  'ring',
];

const defaultLayer = (
  id: string,
  name: string,
  type: ScenarioLayer['type'],
  zIndex: number,
): ScenarioLayer => ({
  id,
  name,
  type,
  zIndex,
  visible: true,
  locked: false,
  parallaxSpeed: type === 'background' ? 0.15 : type === 'midground' ? 0.45 : 1,
  animated: false,
  animationSpeed: 20,
  animationDirection: 'left',
  objects: [],
});

export function createScenario(world: WorldId = 'forest'): Scenario {
  const id = crypto.randomUUID();
  return {
    schemaVersion: 1,
    id,
    name: 'Mi escenario fantástico',
    world,
    length: 9000,
    custom: true,
    updatedAt: Date.now(),
    layers: [
      defaultLayer(crypto.randomUUID(), 'Fondo', 'background', 0),
      defaultLayer(crypto.randomUUID(), 'Decoración', 'decoration', 10),
      defaultLayer(crypto.randomUUID(), 'Objetos jugables', 'obstacle', 20),
      defaultLayer(crypto.randomUUID(), 'Primer plano', 'foreground', 30),
    ],
  };
}

export function scenarioObjects(scenario: Scenario): ScenarioObject[] {
  return scenario.layers.flatMap((layer) => layer.objects);
}

export function scenarioAssetIds(scenario: Scenario): string[] {
  return [
    ...new Set(
      scenarioObjects(scenario)
        .filter((object) => object.visual.source === 'custom')
        .map((object) => (object.visual.source === 'custom' ? object.visual.assetId : ''))
        .filter(Boolean),
    ),
  ];
}

export function validateScenario(
  scenario: Scenario,
  assets: ScenarioAssetMeta[] = [],
): string | null {
  if (scenario.schemaVersion !== 1) return 'Esta versión del escenario no es compatible.';
  if (!scenario.name.trim() || scenario.name.trim().length > 40)
    return 'Ponle un nombre de hasta 40 caracteres.';
  if (!(scenario.world in WORLDS)) return 'Selecciona un mundo válido.';
  if (!Number.isFinite(scenario.length) || scenario.length < 3000 || scenario.length > 30000)
    return 'La distancia debe estar entre 300 y 3.000 metros.';
  if (!scenario.layers.length || scenario.layers.length > MAX_SCENARIO_LAYERS)
    return `Usa entre 1 y ${MAX_SCENARIO_LAYERS} capas.`;
  const layerIds = new Set<string>();
  const objectIds = new Set<string>();
  let objectCount = 0;
  let interactiveCount = 0;
  for (const layer of scenario.layers) {
    if (!layer.id || layerIds.has(layer.id)) return 'Cada capa necesita un identificador único.';
    layerIds.add(layer.id);
    if (!layer.name.trim() || layer.name.length > 30) return 'Pon nombres breves a las capas.';
    if (!Number.isFinite(layer.zIndex) || !Number.isFinite(layer.parallaxSpeed))
      return 'Revisa la profundidad de las capas.';
    for (const object of layer.objects) {
      objectCount++;
      if (!object.id || objectIds.has(object.id))
        return 'Cada objeto necesita un identificador único.';
      objectIds.add(object.id);
      if (object.layerId !== layer.id) return 'Hay un objeto fuera de su capa.';
      if (
        ![
          object.x,
          object.y,
          object.width,
          object.height,
          object.rotation,
          object.scale,
          object.laneOffset,
        ].every(Number.isFinite) ||
        object.x < 400 ||
        object.x > scenario.length - 150 ||
        object.y < 0 ||
        object.y > 600 ||
        object.width < 10 ||
        object.width > 600 ||
        object.height < 10 ||
        object.height > 600 ||
        object.scale < 0.25 ||
        object.scale > 4 ||
        object.laneOffset < -1 ||
        object.laneOffset > 1
      )
        return 'Hay un objeto fuera del área válida.';
      if (object.behavior !== 'decoration') {
        interactiveCount++;
        if (!ITEM_KINDS.includes(object.behavior)) return 'Hay un comportamiento no compatible.';
        if (object.laneOffset !== 0)
          return 'Los objetos jugables deben estar en el carril central.';
      }
      const propertyKeys = Object.keys(object.properties);
      if (
        propertyKeys.some((key) => !['opacity', 'material', 'health'].includes(key))
        || (object.properties.material !== undefined && !['wood', 'stone', 'indestructible'].includes(String(object.properties.material)))
        || (object.properties.health !== undefined && (typeof object.properties.health !== 'number' || !Number.isFinite(object.properties.health) || object.properties.health < 1 || object.properties.health > 10000)) ||
        (object.properties.opacity !== undefined &&
          (typeof object.properties.opacity !== 'number' ||
            object.properties.opacity < 0.1 ||
            object.properties.opacity > 1))
      )
        return 'Hay propiedades de objeto no compatibles.';
    }
  }
  if (objectCount > MAX_SCENARIO_OBJECTS)
    return `Usa un máximo de ${MAX_SCENARIO_OBJECTS} objetos.`;
  if (interactiveCount > MAX_INTERACTIVE_OBJECTS)
    return `Usa un máximo de ${MAX_INTERACTIVE_OBJECTS} objetos jugables.`;
  const assetIds = new Set(assets.map((asset) => asset.id));
  const requiredAssets = scenarioAssetIds(scenario);
  if (requiredAssets.length > MAX_SCENARIO_ASSETS)
    return `Usa un máximo de ${MAX_SCENARIO_ASSETS} imágenes personalizadas.`;
  if (assets.length && requiredAssets.some((id) => !assetIds.has(id)))
    return 'Falta una imagen personalizada del escenario.';
  return validateTrack(scenarioToTrack(scenario));
}

export function scenarioToTrack(scenario: Scenario): Track {
  return {
    id: `scenario:${scenario.id}`,
    scenarioId: scenario.id,
    name: scenario.name,
    world: scenario.world,
    length: scenario.length,
    custom: true,
    boss: scenario.boss,
    levelMusicId: scenario.levelMusicId,
    bossMusicId: scenario.bossMusicId,
    items: scenario.layers
      .flatMap((layer) =>
        layer.visible
          ? layer.objects
              .filter((object) => object.behavior !== 'decoration')
              .map((object) => ({
                id: object.id,
                x: object.x,
                y: object.y,
                width: object.width * object.scale,
                height: object.height * object.scale,
                kind: object.behavior as ItemKind,
                visual: object.visual,
                material: object.properties.material as import('./obstacles').ObstacleMaterial | undefined,
                health: object.properties.health as number | undefined,
              }))
          : [],
      )
      .sort((a, b) => a.x - b.x),
  };
}
