export {};
interface CropMessage {
  id: number;
  file: Blob;
  zoom: number;
  x: number;
  y: number;
}
self.onmessage = async (event: MessageEvent<CropMessage>) => {
  const { id, file, zoom, x, y } = event.data;
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
