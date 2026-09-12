import type {
  Scenario,
  ScenarioAsset,
  ScenarioAssetMeta,
  ScenarioLayer,
  ScenarioObject,
} from './types';
import {
  MAX_ARCHIVE_BYTES,
  MAX_SCENARIO_ASSETS,
  ITEM_KINDS,
  scenarioAssetIds,
  validateScenario,
} from './scenario';

interface ScenarioArchive {
  format: 'pilirun-scenario';
  version: 1;
  scenario: Scenario;
  assets: ScenarioAssetMeta[];
}

const mimeExtension: Record<ScenarioAssetMeta['mime'], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isScenarioObject(value: unknown): value is ScenarioObject {
  if (!isObject(value) || !isObject(value.visual)) return false;
  const visual = value.visual;
  const validVisual =
    (visual.source === 'builtin' &&
      hasOnlyKeys(visual, ['source', 'kind']) &&
      ITEM_KINDS.includes(visual.kind as never)) ||
    (visual.source === 'custom' &&
      hasOnlyKeys(visual, ['source', 'assetId', 'name']) &&
      typeof visual.assetId === 'string' &&
      typeof visual.name === 'string');
  return (
    hasOnlyKeys(value, [
      'id',
      'visual',
      'behavior',
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'scale',
      'laneOffset',
      'layerId',
      'properties',
    ]) &&
    validVisual &&
    typeof value.id === 'string' &&
    (value.behavior === 'decoration' || ITEM_KINDS.includes(value.behavior as never)) &&
    typeof value.layerId === 'string' &&
    ['x', 'y', 'width', 'height', 'rotation', 'scale', 'laneOffset'].every(
      (key) => typeof value[key] === 'number',
    ) &&
    isObject(value.properties)
  );
}

function isScenarioLayer(value: unknown): value is ScenarioLayer {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'id',
      'name',
      'type',
      'zIndex',
      'visible',
      'locked',
      'parallaxSpeed',
      'animated',
      'animationSpeed',
      'animationDirection',
      'objects',
    ]) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    ['background', 'midground', 'foreground', 'obstacle', 'decoration'].includes(
      String(value.type),
    ) &&
    typeof value.zIndex === 'number' &&
    typeof value.visible === 'boolean' &&
    typeof value.locked === 'boolean' &&
    typeof value.parallaxSpeed === 'number' &&
    typeof value.animated === 'boolean' &&
    typeof value.animationSpeed === 'number' &&
    ['left', 'right', 'up', 'down'].includes(String(value.animationDirection)) &&
    Array.isArray(value.objects) &&
    value.objects.every(isScenarioObject)
  );
}

function isScenario(value: unknown): value is Scenario {
  return (
    isObject(value) &&
    hasOnlyKeys(value, [
      'schemaVersion',
      'id',
      'name',
      'world',
      'length',
      'custom',
      'updatedAt',
      'layers',
    ]) &&
    value.schemaVersion === 1 &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    ['forest', 'sunset', 'night', 'neon', 'alpine', 'volcano'].includes(String(value.world)) &&
    typeof value.length === 'number' &&
    value.custom === true &&
    typeof value.updatedAt === 'number' &&
    Array.isArray(value.layers) &&
    value.layers.every(isScenarioLayer)
  );
}

function isAssetMeta(value: unknown): value is ScenarioAssetMeta {
  return (
    isObject(value) &&
    hasOnlyKeys(value, ['id', 'scenarioId', 'name', 'mime', 'width', 'height', 'size']) &&
    typeof value.id === 'string' &&
    typeof value.scenarioId === 'string' &&
    typeof value.name === 'string' &&
    ['image/png', 'image/jpeg', 'image/webp'].includes(String(value.mime)) &&
    typeof value.width === 'number' &&
    Number.isInteger(value.width) &&
    value.width > 0 &&
    value.width <= 1024 &&
    typeof value.height === 'number' &&
    Number.isInteger(value.height) &&
    value.height > 0 &&
    value.height <= 1024 &&
    typeof value.size === 'number' &&
    Number.isInteger(value.size) &&
    value.size > 0 &&
    value.size <= 1_250_000
  );
}

function hasExpectedSignature(bytes: Uint8Array, mime: ScenarioAssetMeta['mime']) {
  if (mime === 'image/png')
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    );
  if (mime === 'image/jpeg')
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  );
}

function safeName(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'escenario'
  );
}

export async function exportScenarioZip(scenario: Scenario, assets: ScenarioAsset[]) {
  const { default: JSZip } = await import('jszip');
  const error = validateScenario(scenario, assets);
  if (error) throw new Error(error);
  const zip = new JSZip();
  const metadata = assets
    .filter((asset) => scenarioAssetIds(scenario).includes(asset.id))
    .map(({ bytes: _bytes, ...meta }) => meta);
  const archive: ScenarioArchive = {
    format: 'pilirun-scenario',
    version: 1,
    scenario,
    assets: metadata,
  };
  zip.file('scenario.json', JSON.stringify(archive, null, 2));
  for (const asset of assets) {
    if (!scenarioAssetIds(scenario).includes(asset.id)) continue;
    zip.file(`assets/${asset.id}.${mimeExtension[asset.mime]}`, asset.bytes);
  }
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return { blob, filename: `${safeName(scenario.name)}.pilirun.zip` };
}

export async function importScenarioZip(
  file: File,
): Promise<{ scenario: Scenario; assets: ScenarioAsset[] }> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('El ZIP supera el límite de 25 MB.');
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file, { createFolders: false });
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (
    entries.some(
      (entry) =>
        entry.name.includes('..') || entry.name.startsWith('/') || entry.name.includes('\\'),
    )
  )
    throw new Error('El ZIP contiene rutas no permitidas.');
  const jsonEntry = zip.file('scenario.json');
  if (!jsonEntry) throw new Error('El ZIP no contiene scenario.json.');
  const raw = JSON.parse(await jsonEntry.async('string')) as unknown;
  if (
    !isObject(raw) ||
    !hasOnlyKeys(raw, ['format', 'version', 'scenario', 'assets']) ||
    raw.format !== 'pilirun-scenario' ||
    raw.version !== 1 ||
    !isScenario(raw.scenario)
  )
    throw new Error('El formato del escenario no es válido.');
  if (!Array.isArray(raw.assets) || raw.assets.length > MAX_SCENARIO_ASSETS)
    throw new Error(`El ZIP admite hasta ${MAX_SCENARIO_ASSETS} imágenes.`);
  if (!raw.assets.every(isAssetMeta)) throw new Error('Hay metadatos de imagen no válidos.');
  const sourceAssets = raw.assets;
  const requiredAssetIds = scenarioAssetIds(raw.scenario);
  const sourceAssetIds = new Set(sourceAssets.map((asset) => asset.id));
  if (
    sourceAssetIds.size !== sourceAssets.length ||
    requiredAssetIds.length !== sourceAssetIds.size ||
    requiredAssetIds.some((id) => !sourceAssetIds.has(id))
  )
    throw new Error('La lista de imágenes no coincide con los objetos del escenario.');
  const listedPaths = new Set([
    'scenario.json',
    ...sourceAssets.map((asset) => `assets/${asset.id}.${mimeExtension[asset.mime]}`),
  ]);
  if (
    entries.some((entry) => {
      const unsafeName = (entry as typeof entry & { unsafeOriginalName?: string })
        .unsafeOriginalName;
      return (unsafeName && unsafeName !== entry.name) || !listedPaths.has(entry.name);
    })
  )
    throw new Error('El ZIP contiene archivos o rutas no permitidos.');
  const newScenarioId = crypto.randomUUID();
  const assetIdMap = new Map(sourceAssets.map((asset) => [asset.id, crypto.randomUUID()]));
  let total = 0;
  const assets: ScenarioAsset[] = [];
  for (const meta of sourceAssets) {
    if (meta.scenarioId !== raw.scenario.id)
      throw new Error('Una imagen no pertenece al escenario importado.');
    const entry = zip.file(`assets/${meta.id}.${mimeExtension[meta.mime]}`);
    if (!entry) throw new Error(`Falta la imagen ${meta.name || meta.id}.`);
    const bytes = await entry.async('arraybuffer');
    total += bytes.byteLength;
    if (bytes.byteLength !== meta.size || bytes.byteLength > 1_250_000 || total > MAX_ARCHIVE_BYTES)
      throw new Error('Las imágenes del ZIP superan el límite permitido.');
    if (!hasExpectedSignature(new Uint8Array(bytes), meta.mime))
      throw new Error(`La imagen ${meta.name || meta.id} no coincide con su tipo declarado.`);
    const id = assetIdMap.get(meta.id)!;
    assets.push({ ...meta, id, scenarioId: newScenarioId, size: bytes.byteLength, bytes });
  }
  const scenario: Scenario = {
    ...raw.scenario,
    id: newScenarioId,
    name: `${raw.scenario.name} (copia)`.slice(0, 40),
    updatedAt: Date.now(),
    layers: raw.scenario.layers.map((layer) => {
      const layerId = crypto.randomUUID();
      return {
        ...layer,
        id: layerId,
        objects: layer.objects.map((object) => ({
          ...object,
          id: crypto.randomUUID(),
          layerId,
          visual:
            object.visual.source === 'custom'
              ? {
                  ...object.visual,
                  assetId: assetIdMap.get(object.visual.assetId) ?? object.visual.assetId,
                }
              : object.visual,
        })),
      };
    }),
  };
  const error = validateScenario(scenario, assets);
  if (error) throw new Error(error);
  return { scenario, assets };
}
