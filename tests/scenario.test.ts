import { describe, expect, it } from 'vitest';
import { Simulation, STEP } from '../src/game/simulation';
import {
  createScenario,
  scenarioAssetIds,
  scenarioToTrack,
  validateScenario,
} from '../src/lib/scenario';
import { exportScenarioZip, importScenarioZip } from '../src/lib/scenario-zip';
import type { ScenarioAsset, ScenarioObject } from '../src/lib/types';

function interactive(overrides: Partial<ScenarioObject> = {}): ScenarioObject {
  return {
    id: crypto.randomUUID(),
    visual: { source: 'builtin', kind: 'coin' },
    behavior: 'coin',
    x: 800,
    y: 80,
    width: 24,
    height: 24,
    rotation: 20,
    scale: 1.5,
    laneOffset: 0,
    layerId: '',
    properties: { opacity: 1 },
    ...overrides,
  };
}

describe('scenario contracts', () => {
  it('converts visible interactive objects while preserving identity and geometry', () => {
    const scenario = createScenario();
    const layer = scenario.layers.find((item) => item.type === 'obstacle')!;
    const object = interactive({ layerId: layer.id });
    layer.objects.push(object);
    const decorative = interactive({
      id: crypto.randomUUID(),
      layerId: layer.id,
      behavior: 'decoration',
      laneOffset: 0.7,
    });
    layer.objects.push(decorative);

    expect(validateScenario(scenario)).toBeNull();
    expect(scenarioToTrack(scenario)).toMatchObject({
      id: `scenario:${scenario.id}`,
      scenarioId: scenario.id,
      items: [
        {
          id: object.id,
          x: 800,
          y: 80,
          width: 36,
          height: 36,
          kind: 'coin',
        },
      ],
    });
  });

  it('rejects impossible bounds and lateral interactive objects', () => {
    const scenario = createScenario();
    const layer = scenario.layers.find((item) => item.type === 'obstacle')!;
    layer.objects.push(interactive({ layerId: layer.id, laneOffset: 0.5 }));
    expect(validateScenario(scenario)).toContain('carril central');
    layer.objects[0].laneOffset = 0;
    layer.objects[0].width = 0;
    expect(validateScenario(scenario)).toContain('área válida');
  });

  it('uses vertical AABB geometry deterministically', () => {
    const scenario = createScenario();
    const layer = scenario.layers.find((item) => item.type === 'obstacle')!;
    layer.objects.push(
      interactive({ layerId: layer.id, behavior: 'rock', x: 500, y: 180, height: 30 }),
    );
    const game = new Simulation(scenarioToTrack(scenario));
    game.start();
    for (let index = 0; index < 300; index++) game.update(STEP);
    expect(game.lives).toBe(3);
    expect(game.cleared.has(layer.objects[0].id)).toBe(true);
  });
});

describe('scenario ZIP v1', () => {
  it('round-trips a custom asset into a new scenario without base64 JSON', async () => {
    const scenario = createScenario();
    const layer = scenario.layers.find((item) => item.type === 'decoration')!;
    const assetId = crypto.randomUUID();
    layer.objects.push({
      ...interactive({ layerId: layer.id, behavior: 'decoration', laneOffset: -0.5 }),
      visual: { source: 'custom', assetId, name: 'Estrella' },
    });
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
    const asset: ScenarioAsset = {
      id: assetId,
      scenarioId: scenario.id,
      name: 'estrella.png',
      mime: 'image/png',
      width: 1,
      height: 1,
      size: bytes.byteLength,
      bytes,
    };

    const exported = await exportScenarioZip(scenario, [asset]);
    const file = new File([await exported.blob.arrayBuffer()], exported.filename, {
      type: 'application/zip',
    });
    const imported = await importScenarioZip(file);

    expect(imported.scenario.id).not.toBe(scenario.id);
    expect(imported.assets).toHaveLength(1);
    expect(imported.assets[0].id).not.toBe(asset.id);
    expect(imported.assets[0].scenarioId).toBe(imported.scenario.id);
    expect(scenarioAssetIds(imported.scenario)).toEqual([imported.assets[0].id]);
    expect(new TextDecoder().decode(await exported.blob.arrayBuffer())).not.toContain('data:image');
  });

  it('rejects an oversized archive before extraction', async () => {
    const huge = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.zip', {
      type: 'application/zip',
    });
    await expect(importScenarioZip(huge)).rejects.toThrow('25 MB');
  });
});
