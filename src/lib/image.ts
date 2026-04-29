export interface ReframeOptions {
  width?: number;
  height?: number;
  format?: string; // mime type like 'image/jpeg'
  quality?: number; // 0-1 for lossy formats
}

export async function reframeImage(
  input: { data: ArrayBuffer; format?: string },
  opts: ReframeOptions = {}
): Promise<{ data: ArrayBuffer; format: string }>
{
  const inFormat = input.format || 'image/jpeg';
  const blob = new Blob([input.data], { type: inFormat });

  // Create an ImageBitmap for robust decoding
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(blob);
  } catch (err) {
    // Fallback: load via Image element
    img = await new Promise<ImageBitmap>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = async () => {
        try {
          const bitmap = await createImageBitmap(image);
          resolve(bitmap);
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      image.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      image.src = url;
    });
  }

  // Determine target size while preserving aspect ratio if needed
  let targetW = opts.width ?? img.width;
  let targetH = opts.height ?? img.height;

  if (opts.width && !opts.height) {
    targetH = Math.round((img.height / img.width) * opts.width);
  } else if (!opts.width && opts.height) {
    targetW = Math.round((img.width / img.height) * opts.height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const outFormat = opts.format || inFormat || 'image/jpeg';
  const quality = typeof opts.quality === 'number' ? opts.quality : 0.92;

  const blobOut: Blob | null = await new Promise((resolve) => {
    // canvas.toBlob has a callback-style API
    // @ts-ignore
    canvas.toBlob((b) => resolve(b), outFormat, quality);
  });

  if (!blobOut) throw new Error('Failed to produce output blob');

  const outBuffer = await blobOut.arrayBuffer();
  return { data: outBuffer, format: blobOut.type || outFormat };
}
