export {};
interface CropMessage {
  id: number;
  file: Blob;
  zoom: number;
  x: number;
  y: number;
}
interface ScenarioImageMessage {
  id: number;
  action: 'scenario-image';
  file: Blob;
}
self.onmessage = async (event: MessageEvent<CropMessage | ScenarioImageMessage>) => {
  const message = event.data;
  if ('action' in message && message.action === 'scenario-image') {
    const { id, file } = message;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
        throw new Error('Usa una imagen PNG, JPEG o WebP.');
      if (file.size > 8 * 1024 * 1024) throw new Error('La imagen supera el límite de 8 MB.');
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40_000_000) {
        bitmap.close();
        throw new Error('La imagen supera el límite de 40 megapíxeles.');
      }
      const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * ratio));
      const height = Math.max(1, Math.round(bitmap.height * ratio));
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      let blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.84 });
      if (blob.size > 1_000_000)
        blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.68 });
      if (blob.size > 1_250_000)
        throw new Error('No fue posible optimizar la imagen a menos de 1 MB.');
      self.postMessage({ id, blob, width, height, mime: 'image/webp' });
    } catch (error) {
      self.postMessage({
        id,
        error: error instanceof Error ? error.message : 'No se pudo preparar la imagen.',
      });
    }
    return;
  }
  const { id, file, zoom, x, y } = message as CropMessage;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 40_000_000) {
      bitmap.close();
      throw new Error('La imagen es demasiado grande.');
    }
    const side = Math.min(bitmap.width, bitmap.height) / zoom;
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) * x,
      (bitmap.height - side) * y,
      side,
      side,
      0,
      0,
      128,
      128,
    );
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ id, blob });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'No se pudo abrir la imagen.',
    });
  }
};
