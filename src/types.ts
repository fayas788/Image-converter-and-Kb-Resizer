export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/jpg';

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface CropArea {
  x: number;      // x coordinate in original image pixels
  y: number;      // y coordinate in original image pixels
  width: number;  // width in original image pixels
  height: number; // height in original image pixels
}

export interface CompressionSettings {
  format: ImageFormat;
  resizeMode: 'percentage' | 'custom';
  scalePercentage: number;
  customWidth: number;
  customHeight: number;
  lockAspectRatio: boolean;
  targetSizeKB: number; // For the automated solver
  useTargetSize: boolean; // Whether the user wants to target a specific KB
  quality: number; // Manual quality override, 0 to 1
}

export interface ImageFile {
  id: string;
  file: File;
  name: string;
  originalSize: number; // in bytes
  originalDimensions: ImageDimensions;
  originalUrl: string;
  crop?: CropArea;
  
  // Compression status and results
  status: 'idle' | 'processing' | 'success' | 'failed';
  error?: string;
  compressedSize?: number; // in bytes
  compressedUrl?: string;
  compressedDimensions?: ImageDimensions;
  compressedBlob?: Blob;
  
  // Settings customized specifically for this image (inherits defaults initially)
  settings: CompressionSettings;
}

export interface EducationalTopic {
  id: string;
  title: string;
  shortDesc: string;
  content: string;
  icon: string;
  badge?: string;
}
