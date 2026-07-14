import { ImageFormat, CompressionSettings, ImageDimensions, CropArea } from '../types';

/**
 * Creates an HTMLImageElement from a source URL or file.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image: ' + err));
    img.src = url;
  });
}

/**
 * Renders an HTMLImageElement to a canvas with specific target dimensions.
 */
export function drawImageToCanvas(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  crop?: CropArea,
  format?: ImageFormat
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context for canvas');
  }

  // Configure high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill with white background by default for formats that don't support transparency
  if (format !== 'image/png') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  if (crop) {
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      targetWidth,
      targetHeight
    );
  } else {
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  }
  return canvas;
}

/**
 * Wraps canvas.toBlob in a Promise.
 */
export function getCanvasBlob(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Canvas accepts format like 'image/jpeg', 'image/png', 'image/webp'
    const mimeType = format === 'image/jpg' ? 'image/jpeg' : format;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas rendering returned an empty blob.'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Intelligently compresses an image to fit a target size in KB (if selected),
 * or applies manual quality constraints.
 * Uses a binary search / bisection solver over compression quality parameters (JPEG/WebP)
 * and dynamically scales dimensions (resolution) down if needed as a fallback.
 */
export async function solveCompression(
  img: HTMLImageElement,
  settings: CompressionSettings,
  crop?: CropArea
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  qualityUsed: number;
  scaleUsed: number;
  iterations: number;
}> {
  // 1. Calculate initial dimensions based on resizing mode
  const sourceWidth = crop ? crop.width : img.naturalWidth;
  const sourceHeight = crop ? crop.height : img.naturalHeight;

  let baseWidth = sourceWidth;
  let baseHeight = sourceHeight;

  if (settings.resizeMode === 'percentage') {
    const scale = settings.scalePercentage / 100;
    baseWidth = Math.round(sourceWidth * scale);
    baseHeight = Math.round(sourceHeight * scale);
  } else {
    baseWidth = settings.customWidth;
    baseHeight = settings.customHeight;
  }

  // Safeguard: Ensure dimensions are at least 1px
  baseWidth = Math.max(1, baseWidth);
  baseHeight = Math.max(1, baseHeight);

  const targetBytes = settings.targetSizeKB * 1024;

  // Case A: Manual quality compression (no target KB selected)
  if (!settings.useTargetSize) {
    const canvas = drawImageToCanvas(img, baseWidth, baseHeight, crop, settings.format);
    const q = settings.format === 'image/png' ? undefined : settings.quality;
    const blob = await getCanvasBlob(canvas, settings.format, q);
    return {
      blob,
      width: baseWidth,
      height: baseHeight,
      qualityUsed: settings.format === 'image/png' ? 1.0 : settings.quality,
      scaleUsed: settings.resizeMode === 'percentage' ? settings.scalePercentage / 100 : 1.0,
      iterations: 1,
    };
  }

  // Case B: Automated KB solver (Targeting a specific KB threshold)
  let currentScale = 1.0;
  let iterations = 0;
  const maxScaleAttempts = 6; // Limit dimension reduction steps to prevent infinite loop

  for (let scaleAttempt = 0; scaleAttempt < maxScaleAttempts; scaleAttempt++) {
    const w = Math.max(1, Math.round(baseWidth * currentScale));
    const h = Math.max(1, Math.round(baseHeight * currentScale));
    const canvas = drawImageToCanvas(img, w, h, crop, settings.format);

    // PNG is a lossless format; canvas.toBlob does not support the quality parameter.
    // If users target a specific KB for PNG, the only way to compress is dimension reduction.
    if (settings.format === 'image/png') {
      iterations++;
      const blob = await getCanvasBlob(canvas, 'image/png');
      
      // If fits or size reduction reaches limit, accept it
      if (blob.size <= targetBytes || currentScale <= 0.1) {
        return {
          blob,
          width: w,
          height: h,
          qualityUsed: 1.0,
          scaleUsed: currentScale,
          iterations,
        };
      }
      
      // Scale dimensions down recursively and retry
      currentScale *= 0.75;
      continue;
    }

    // For lossy formats (JPEG), perform binary search bisection on quality
    let minQ = 0.01;
    let maxQ = 0.98;
    let bestBlob: Blob | null = null;
    let bestQ = 0.5;

    // We do 8 steps of binary search. This achieves extreme precision (0.98 - 0.01) / 2^8 = 0.003
    for (let qStep = 0; qStep < 8; qStep++) {
      iterations++;
      const testQ = (minQ + maxQ) / 2;
      const testBlob = await getCanvasBlob(canvas, settings.format, testQ);

      if (testBlob.size <= targetBytes) {
        // Fits! Remember this as the highest quality that fits, and search for even better quality
        bestBlob = testBlob;
        bestQ = testQ;
        minQ = testQ;
      } else {
        // Too big! Decrease quality
        maxQ = testQ;
        if (!bestBlob) {
          // Keep a fallback blob if we haven't found any that fits yet
          bestBlob = testBlob;
          bestQ = testQ;
        }
      }
    }

    // If the best blob at this image size still exceeds target bytes,
    // and we can still scale down, shrink dimensions by 25% and rerun the quality solver.
    if (bestBlob && bestBlob.size > targetBytes && currentScale > 0.15) {
      currentScale *= 0.75;
    } else {
      // Fits target KB successfully, or hit limits of downscaling. Return result.
      return {
        blob: bestBlob || await getCanvasBlob(canvas, settings.format, 0.01),
        width: w,
        height: h,
        qualityUsed: bestQ,
        scaleUsed: currentScale,
        iterations,
      };
    }
  }

  // Extreme fallback if everything else fails
  const finalW = Math.max(1, Math.round(baseWidth * 0.05));
  const finalH = Math.max(1, Math.round(baseHeight * 0.05));
  const canvas = drawImageToCanvas(img, finalW, finalH, crop, settings.format);
  const blob = await getCanvasBlob(canvas, settings.format, 0.01);
  return {
    blob,
    width: finalW,
    height: finalH,
    qualityUsed: 0.01,
    scaleUsed: 0.05,
    iterations: iterations + 1,
  };
}

/**
 * Format bytes into a beautiful, human-readable string.
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Helper function to apply a sharpening convolution matrix to a canvas
 * Skips fully transparent pixels to prevent dark halos on cutouts.
 */
export const applySharpening = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // 3x3 Sharpening kernel
  const weights = [
     0, -1,  0,
    -1,  5, -1,
     0, -1,  0
  ];
  
  // Create a copy of the data to read from
  const copy = new Uint8ClampedArray(data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstOff = (y * width + x) * 4;
      if (copy[dstOff + 3] === 0) continue; // Skip fully transparent pixels
      
      let r = 0, g = 0, b = 0;
      
      for (let cy = 0; cy < 3; cy++) {
        for (let cx = 0; cx < 3; cx++) {
          const scy = y + cy - 1;
          const scx = x + cx - 1;
          
          if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
            const srcOff = (scy * width + scx) * 4;
            const wt = weights[cy * 3 + cx];
            const hasAlpha = copy[srcOff + 3] > 0;
            
            // If neighboring pixel is transparent, fall back to current pixel's color to avoid dark blending
            r += (hasAlpha ? copy[srcOff] : copy[dstOff]) * wt;
            g += (hasAlpha ? copy[srcOff + 1] : copy[dstOff + 1]) * wt;
            b += (hasAlpha ? copy[srcOff + 2] : copy[dstOff + 2]) * wt;
          }
        }
      }
      
      data[dstOff] = r;
      data[dstOff + 1] = g;
      data[dstOff + 2] = b;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
};
