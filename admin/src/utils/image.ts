export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_INPUT_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_STORED_IMAGE_BYTES = 5 * 1024 * 1024;

const MAX_EDGE = 2000;

type LoadedImage = {
  width: number;
  height: number;
  source: CanvasImageSource;
  release: () => void;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).then((bitmap) => ({
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      release: () => bitmap.close(),
    }));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth,
      height: image.naturalHeight,
      source: image,
      release: () => URL.revokeObjectURL(url),
    });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function supportsWebp(canvas: HTMLCanvasElement): boolean {
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

function withExtension(name: string, type: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  const extension = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'gif';
  return `${base}.${extension}`;
}

export async function prepareImage(file: File): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use JPEG, PNG, WebP or GIF images');
  }
  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error('Image is larger than 25 MB');
  }
  if (file.type === 'image/gif') {
    if (file.size > MAX_STORED_IMAGE_BYTES) throw new Error('GIF is larger than 5 MB; choose a smaller one');
    return file;
  }

  const loaded = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(loaded.width, loaded.height));
    const needsResize = scale < 1;
    const needsCompress = file.size > MAX_STORED_IMAGE_BYTES;

    if (!needsResize && !needsCompress) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(loaded.width * scale));
    canvas.height = Math.max(1, Math.round(loaded.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process this image');
    context.drawImage(loaded.source, 0, 0, canvas.width, canvas.height);

    let type = file.type;
    let blob = await canvasToBlob(canvas, type, 0.9);
    if (!blob) throw new Error('Could not process this image');

    if (blob.size > MAX_STORED_IMAGE_BYTES && file.type !== 'image/jpeg' && supportsWebp(canvas)) {
      type = 'image/webp';
      blob = (await canvasToBlob(canvas, type, 0.9)) ?? blob;
    }
    if (blob.size > MAX_STORED_IMAGE_BYTES) {
      type = 'image/jpeg';
      blob = (await canvasToBlob(canvas, type, 0.8)) ?? blob;
    }
    if (blob.size > MAX_STORED_IMAGE_BYTES) {
      throw new Error('Image is still too large after compression');
    }

    return new File([blob], withExtension(file.name, type), { type, lastModified: Date.now() });
  } finally {
    loaded.release();
  }
}
