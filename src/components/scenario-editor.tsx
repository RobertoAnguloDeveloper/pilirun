'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Coins,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  ImagePlus,
  Layers3,
  Lock,
  Mountain,
  Play,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Shield,
  Sparkles,
  Swords,
  Timer,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  Bot,
  Skull,
  Zap,
} from 'lucide-react';
import { localStore } from '@/lib/storage';
import {
  ITEM_KINDS,
  MAX_SCENARIO_ASSETS,
  MAX_SCENARIO_LAYERS,
  MAX_SCENARIO_OBJECTS,
  createScenario,
  scenarioObjects,
  validateScenario,
} from '@/lib/scenario';
import { exportScenarioZip, importScenarioZip } from '@/lib/scenario-zip';
import type {
  BossConfig,
  ItemKind,
  Scenario,
  ScenarioAsset,
  ScenarioLayer,
  ScenarioObject,
  WorldId,
} from '@/lib/types';
import { WORLDS } from '@/lib/worlds';

const TOOLBOX: Array<{ kind: ItemKind; label: string; icon: typeof Mountain; color: string }> = [
  { kind: 'log', label: 'Tronco', icon: Box, color: '#9a6845' },
  { kind: 'rock', label: 'Roca', icon: Mountain, color: '#91a29a' },
  { kind: 'branch', label: 'Rama alta', icon: ArrowRight, color: '#608d55' },
  { kind: 'drone', label: 'Dron Aéreo', icon: Bot, color: '#38bdf8' },
  { kind: 'golem', label: 'Gólem Guardián', icon: Skull, color: '#a855f7' },
  { kind: 'coin', label: 'Moneda', icon: Coins, color: '#ffd45f' },
  { kind: 'shield', label: 'Escudo', icon: Shield, color: '#8edbf3' },
  { kind: 'boost', label: 'Impulso', icon: Zap, color: '#d7a7f2' },
  { kind: 'time', label: 'Tiempo', icon: Timer, color: '#d8f36a' },
  { kind: 'spring', label: 'Resorte', icon: Sparkles, color: '#f59e0b' },
  { kind: 'ring', label: 'Aro aéreo', icon: RotateCw, color: '#22d3ee' },
];

const defaultSize: Record<ItemKind, { width: number; height: number; y: number }> = {
  log: { width: 48, height: 31, y: 0 },
  rock: { width: 54, height: 48, y: 0 },
  branch: { width: 58, height: 42, y: 48 },
  drone: { width: 48, height: 36, y: 55 },
  golem: { width: 52, height: 50, y: 0 },
  coin: { width: 24, height: 24, y: 52 },
  shield: { width: 34, height: 34, y: 55 },
  boost: { width: 34, height: 34, y: 55 },
  time: { width: 34, height: 34, y: 55 },
  spring: { width: 46, height: 22, y: 0 },
  ring: { width: 58, height: 58, y: 110 },
  power_fire: { width: 36, height: 36, y: 55 },
  power_water: { width: 36, height: 36, y: 55 },
  power_leaf: { width: 36, height: 36, y: 55 },
  power_thunder: { width: 36, height: 36, y: 55 },
  power_star: { width: 36, height: 36, y: 55 },
};

type MobilePanel = 'palette' | 'properties' | 'layers' | null;
type DragMode = 'move' | 'resize' | 'rotate' | 'pan';
interface DragState {
  mode: DragMode;
  objectId?: string;
  startX: number;
  startY: number;
  worldX: number;
  worldY: number;
  original?: ScenarioObject;
  snapshot: Scenario;
}

function cloneScenario(value: Scenario): Scenario {
  return structuredClone(value);
}

function activeLayerOf(scenario: Scenario, id: string | null) {
  return scenario.layers.find((layer) => layer.id === id) ?? scenario.layers[0];
}

function objectLabel(object: ScenarioObject) {
  const visual = object.visual;
  return visual.source === 'custom'
    ? visual.name
    : (TOOLBOX.find((item) => item.kind === visual.kind)?.label ?? visual.kind);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function optimizeImage(file: File) {
  return new Promise<{ blob: Blob; width: number; height: number; mime: ScenarioAsset['mime'] }>(
    (resolve, reject) => {
      const worker = new Worker('/workers/image.worker.js', { type: 'module' });
      const id = Date.now();
      worker.onmessage = (
        event: MessageEvent<{
          id: number;
          blob?: Blob;
          width?: number;
          height?: number;
          mime?: ScenarioAsset['mime'];
          error?: string;
        }>,
      ) => {
        if (event.data.id !== id) return;
        worker.terminate();
        if (
          event.data.error ||
          !event.data.blob ||
          !event.data.width ||
          !event.data.height ||
          !event.data.mime
        )
          reject(new Error(event.data.error ?? 'No se pudo optimizar la imagen.'));
        else
          resolve({
            blob: event.data.blob,
            width: event.data.width,
            height: event.data.height,
            mime: event.data.mime,
          });
      };
      worker.onerror = () => {
        worker.terminate();
        reject(new Error('No se pudo iniciar el procesador de imágenes.'));
      };
      worker.postMessage({ id, action: 'scenario-image', file });
    },
  );
}

export function ScenarioEditor({
  scenarios,
  recoveredDraft,
  onSave,
  onDelete,
  onPlay,
  onDraft,
  onDiscardDraft,
  onClose,
}: {
  scenarios: Scenario[];
  recoveredDraft?: Scenario;
  onSave: (scenario: Scenario, assets: ScenarioAsset[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPlay: (scenario: Scenario, assets: ScenarioAsset[]) => void;
  onDraft: (scenario: Scenario) => Promise<void>;
  onDiscardDraft: (scenarioId?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [scenario, setScenario] = useState<Scenario>(() =>
    cloneScenario(recoveredDraft ?? createScenario()),
  );
  const [assets, setAssets] = useState<ScenarioAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(
    () => scenario.layers.at(-1)?.id ?? null,
  );
  const [tool, setTool] = useState<ItemKind>('log');
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [history, setHistory] = useState<Scenario[]>([]);
  const [future, setFuture] = useState<Scenario[]>([]);
  const [dirty, setDirty] = useState(Boolean(recoveredDraft));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(recoveredDraft ? 'Recuperamos tu último borrador.' : '');
  const [imageRevision, setImageRevision] = useState(0);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [obstacleSpacing, setObstacleSpacing] = useState(600); // 60 meters default (safe bounds 44m to 120m)
  const [bossEditorOpen, setBossEditorOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement>());
  const assetUrls = useRef<string[]>([]);
  const layerDrag = useRef<string | null>(null);

  const selected = useMemo(
    () => scenarioObjects(scenario).find((object) => object.id === selectedId) ?? null,
    [scenario, selectedId],
  );
  const activeLayer = activeLayerOf(scenario, activeLayerId);

  useEffect(() => {
    assetUrls.current.forEach(URL.revokeObjectURL);
    assetUrls.current = [];
    imageCache.current.clear();
    for (const asset of assets) {
      const url = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mime }));
      assetUrls.current.push(url);
      const image = new Image();
      image.onload = () => setImageRevision((value) => value + 1);
      image.src = url;
      imageCache.current.set(asset.id, image);
    }
    return () => assetUrls.current.forEach(URL.revokeObjectURL);
  }, [assets]);

  const loadAssets = useCallback(async (scenarioId: string) => {
    try {
      setAssets(
        await localStore.request<ScenarioAsset[]>({ action: 'scenario-assets-get', scenarioId }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron abrir las imágenes.');
    }
  }, []);

  useEffect(() => {
    void loadAssets(scenario.id);
  }, [loadAssets, scenario.id]);

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(
      () => void onDraft({ ...scenario, updatedAt: Date.now() }).catch(() => {}),
      750,
    );
    return () => clearTimeout(timer);
  }, [dirty, onDraft, scenario]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const commit = useCallback(
    (next: Scenario, previous = scenario) => {
      setHistory((items) => [...items.slice(-49), cloneScenario(previous)]);
      setFuture([]);
      setScenario(next);
      setDirty(true);
      setMessage('');
    },
    [scenario],
  );

  const mutate = useCallback(
    (fn: (draft: Scenario) => void) => {
      const next = cloneScenario(scenario);
      fn(next);
      next.updatedAt = Date.now();
      commit(next);
    },
    [commit, scenario],
  );

  const updateObject = useCallback(
    (id: string, values: Partial<ScenarioObject>, record = true) => {
      const next = cloneScenario(scenario);
      for (const layer of next.layers) {
        const object = layer.objects.find((item) => item.id === id);
        if (object) Object.assign(object, values);
      }
      next.updatedAt = Date.now();
      if (record) commit(next);
      else {
        setScenario(next);
        setDirty(true);
      }
    },
    [commit, scenario],
  );

  const addObject = useCallback(
    (kind: ItemKind, x = panX + 700, y?: number) => {
      if (scenarioObjects(scenario).length >= MAX_SCENARIO_OBJECTS) {
        setMessage(`El escenario admite hasta ${MAX_SCENARIO_OBJECTS} objetos.`);
        return;
      }
      const layer = activeLayerOf(scenario, activeLayerId);
      if (!layer || layer.locked) {
        setMessage('Elige una capa desbloqueada.');
        return;
      }
      const size = defaultSize[kind];
      const object: ScenarioObject = {
        id: crypto.randomUUID(),
        visual: { source: 'builtin', kind },
        behavior: kind,
        x: Math.max(400, Math.min(scenario.length - 150, snap ? Math.round(x / 50) * 50 : x)),
        y: y ?? size.y,
        width: size.width,
        height: size.height,
        rotation: 0,
        scale: 1,
        laneOffset: 0,
        layerId: layer.id,
        properties: { opacity: 1 },
      };
      mutate((draft) => activeLayerOf(draft, layer.id).objects.push(object));
      setSelectedId(object.id);
    },
    [activeLayerId, mutate, panX, scenario, snap],
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    mutate((draft) => {
      for (const layer of draft.layers)
        layer.objects = layer.objects.filter((object) => object.id !== selectedId);
    });
    setSelectedId(null);
  }, [mutate, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const copy = structuredClone(selected);
    copy.id = crypto.randomUUID();
    copy.x = Math.min(scenario.length - 150, selected.x + 75);
    mutate((draft) => activeLayerOf(draft, selected.layerId).objects.push(copy));
    setSelectedId(copy.id);
  }, [mutate, scenario, selected]);

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [cloneScenario(scenario), ...items].slice(0, 50));
    setHistory((items) => items.slice(0, -1));
    setScenario(previous);
    setDirty(true);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items.slice(-49), cloneScenario(scenario)]);
    setFuture((items) => items.slice(1));
    setScenario(next);
    setDirty(true);
  };

  const canvasMetrics = useCallback(() => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = (rect.width / 1200) * zoom;
    const ground = rect.height * 0.78;
    return { rect, scale, ground };
  }, [zoom]);

  const objectRect = useCallback(
    (object: ScenarioObject) => {
      const { scale, ground } = canvasMetrics();
      const width = Math.max(24, object.width * object.scale * scale);
      const height = Math.max(24, object.height * object.scale * scale);
      return {
        x: (object.x - panX) * scale - width / 2,
        y: ground - object.y * scale - height,
        width,
        height,
      };
    },
    [canvasMetrics, panX],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { scale, ground } = canvasMetrics();
      const palette = WORLDS[scenario.world];
      ctx.fillStyle = palette.sky;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = palette.mountain;
      ctx.beginPath();
      ctx.moveTo(0, ground);
      for (let x = 0; x <= rect.width; x += 80) ctx.lineTo(x, ground - 35 - ((x * 13) % 55));
      ctx.lineTo(rect.width, ground);
      ctx.fill();
      ctx.fillStyle = palette.ground;
      ctx.fillRect(0, ground, rect.width, rect.height - ground);
      if (grid) {
        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.lineWidth = 1;
        const spacing = Math.max(20, 50 * scale);
        for (let x = -((panX * scale) % spacing); x < rect.width; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, rect.height);
          ctx.stroke();
        }
        for (let y = ground; y > 0; y -= spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(rect.width, y);
          ctx.stroke();
        }
      }
      const layers = [...scenario.layers]
        .filter((layer) => layer.visible)
        .sort((a, b) => a.zIndex - b.zIndex);
      for (const layer of layers) {
        for (const object of layer.objects) {
          const box = objectRect(object);
          if (box.x + box.width < -40 || box.x > rect.width + 40) continue;
          ctx.save();
          ctx.globalAlpha = Number(object.properties.opacity ?? 1);
          ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
          ctx.rotate((object.rotation * Math.PI) / 180);
          const visual = object.visual;
          if (visual.source === 'custom') {
            const image = imageCache.current.get(visual.assetId);
            if (image?.complete)
              ctx.drawImage(image, -box.width / 2, -box.height / 2, box.width, box.height);
            else {
              ctx.fillStyle = '#ffffff55';
              ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
            }
          } else {
            const toolInfo = TOOLBOX.find((item) => item.kind === visual.kind)!;
            ctx.fillStyle = toolInfo.color;
            ctx.beginPath();
            ctx.roundRect(
              -box.width / 2,
              -box.height / 2,
              box.width,
              box.height,
              Math.min(12, box.height / 3),
            );
            ctx.fill();
            ctx.fillStyle = '#16352b';
            ctx.font = `700 ${Math.max(10, Math.min(16, box.height / 2))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(toolInfo.label.slice(0, 2), 0, 0);
          }
          ctx.restore();
          if (object.id === selectedId) {
            ctx.strokeStyle = '#d8f36a';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x - 3, box.y - 3, box.width + 6, box.height + 6);
            ctx.fillStyle = '#d8f36a';
            ctx.fillRect(box.x + box.width - 7, box.y + box.height - 7, 14, 14);
            ctx.beginPath();
            ctx.arc(box.x + box.width / 2, box.y - 18, 7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.fillStyle = 'rgba(5,16,12,.75)';
      ctx.fillRect(12, 12, 190, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '600 12px sans-serif';
      ctx.fillText(
        `${Math.round(panX / 10)} m — ${Math.round((panX + rect.width / scale) / 10)} m`,
        24,
        31,
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, [canvasMetrics, grid, imageRevision, objectRect, scenario, selectedId]);

  const pointerWorld = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const { rect, scale, ground } = canvasMetrics();
    return {
      x: panX + (event.clientX - rect.left) / scale,
      y: (ground - (event.clientY - rect.top)) / scale,
    };
  };

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      return;
    }
    const world = pointerWorld(event);
    const objects = scenarioObjects(scenario).slice().reverse();
    const hit = objects.find((object) => {
      const box = objectRect(object);
      return (
        event.clientX >= canvasMetrics().rect.left + box.x &&
        event.clientX <= canvasMetrics().rect.left + box.x + box.width &&
        event.clientY >= canvasMetrics().rect.top + box.y - 26 &&
        event.clientY <= canvasMetrics().rect.top + box.y + box.height + 10
      );
    });
    if (!hit) {
      if (event.button === 1 || event.altKey) {
        dragRef.current = {
          mode: 'pan',
          startX: event.clientX,
          startY: event.clientY,
          worldX: panX,
          worldY: 0,
          snapshot: cloneScenario(scenario),
        };
      } else addObject(tool, world.x, Math.max(0, world.y));
      return;
    }
    setSelectedId(hit.id);
    setActiveLayerId(hit.layerId);
    const box = objectRect(hit);
    const localX = event.clientX - canvasMetrics().rect.left;
    const localY = event.clientY - canvasMetrics().rect.top;
    const mode: DragMode =
      Math.hypot(localX - (box.x + box.width / 2), localY - (box.y - 18)) < 16
        ? 'rotate'
        : Math.hypot(localX - (box.x + box.width), localY - (box.y + box.height)) < 18
          ? 'resize'
          : 'move';
    dragRef.current = {
      mode,
      objectId: hit.id,
      startX: event.clientX,
      startY: event.clientY,
      worldX: hit.x,
      worldY: hit.y,
      original: structuredClone(hit),
      snapshot: cloneScenario(scenario),
    };
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()];
      setZoom(
        Math.max(
          0.5,
          Math.min(
            3,
            (pinchRef.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinchRef.current.distance,
          ),
        ),
      );
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const { scale } = canvasMetrics();
    if (drag.mode === 'pan') {
      setPanX(Math.max(0, drag.worldX - (event.clientX - drag.startX) / scale));
      return;
    }
    if (!drag.objectId || !drag.original) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = -(event.clientY - drag.startY) / scale;
    if (drag.mode === 'move')
      updateObject(
        drag.objectId,
        {
          x: Math.max(400, Math.min(scenario.length - 150, drag.worldX + dx)),
          y: Math.max(0, Math.min(600, drag.worldY + dy)),
        },
        false,
      );
    if (drag.mode === 'resize')
      updateObject(
        drag.objectId,
        {
          width: Math.max(10, drag.original.width + dx),
          height: Math.max(10, drag.original.height + dy),
        },
        false,
      );
    if (drag.mode === 'rotate')
      updateObject(
        drag.objectId,
        {
          rotation:
            (Math.atan2(event.clientY - drag.startY, event.clientX - drag.startX) * 180) / Math.PI +
            90,
        },
        false,
      );
  };

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchRef.current = null;
    const drag = dragRef.current;
    if (drag && drag.mode !== 'pan') {
      setHistory((items) => [...items.slice(-49), drag.snapshot]);
      setFuture([]);
      if (snap && drag.objectId) {
        setScenario((current) => {
          const next = cloneScenario(current);
          for (const layer of next.layers) {
            const object = layer.objects.find((item) => item.id === drag.objectId);
            if (object) {
              object.x = Math.round(object.x / 50) * 50;
              object.y = Math.round(object.y / 10) * 10;
            }
          }
          return next;
        });
      }
    }
    dragRef.current = null;
  };

  const save = async () => {
    const updated = { ...scenario, name: scenario.name.trim(), updatedAt: Date.now() };
    const error = validateScenario(updated, assets);
    if (error) {
      setMessage(error);
      return;
    }
    setBusy(true);
    try {
      await onSave(updated, assets);
      setScenario(updated);
      setDirty(false);
      setMessage('Escenario guardado en este dispositivo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el escenario.');
    } finally {
      setBusy(false);
    }
  };

  const switchScenario = async (next: Scenario) => {
    if (
      dirty &&
      !window.confirm(
        'Hay cambios sin guardar. ¿Quieres abrir otro escenario y conservar este como borrador?',
      )
    )
      return;
    setScenario(cloneScenario(next));
    setSelectedId(null);
    setActiveLayerId(next.layers.at(-1)?.id ?? null);
    setHistory([]);
    setFuture([]);
    setDirty(false);
    setMessage('');
    setPanX(0);
    setZoom(1);
  };

  const importImage = async (file?: File) => {
    if (!file) return;
    if (assets.length >= MAX_SCENARIO_ASSETS) {
      setMessage(`Puedes usar hasta ${MAX_SCENARIO_ASSETS} imágenes.`);
      return;
    }
    setBusy(true);
    try {
      const optimized = await optimizeImage(file);
      const id = crypto.randomUUID();
      const asset: ScenarioAsset = {
        id,
        scenarioId: scenario.id,
        name: file.name.slice(0, 80),
        mime: optimized.mime,
        width: optimized.width,
        height: optimized.height,
        size: optimized.blob.size,
        bytes: await optimized.blob.arrayBuffer(),
      };
      await localStore.request({ action: 'scenario-asset-put', asset });
      setAssets((items) => [...items, asset]);
      const layer = activeLayerOf(scenario, activeLayerId);
      const object: ScenarioObject = {
        id: crypto.randomUUID(),
        visual: { source: 'custom', assetId: id, name: file.name },
        behavior: 'decoration',
        x: Math.min(scenario.length - 150, panX + 700),
        y: 0,
        width: 120,
        height: Math.max(40, (120 * optimized.height) / optimized.width),
        rotation: 0,
        scale: 1,
        laneOffset: 0,
        layerId: layer.id,
        properties: { opacity: 1 },
      };
      mutate((draft) => activeLayerOf(draft, layer.id).objects.push(object));
      setSelectedId(object.id);
      setMessage('Imagen añadida. Elige su función en Propiedades.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo importar la imagen.');
    } finally {
      setBusy(false);
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  const palette = (
    <aside className="scenario-palette" aria-label="Paleta de objetos">
      <div className="scenario-panel-heading">
        <div>
          <span>OBJETOS</span>
          <h2>Arrastra y crea</h2>
        </div>
        <span className="scenario-count">
          {scenarioObjects(scenario).length}/{MAX_SCENARIO_OBJECTS}
        </span>
      </div>
      <div className="scenario-tools">
        {TOOLBOX.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            className={tool === kind ? 'active' : ''}
            aria-pressed={tool === kind}
            onClick={() => {
              setTool(kind);
              setMobilePanel(null);
            }}
            onPointerDown={(event) => {
              setTool(kind);
              setMobilePanel(null);
              const originX = event.clientX;
              const originY = event.clientY;
              const release = (up: PointerEvent) => {
                window.removeEventListener('pointerup', release);
                if (Math.hypot(up.clientX - originX, up.clientY - originY) < 8) return;
                const rect = canvasRef.current?.getBoundingClientRect();
                if (
                  !rect ||
                  up.clientX < rect.left ||
                  up.clientX > rect.right ||
                  up.clientY < rect.top ||
                  up.clientY > rect.bottom
                )
                  return;
                const scale = (rect.width / 1200) * zoom;
                addObject(
                  kind,
                  panX + (up.clientX - rect.left) / scale,
                  Math.max(0, (rect.height * 0.78 - (up.clientY - rect.top)) / scale),
                );
              };
              window.addEventListener('pointerup', release, { once: true });
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <button
        className="scenario-wide-button"
        onClick={() => imageRef.current?.click()}
        disabled={busy}
      >
        <ImagePlus size={20} /> Imagen personalizada
      </button>
      <input
        ref={imageRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => void importImage(event.target.files?.[0])}
      />
      <div className="scenario-saved-list">
        <h3>Mis escenarios</h3>
        {scenarios.map((item) => (
          <button
            key={item.id}
            onClick={() => void switchScenario(item)}
            className={item.id === scenario.id ? 'active' : ''}
          >
            <span>{item.name}</span>
            <small>{item.length / 10} m</small>
          </button>
        ))}
      </div>
    </aside>
  );

  const inspector = (
    <aside className="scenario-inspector" aria-label="Propiedades del objeto">
      <div className="scenario-panel-heading">
        <div>
          <span>PROPIEDADES</span>
          <h2>{selected ? objectLabel(selected) : 'Selecciona un objeto'}</h2>
        </div>
      </div>
      {selected ? (
        <div className="scenario-fields">
          <label>
            Función
            <select
              value={selected.behavior}
              onChange={(event) =>
                updateObject(selected.id, {
                  behavior: event.target.value as ItemKind | 'decoration',
                  laneOffset: event.target.value === 'decoration' ? selected.laneOffset : 0,
                })
              }
            >
              <option value="decoration">Decoración</option>
              {ITEM_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {TOOLBOX.find((item) => item.kind === kind)?.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Capa
            <select
              value={selected.layerId}
              onChange={(event) =>
                mutate((draft) => {
                  const source = draft.layers.find((layer) =>
                    layer.objects.some((object) => object.id === selected.id),
                  )!;
                  const [object] = source.objects.splice(
                    source.objects.findIndex((item) => item.id === selected.id),
                    1,
                  );
                  object.layerId = event.target.value;
                  activeLayerOf(draft, event.target.value).objects.push(object);
                })
              }
            >
              {scenario.layers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </label>
          <div className="scenario-field-grid">
            {(['x', 'y', 'width', 'height', 'rotation', 'scale'] as const).map((key) => (
              <label key={key}>
                {
                  {
                    x: 'Posición X',
                    y: 'Altura',
                    width: 'Ancho',
                    height: 'Alto',
                    rotation: 'Rotación',
                    scale: 'Escala',
                  }[key]
                }
                <input
                  type="number"
                  step={key === 'scale' ? 0.1 : 1}
                  value={Math.round(selected[key] * 100) / 100}
                  onChange={(event) =>
                    updateObject(selected.id, { [key]: Number(event.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          {['log', 'branch', 'rock'].includes(selected.behavior) && <>
            <label>Material del obstáculo
              <select value={String(selected.properties.material ?? (selected.behavior === 'rock' ? 'stone' : 'wood'))}
                onChange={(event) => updateObject(selected.id, { properties: { ...selected.properties, material: event.target.value } })}>
                <option value="wood">Madera · fuego, hojas, rayo y estrellas</option>
                <option value="stone">Piedra · rayo y estrellas</option>
                <option value="indestructible">Indestructible por poderes</option>
              </select>
            </label>
            <label>Resistencia del obstáculo
              <input type="number" min="1" max="10000" value={Number(selected.properties.health ?? (selected.behavior === 'branch' ? 25 : selected.behavior === 'rock' ? 90 : 60))}
                onChange={(event) => updateObject(selected.id, { properties: { ...selected.properties, health: Number(event.target.value) } })} />
            </label>
          </>}
          {selected.behavior === 'decoration' && (
            <label>
              Posición lateral 3D · {selected.laneOffset.toFixed(1)}
              <input
                type="range"
                min="-1"
                max="1"
                step=".1"
                value={selected.laneOffset}
                onChange={(event) =>
                  updateObject(selected.id, { laneOffset: Number(event.target.value) })
                }
              />
            </label>
          )}
          <label>
            Opacidad · {Math.round(Number(selected.properties.opacity ?? 1) * 100)}%
            <input
              type="range"
              min=".1"
              max="1"
              step=".05"
              value={Number(selected.properties.opacity ?? 1)}
              onChange={(event) =>
                updateObject(selected.id, {
                  properties: { ...selected.properties, opacity: Number(event.target.value) },
                })
              }
            />
          </label>
          <div className="scenario-nudge" role="group" aria-label="Mover objeto con precisión">
            <button
              aria-label="Mover a la izquierda"
              onClick={() => updateObject(selected.id, { x: selected.x - (snap ? 50 : 10) })}
            >
              <ArrowLeft />
            </button>
            <button
              aria-label="Mover hacia arriba"
              onClick={() => updateObject(selected.id, { y: selected.y + 10 })}
            >
              <ArrowUp />
            </button>
            <button
              aria-label="Mover hacia abajo"
              onClick={() => updateObject(selected.id, { y: Math.max(0, selected.y - 10) })}
            >
              <ArrowDown />
            </button>
            <button
              aria-label="Mover a la derecha"
              onClick={() => updateObject(selected.id, { x: selected.x + (snap ? 50 : 10) })}
            >
              <ArrowRight />
            </button>
          </div>
          <div className="scenario-inspector-actions">
            <button onClick={duplicateSelected}>
              <Plus /> Duplicar
            </button>
            <button className="danger" onClick={deleteSelected}>
              <Trash2 /> Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div className="scenario-empty">
          <Box />
          <p>Toca o haz clic en un objeto para cambiar su tamaño, función y posición.</p>
        </div>
      )}
      <div className="scenario-object-tree">
        <h3>Objetos accesibles</h3>
        {scenarioObjects(scenario).map((object) => (
          <button
            key={object.id}
            className={object.id === selectedId ? 'active' : ''}
            onClick={() => {
              setSelectedId(object.id);
              setActiveLayerId(object.layerId);
            }}
          >
            {objectLabel(object)}
            <small>{Math.round(object.x / 10)} m</small>
          </button>
        ))}
      </div>
    </aside>
  );

  const layers = (
    <div className="scenario-layers" aria-label="Administrador de capas">
      <div className="scenario-layer-title">
        <Layers3 />
        <strong>Capas</strong>

        {/* Obstacle Spacing Controller (Safe bounds 44m to 120m) */}
        <div className="scenario-spacing-control" title="Separación segura mínima entre obstáculos para saltar y esquivar">
          <span>Espaciado: <strong>{Math.round(obstacleSpacing / 10)} m</strong></span>
          <input
            type="range"
            min="440"
            max="1200"
            step="20"
            value={obstacleSpacing}
            onChange={(e) => setObstacleSpacing(Number(e.target.value))}
            aria-label="Separación entre obstáculos"
          />
        </div>

        <button
          disabled={scenario.layers.length >= MAX_SCENARIO_LAYERS}
          onClick={() =>
            mutate((draft) => {
              const id = crypto.randomUUID();
              draft.layers.push({
                id,
                name: `Capa ${draft.layers.length + 1}`,
                type: 'decoration',
                zIndex: draft.layers.length * 10,
                visible: true,
                locked: false,
                parallaxSpeed: 1,
                animated: false,
                animationSpeed: 20,
                animationDirection: 'left',
                objects: [],
              });
              setActiveLayerId(id);
            })
          }
        >
          <Plus /> Añadir
        </button>
      </div>
      <div className="scenario-layer-strip">
        {scenario.layers.map((layer, index) => (
          <article
            key={layer.id}
            data-layer-id={layer.id}
            className={layer.id === activeLayer?.id ? 'active' : ''}
            onPointerDown={() => {
              layerDrag.current = layer.id;
            }}
            onPointerUp={(event) => {
              const sourceId = layerDrag.current;
              layerDrag.current = null;
              const targetId = (
                document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest('[data-layer-id]') as HTMLElement | null
              )?.dataset.layerId;
              if (!sourceId || !targetId || sourceId === targetId) return;
              mutate((draft) => {
                const from = draft.layers.findIndex((item) => item.id === sourceId);
                const to = draft.layers.findIndex((item) => item.id === targetId);
                const [moving] = draft.layers.splice(from, 1);
                draft.layers.splice(to, 0, moving);
                draft.layers.forEach((item, position) => (item.zIndex = position * 10));
              });
            }}
          >
            <button className="scenario-layer-main" onClick={() => setActiveLayerId(layer.id)}>
              <span>{layer.name}</span>
              <small>{layer.objects.length} objetos</small>
            </button>
            <button
              aria-label={`${layer.visible ? 'Ocultar' : 'Mostrar'} ${layer.name}`}
              onClick={() =>
                mutate((draft) => {
                  activeLayerOf(draft, layer.id).visible = !layer.visible;
                })
              }
            >
              {layer.visible ? <Eye /> : <EyeOff />}
            </button>
            <button
              aria-label={`${layer.locked ? 'Desbloquear' : 'Bloquear'} ${layer.name}`}
              onClick={() =>
                mutate((draft) => {
                  activeLayerOf(draft, layer.id).locked = !layer.locked;
                })
              }
            >
              {layer.locked ? <Lock /> : <Unlock />}
            </button>
            <button
              aria-label={`Subir ${layer.name}`}
              disabled={index === scenario.layers.length - 1}
              onClick={() =>
                mutate((draft) => {
                  [draft.layers[index], draft.layers[index + 1]] = [
                    draft.layers[index + 1],
                    draft.layers[index],
                  ];
                  draft.layers.forEach((item, position) => (item.zIndex = position * 10));
                })
              }
            >
              <ArrowUp />
            </button>
            <button
              aria-label={`Bajar ${layer.name}`}
              disabled={index === 0}
              onClick={() =>
                mutate((draft) => {
                  [draft.layers[index], draft.layers[index - 1]] = [
                    draft.layers[index - 1],
                    draft.layers[index],
                  ];
                  draft.layers.forEach((item, position) => (item.zIndex = position * 10));
                })
              }
            >
              <ArrowDown />
            </button>
          </article>
        ))}
      </div>
      {activeLayer && (
        <div className="scenario-layer-controls">
          <label>
            Nombre
            <input
              maxLength={30}
              value={activeLayer.name}
              onChange={(event) =>
                mutate((draft) => {
                  activeLayerOf(draft, activeLayer.id).name = event.target.value;
                })
              }
            />
          </label>
          <label>
            Paralaje · {activeLayer.parallaxSpeed.toFixed(2)}
            <input
              type="range"
              min="0"
              max="2"
              step=".05"
              value={activeLayer.parallaxSpeed}
              onChange={(event) =>
                mutate((draft) => {
                  activeLayerOf(draft, activeLayer.id).parallaxSpeed = Number(event.target.value);
                })
              }
            />
          </label>
          <label className="scenario-check">
            <input
              type="checkbox"
              checked={activeLayer.animated}
              onChange={(event) =>
                mutate((draft) => {
                  activeLayerOf(draft, activeLayer.id).animated = event.target.checked;
                })
              }
            />{' '}
            Animada
          </label>
          {activeLayer.animated && (
            <>
              <label>
                Dirección
                <select
                  value={activeLayer.animationDirection}
                  onChange={(event) =>
                    mutate((draft) => {
                      activeLayerOf(draft, activeLayer.id).animationDirection = event.target
                        .value as ScenarioLayer['animationDirection'];
                    })
                  }
                >
                  <option value="left">Izquierda</option>
                  <option value="right">Derecha</option>
                  <option value="up">Arriba</option>
                  <option value="down">Abajo</option>
                </select>
              </label>
              <label>
                Velocidad
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={activeLayer.animationSpeed}
                  onChange={(event) =>
                    mutate((draft) => {
                      activeLayerOf(draft, activeLayer.id).animationSpeed = Number(
                        event.target.value,
                      );
                    })
                  }
                />
              </label>
            </>
          )}
          {scenario.layers.length > 1 && (
            <button
              className="danger compact"
              onClick={() => {
                if (activeLayer.objects.length) {
                  setConfirmDialog({
                    title: '¿Eliminar esta capa?',
                    message: `La capa "${activeLayer.name}" tiene ${activeLayer.objects.length} objetos. ¿Seguro que quieres borrarla?`,
                    onConfirm: () => {
                      mutate((draft) => {
                        draft.layers = draft.layers.filter((layer) => layer.id !== activeLayer.id);
                      });
                      setActiveLayerId(
                        scenario.layers.find((layer) => layer.id !== activeLayer.id)?.id ?? null,
                      );
                      setConfirmDialog(null);
                    },
                  });
                  return;
                }
                mutate((draft) => {
                  draft.layers = draft.layers.filter((layer) => layer.id !== activeLayer.id);
                });
                setActiveLayerId(
                  scenario.layers.find((layer) => layer.id !== activeLayer.id)?.id ?? null,
                );
              }}
            >
              <Trash2 /> Eliminar capa
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <section
      className="scenario-workspace"
      aria-label="Editor de escenarios"
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.shiftKey ? redo() : undo();
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          redo();
        }
        if (
          (event.key === 'Delete' || event.key === 'Backspace') &&
          document.activeElement?.tagName === 'CANVAS'
        )
          deleteSelected();
        if (
          selected &&
          document.activeElement?.tagName === 'CANVAS' &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
        ) {
          event.preventDefault();
          const step = snap ? 50 : 10;
          if (event.key === 'ArrowLeft')
            updateObject(selected.id, { x: Math.max(400, selected.x - step) });
          if (event.key === 'ArrowRight')
            updateObject(selected.id, { x: Math.min(scenario.length - 150, selected.x + step) });
          if (event.key === 'ArrowUp')
            updateObject(selected.id, { y: Math.min(600, selected.y + 10) });
          if (event.key === 'ArrowDown')
            updateObject(selected.id, { y: Math.max(0, selected.y - 10) });
        }
      }}
    >
      <header className="scenario-toolbar">
        <button
          className="scenario-back"
          onClick={() => {
            if (!dirty || window.confirm('Tu borrador se conservará. ¿Volver al campamento?'))
              onClose();
          }}
        >
          <ArrowLeft /> Volver
        </button>
        <div className="scenario-title-fields">
          <input
            aria-label="Nombre del escenario"
            maxLength={40}
            value={scenario.name}
            onChange={(event) =>
              mutate((draft) => {
                draft.name = event.target.value;
              })
            }
          />
          <select
            aria-label="Mundo del escenario"
            value={scenario.world}
            onChange={(event) =>
              mutate((draft) => {
                draft.world = event.target.value as WorldId;
              })
            }
          >
            {Object.entries(WORLDS).map(([id, world]) => (
              <option key={id} value={id}>
                {world.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Distancia del escenario"
            value={scenario.length}
            onChange={(event) =>
              mutate((draft) => {
                draft.length = Number(event.target.value);
                for (const layer of draft.layers)
                  layer.objects = layer.objects.filter((object) => object.x <= draft.length - 150);
              })
            }
          >
            {[3000, 6000, 9000, 15000, 30000].map((length) => (
              <option key={length} value={length}>
                {length / 10} m
              </option>
            ))}
          </select>
        </div>
        <div className="scenario-toolbar-actions">
          <button aria-label="Deshacer" disabled={!history.length} onClick={undo}>
            <Undo2 />
          </button>
          <button aria-label="Rehacer" disabled={!future.length} onClick={redo}>
            <Redo2 />
          </button>
          <button
            aria-label="Mostrar cuadrícula"
            className={grid ? 'active' : ''}
            onClick={() => setGrid((value) => !value)}
          >
            <Grid3X3 />
          </button>
          <button className={snap ? 'active' : ''} onClick={() => setSnap((value) => !value)}>
            Snap
          </button>
          <button onClick={() => importRef.current?.click()}>
            <Upload /> Importar
          </button>
          <input
            ref={importRef}
            hidden
            type="file"
            accept=".zip,application/zip"
            onChange={(event) =>
              void (async () => {
                const file = event.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const imported = await importScenarioZip(file);
                  for (const asset of imported.assets)
                    await localStore.request({ action: 'scenario-asset-put', asset });
                  setScenario(imported.scenario);
                  setAssets(imported.assets);
                  setHistory([]);
                  setFuture([]);
                  setDirty(true);
                  setSelectedId(null);
                  setActiveLayerId(imported.scenario.layers.at(-1)?.id ?? null);
                  setMessage('Escenario importado como borrador.');
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : 'No se pudo importar el ZIP.',
                  );
                } finally {
                  setBusy(false);
                  if (importRef.current) importRef.current.value = '';
                }
              })()
            }
          />
          <button
            onClick={() =>
              void (async () => {
                try {
                  const result = await exportScenarioZip(scenario, assets);
                  download(result.blob, result.filename);
                  setMessage('ZIP exportado.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'No se pudo exportar.');
                }
              })()
            }
          >
            <Download /> Exportar
          </button>
          <button
            className={`scenario-boss-btn ${scenario.boss ? 'has-boss' : ''}`}
            onClick={() => setBossEditorOpen(true)}
            title="Configurar Jefe Final del Escenario"
          >
            <Swords size={18} /> {scenario.boss ? `Jefe: ${scenario.boss.name}` : 'Añadir Jefe'}
          </button>
          <button
            className="scenario-play"
            onClick={() => {
              const error = validateScenario(scenario, assets);
              if (error) setMessage(error);
              else onPlay(scenario, assets);
            }}
          >
            <Play /> Probar
          </button>
          <button className="scenario-save" disabled={busy} onClick={() => void save()}>
            <Save /> {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>
      <div className="scenario-editor-grid">
        <div className={`scenario-mobile-sheet ${mobilePanel === 'palette' ? 'open' : ''}`}>
          {palette}
        </div>
        <main className="scenario-canvas-wrap">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="Lienzo del escenario. Usa la paleta o el árbol accesible para añadir y seleccionar objetos."
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
            onWheel={(event) => {
              event.preventDefault();
              setZoom((value) =>
                Math.max(0.5, Math.min(3, value * (event.deltaY > 0 ? 0.9 : 1.1))),
              );
            }}
          />
          <div className="scenario-zoom">
            <button onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((value) => Math.min(3, value + 0.25))}>+</button>
          </div>
          <p className="scenario-status" role="status">
            {message ||
              `${scenarioObjects(scenario).length} objetos · ${scenario.layers.length} capas${dirty ? ' · Borrador con cambios' : ''}`}
          </p>
        </main>
        <div className={`scenario-mobile-sheet ${mobilePanel === 'properties' ? 'open' : ''}`}>
          {inspector}
        </div>
      </div>
      <div
        className={`scenario-mobile-sheet scenario-layers-sheet ${mobilePanel === 'layers' ? 'open' : ''}`}
      >
        {layers}
      </div>
      <nav className="scenario-mobile-tabs" aria-label="Paneles del editor">
        {(
          [
            ['palette', 'Objetos', Box],
            ['properties', 'Propiedades', Sparkles],
            ['layers', 'Capas', Layers3],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            className={mobilePanel === id ? 'active' : ''}
            onClick={() => setMobilePanel((current) => (current === id ? null : id))}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <span className="sr-only" aria-live="polite">
        {selected
          ? `Seleccionado ${selected.visual.source === 'custom' ? selected.visual.name : selected.visual.kind}`
          : 'Ningún objeto seleccionado'}
      </span>
      {scenarios.some((item) => item.id === scenario.id) && (
        <button
          className="scenario-delete-project"
          onClick={() => {
            setConfirmDialog({
              title: '¿Eliminar escenario?',
              message: `¿Seguro que quieres borrar "${scenario.name}"? Esta acción no se puede deshacer.`,
              onConfirm: () => {
                void onDelete(scenario.id).then(() => {
                  const next = createScenario();
                  setScenario(next);
                  setAssets([]);
                  setHistory([]);
                  setFuture([]);
                  setDirty(false);
                  setSelectedId(null);
                  setActiveLayerId(next.layers.at(-1)?.id ?? null);
                });
                setConfirmDialog(null);
              },
            });
          }}
        >
          <Trash2 /> Eliminar escenario
        </button>
      )}
      {recoveredDraft && scenario.id === recoveredDraft.id && (
        <button
          className="scenario-discard-draft"
          onClick={() => {
            setConfirmDialog({
              title: '¿Descartar borrador?',
              message: 'Se perderán los cambios del borrador recuperado.',
              onConfirm: () => {
                void onDiscardDraft(scenario.id).then(() => {
                  const next = createScenario();
                  setScenario(next);
                  setAssets([]);
                  setHistory([]);
                  setFuture([]);
                  setDirty(false);
                  setSelectedId(null);
                  setActiveLayerId(next.layers.at(-1)?.id ?? null);
                });
                setConfirmDialog(null);
              },
            });
          }}
        >
          Descartar borrador
        </button>
      )}

      {/* Boss Creation Visual Editor Modal (Designed for Kids 6+) */}
      {bossEditorOpen && (
        <div className="game-overlay boss-editor-modal-overlay">
          <div className="result-card boss-editor-card">
            <div className="boss-editor-header">
              <span className="round-icon">
                <Swords size={28} />
              </span>
              <h2>¡Crea o Modifica tu Jefe Final!</h2>
              <p>Elige su tamaño, elemento mágico, vida y ataques con controles sencillos.</p>
            </div>

            <div className="boss-editor-body">
              {/* Element Selector */}
              <div className="boss-config-section">
                <span className="boss-label">Elemento Mágico del Jefe</span>
                <div className="boss-element-buttons">
                  {[
                    { id: 'fire', label: 'Fuego 🔥', color: '#f97316' },
                    { id: 'water', label: 'Agua 💧', color: '#06b6d4' },
                    { id: 'nature', label: 'Naturaleza 🍃', color: '#22c55e' },
                    { id: 'electric', label: 'Rayo ⚡', color: '#eab308' },
                    { id: 'cosmic', label: 'Cósmico 🌌', color: '#a855f7' },
                  ].map((el) => {
                    const isSelected = (scenario.boss?.element ?? 'fire') === el.id;
                    return (
                      <button
                        key={el.id}
                        type="button"
                        className={`boss-el-btn ${isSelected ? 'selected' : ''}`}
                        style={{ borderColor: isSelected ? el.color : 'rgba(255,255,255,0.2)' }}
                        onClick={() => {
                          const element = el.id as BossConfig['element'];
                          const weakness =
                            element === 'fire' ? 'water' : element === 'water' ? 'electric' : element === 'nature' ? 'fire' : 'nature';
                          mutate((draft) => {
                            if (!draft.boss) {
                              draft.boss = {
                                id: crypto.randomUUID(),
                                name: `Titán de ${el.label.split(' ')[0]}`,
                                element,
                                size: 1.5,
                                health: 180,
                                maxHealth: 180,
                                damage: 1,
                                speed: 300,
                                attackFrequency: 2.4,
                                projectileType: element === 'fire' ? 'fireball' : element === 'water' ? 'ice_spike' : 'boulder',
                                projectileSpeed: 400,
                                weakness,
                                resistance: element,
                              };
                            } else {
                              draft.boss.element = element;
                              draft.boss.weakness = weakness;
                              draft.boss.resistance = element;
                            }
                          });
                        }}
                      >
                        {el.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Physical Size Selector */}
              <div className="boss-config-section">
                <span className="boss-label">
                  Tamaño Físico · {scenario.boss?.size === 1 ? '🐣 Pequeño' : scenario.boss?.size === 2.2 ? '🐲 Gigante' : '🦊 Mediano'}
                </span>
                <div className="boss-size-buttons">
                  {[
                    { size: 1.0, label: '🐣 Pequeño' },
                    { size: 1.5, label: '🦊 Mediano' },
                    { size: 2.2, label: '🐲 Gigante' },
                  ].map((s) => (
                    <button
                      key={s.size}
                      type="button"
                      className={`boss-size-btn ${(scenario.boss?.size ?? 1.5) === s.size ? 'active' : ''}`}
                      onClick={() => {
                        mutate((draft) => {
                          if (!draft.boss) {
                            draft.boss = {
                              id: crypto.randomUUID(),
                              name: 'Guardián del Escenario',
                              element: 'fire',
                              size: s.size,
                              health: 180,
                              maxHealth: 180,
                              damage: 1,
                              speed: 300,
                              attackFrequency: 2.4,
                              projectileType: 'fireball',
                              projectileSpeed: 400,
                              weakness: 'water',
                              resistance: 'fire',
                            };
                          } else {
                            draft.boss.size = s.size;
                          }
                        });
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Health and Attack Speed Sliders */}
              <div className="boss-config-section">
                <label className="boss-slider-label">
                  Vida del Jefe · {scenario.boss?.maxHealth ?? 180} HP
                  <input
                    type="range"
                    min="60"
                    max="350"
                    step="10"
                    value={scenario.boss?.maxHealth ?? 180}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      mutate((draft) => {
                        if (draft.boss) {
                          draft.boss.maxHealth = val;
                          draft.boss.health = val;
                        }
                      });
                    }}
                  />
                </label>
                <label className="boss-slider-label">
                  Frecuencia de Ataque · Cada {(scenario.boss?.attackFrequency ?? 2.4).toFixed(1)} segundos
                  <input
                    type="range"
                    min="1.6"
                    max="4.0"
                    step="0.2"
                    value={scenario.boss?.attackFrequency ?? 2.4}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      mutate((draft) => {
                        if (draft.boss) {
                          draft.boss.attackFrequency = val;
                        }
                      });
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="boss-editor-footer">
              {scenario.boss && (
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => {
                    mutate((draft) => {
                      draft.boss = undefined;
                    });
                    setBossEditorOpen(false);
                  }}
                >
                  <Trash2 size={16} /> Quitar Jefe
                </button>
              )}
              <button
                type="button"
                className="primary"
                onClick={() => setBossEditorOpen(false)}
              >
                ¡Listo! Guardar Jefe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friendly Dialog Modal (Child-Safe 6+) */}
      {confirmDialog && (
        <div className="game-overlay confirm-modal-overlay">
          <div className="result-card confirm-modal-card">
            <span className="round-icon danger-icon">
              <Trash2 size={24} />
            </span>
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.message}</p>
            <div className="modal-buttons-row">
              <button
                className="secondary"
                onClick={() => setConfirmDialog(null)}
              >
                Cancelar
              </button>
              <button
                className="danger-btn"
                onClick={confirmDialog.onConfirm}
              >
                Sí, continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
