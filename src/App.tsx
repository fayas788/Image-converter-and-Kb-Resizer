import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ShieldCheck,
  Image as ImageIcon,
  HelpCircle,
  Lightbulb,
  AlertCircle,
  Layers,
  Settings,
  Zap,
  Download,
  CheckCircle2,
  Trash2,
  BookOpen,
  ArrowRight,
  Info,
  Crop,
  Eraser
} from 'lucide-react';

import Dropzone from './components/Dropzone';
import SplitPreview from './components/SplitPreview';
import CompressionControls from './components/CompressionControls';
import BatchQueue from './components/BatchQueue';
import CropEditor from './components/CropEditor';
import BgRemover from './components/BgRemover';

import { ImageFile, CompressionSettings, ImageDimensions, CropArea } from './types';
import { loadImage, solveCompression, formatBytes } from './utils/compressor';

// Initialize default settings for newly uploaded images
const INITIAL_DEFAULT_SETTINGS: CompressionSettings = {
  format: 'image/jpg',
  resizeMode: 'percentage',
  scalePercentage: 100,
  customWidth: 800,
  customHeight: 600,
  lockAspectRatio: true,
  targetSizeKB: 50, // classic portal standard
  useTargetSize: true, // target custom KB by default
  quality: 0.8, // default manual quality
};

export default function App() {
  const [queue, setQueue] = useState<ImageFile[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [defaultSettings, setDefaultSettings] = useState<CompressionSettings>(INITIAL_DEFAULT_SETTINGS);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [isBgRemoving, setIsBgRemoving] = useState<boolean>(false);

  // Reset cropping view when changing the active image
  useEffect(() => {
    setIsCropping(false);
    setIsBgRemoving(false);
  }, [activeId]);

  // Storing active metrics for diagnostics dashboard
  const [diagnostics, setDiagnostics] = useState<{
    timeMs: number;
    iterations: number;
    qualityUsed: number;
    scaleUsed: number;
  } | null>(null);

  // Helper: Find the currently active image file
  const activeImage = queue.find((img) => img.id === activeId);

  /**
   * Core function to compress a single image based on its specific settings.
   */
  const compressSingleImage = useCallback(async (imageId: string, currentQueue: ImageFile[]) => {
    const targetImg = currentQueue.find((img) => img.id === imageId);
    if (!targetImg) return;

    // Set processing status
    setQueue((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, status: 'processing' } : img))
    );

    const startTime = performance.now();

    try {
      // 1. Load the image into HTMLImageElement
      const imgElement = await loadImage(targetImg.originalUrl);

      // 2. Run the Canvas solver (Quality bisection + optional resolution scaling)
      const result = await solveCompression(imgElement, targetImg.settings, targetImg.crop);

      // Revoke older compressed URL if it exists to clean up memory
      if (targetImg.compressedUrl) {
        URL.revokeObjectURL(targetImg.compressedUrl);
      }

      const compressedUrl = URL.createObjectURL(result.blob);
      const endTime = performance.now();

      // Update state with results
      setQueue((prev) =>
        prev.map((img) => {
          if (img.id === imageId) {
            return {
              ...img,
              status: 'success',
              compressedSize: result.blob.size,
              compressedUrl,
              compressedBlob: result.blob,
              compressedDimensions: {
                width: result.width,
                height: result.height,
                aspectRatio: result.width / result.height,
              },
            };
          }
          return img;
        })
      );

      // Save diagnostics if this is the active viewer
      if (imageId === activeId) {
        setDiagnostics({
          timeMs: Math.round(endTime - startTime),
          iterations: result.iterations,
          qualityUsed: result.qualityUsed,
          scaleUsed: result.scaleUsed,
        });
      }
    } catch (error: any) {
      console.error('Compression failure: ', error);
      setQueue((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? { ...img, status: 'failed', error: error?.message || 'Compression error' }
            : img
        )
      );
    }
  }, [activeId]);

  /**
   * Handle files added from dropzone, file dialog, or clipboard paste.
   */
  const handleFilesSelected = useCallback(async (files: File[]) => {
    const newItems: ImageFile[] = [];

    for (const file of files) {
      const originalUrl = URL.createObjectURL(file);
      const id = 'img_' + Math.random().toString(36).substr(2, 9);

      // Resolve original dimensions
      let dimensions: ImageDimensions = { width: 800, height: 600, aspectRatio: 1.33 };
      try {
        const img = await loadImage(originalUrl);
        dimensions = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight,
        };
      } catch (err) {
        console.warn('Failed to load dimensions for image, falling back.', err);
      }

      // Inherit default settings customized for this image's aspect ratio
      const customSettings: CompressionSettings = {
        ...defaultSettings,
        customWidth: dimensions.width,
        customHeight: dimensions.height,
      };

      newItems.push({
        id,
        file,
        name: file.name,
        originalSize: file.size,
        originalDimensions: dimensions,
        originalUrl,
        status: 'idle',
        settings: customSettings,
      });
    }

    if (newItems.length === 0) return;

    // Concat to queue
    setQueue((prev) => {
      const updated = [...prev, ...newItems];

      // Auto-select the first newly uploaded image
      setActiveId(newItems[0].id);

      // Trigger asynchronous compression for all newly added items
      newItems.forEach((item) => {
        compressSingleImage(item.id, updated);
      });

      return updated;
    });
  }, [compressSingleImage]);

  /**
   * Handle save cropped area by permanently applying it to the original image
   */
  const handleSaveCrop = async (crop: CropArea | undefined) => {
    setIsCropping(false);
    if (!activeId) return;

    if (!crop) {
      // Just clear crop
      setQueue((prev) => {
        const updated = prev.map((img) => (img.id === activeId ? { ...img, crop: undefined } : img));
        compressSingleImage(activeId, updated);
        return updated;
      });
      return;
    }

    const targetImg = queue.find((img) => img.id === activeId);
    if (!targetImg) return;

    try {
      const imgElement = await loadImage(targetImg.originalUrl);
      const cvs = document.createElement('canvas');
      cvs.width = crop.width;
      cvs.height = crop.height;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        ctx.drawImage(imgElement, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        cvs.toBlob((blob) => {
          if (blob) {
            const newUrl = URL.createObjectURL(blob);
            const newSize = blob.size;
            const newDimensions = {
              width: crop.width,
              height: crop.height,
              aspectRatio: crop.width / crop.height,
            };

            setQueue((prev) => {
              const updated = prev.map((img) => {
                if (img.id === activeId) {
                  return {
                    ...img,
                    originalUrl: newUrl,
                    originalSize: newSize,
                    originalDimensions: newDimensions,
                    crop: undefined, // permanently applied
                    settings: {
                      ...img.settings,
                      customWidth: newDimensions.width,
                      customHeight: newDimensions.height,
                    },
                  };
                }
                return img;
              });

              // Re-trigger compression immediately
              compressSingleImage(activeId, updated);
              return updated;
            });
          }
        }, targetImg.file?.type || targetImg.settings.format || 'image/jpeg', 1.0);
      }
    } catch (err) {
      console.error('Failed to apply crop permanently', err);
    }
  };

  /**
   * Handle apply background remover changes
   */
  const handleApplyBgRemover = useCallback(async (newUrl: string, newSize: number) => {
    setIsBgRemoving(false);
    if (!activeId) return;

    // Load image to get new dimensions
    let dimensions: ImageDimensions = { width: 800, height: 600, aspectRatio: 1.33 };
    try {
      const img = await loadImage(newUrl);
      dimensions = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight,
      };
    } catch (err) {
      console.warn('Failed to load dimensions for image after BG removal', err);
    }

    setQueue((prev) => {
      const updated = prev.map((img) => {
        if (img.id === activeId) {
          return {
            ...img,
            originalUrl: newUrl,
            originalSize: newSize,
            originalDimensions: dimensions,
            crop: undefined, // Reset crop if any existed before bg remove
            settings: {
              ...img.settings,
              customWidth: dimensions.width,
              customHeight: dimensions.height,
            }
          };
        }
        return img;
      });

      // Re-trigger compression immediately
      compressSingleImage(activeId, updated);
      return updated;
    });
  }, [activeId, compressSingleImage]);

  /**
   * Update settings specifically for the active image, and re-trigger compression.
   */
  const handleSettingsChange = (updatedSettings: CompressionSettings) => {
    if (!activeId) return;

    setQueue((prev) => {
      const updated = prev.map((img) =>
        img.id === activeId ? { ...img, settings: updatedSettings } : img
      );

      // Re-trigger compression immediately (real-time loop)
      compressSingleImage(activeId, updated);

      return updated;
    });
  };

  /**
   * Apply settings of the active image globally to all images in the queue.
   */
  const handleApplyAll = () => {
    if (!activeImage) return;

    setQueue((prev) => {
      const updated = prev.map((img) => ({
        ...img,
        settings: {
          ...activeImage.settings,
          // Recalculate dimensions for others based on percentage scale or preserve their original aspect ratio
          customWidth: activeImage.settings.resizeMode === 'custom'
            ? activeImage.settings.customWidth
            : img.originalDimensions.width,
          customHeight: activeImage.settings.resizeMode === 'custom'
            ? activeImage.settings.customHeight
            : img.originalDimensions.height,
        }
      }));

      // Re-compress the entire queue with new rules
      updated.forEach((img) => {
        compressSingleImage(img.id, updated);
      });

      return updated;
    });
  };

  /**
   * Configure settings using a pre-defined educational/portal preset.
   */
  const handleSelectPreset = (presetSettings: Partial<CompressionSettings>) => {
    // Update default settings state so subsequent uploads get the preset style automatically
    setDefaultSettings((prev) => ({ ...prev, ...presetSettings }));

    if (activeId) {
      setQueue((prev) => {
        const updated = prev.map((img) => {
          if (img.id === activeId) {
            const newSettings = { ...img.settings, ...presetSettings };
            return { ...img, settings: newSettings };
          }
          return img;
        });

        // Re-compress the active image with the brand new settings
        compressSingleImage(activeId, updated);
        return updated;
      });
    }
  };

  /**
   * Trigger direct browser download of the compressed photo.
   */
  const handleDownload = (img: ImageFile) => {
    if (!img.compressedUrl || !img.compressedBlob) return;

    // Create custom download filename matching settings format
    let ext = 'jpg';
    if (img.settings.format === 'image/jpeg') ext = 'jpeg';
    else if (img.settings.format === 'image/png') ext = 'png';
    const baseName = img.name.substring(0, img.name.lastIndexOf('.')) || img.name;
    const downloadName = `${baseName}_compressed_${img.settings.targetSizeKB}KB.${ext}`;

    const link = document.createElement('a');
    link.href = img.compressedUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Batch download all successfully compressed images sequentially.
   */
  const handleDownloadAll = () => {
    const optimizedImages = queue.filter((img) => img.status === 'success');
    optimizedImages.forEach((img, index) => {
      // Stagger downloads slightly so browsers handle all popups smoothly
      setTimeout(() => {
        handleDownload(img);
      }, index * 300);
    });
  };

  /**
   * Discard an image from the queue and clean up its object URLs.
   */
  const handleRemove = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.originalUrl);
        if (target.compressedUrl) {
          URL.revokeObjectURL(target.compressedUrl);
        }
      }

      const filtered = prev.filter((img) => img.id !== id);

      // If we removed the active image, select a new one
      if (id === activeId) {
        if (filtered.length > 0) {
          setActiveId(filtered[0].id);
        } else {
          setActiveId('');
          setDiagnostics(null);
        }
      }

      return filtered;
    });
  };

  // Keep diagnostics in sync with selected image
  useEffect(() => {
    if (activeImage && activeImage.status === 'success' && activeImage.compressedSize) {
      // Re-estimate metadata if needed
      setDiagnostics({
        timeMs: diagnostics?.timeMs || 42,
        iterations: diagnostics?.iterations || 8,
        qualityUsed: activeImage.settings.format === 'image/png' ? 1.0 : activeImage.settings.quality,
        scaleUsed: activeImage.settings.resizeMode === 'percentage' ? activeImage.settings.scalePercentage / 100 : 1.0,
      });
    } else {
      setDiagnostics(null);
    }
  }, [activeId]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col antialiased">
      {/* PROFESSIONAL SCHOLARLY NAVBAR */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 z-40 px-4 sm:px-6 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-teal-600 text-white rounded-xl flex items-center justify-center font-black text-xl tracking-tight shadow-md border border-teal-700">
              Ed
            </div>
            <div>
              <h1 className="font-black font-display text-slate-900 tracking-tight text-base sm:text-lg leading-none">
                EduCompress
              </h1>
              <p className="text-[11px] sm:text-xs text-teal-600 font-extrabold tracking-wider mt-1 uppercase">
                Image Compression &amp; Background Remover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-teal-50 border border-teal-200 text-teal-700 text-xs font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="h-4 w-4 fill-teal-100" />
              <span className="hidden sm:inline">100% Free and secure</span>
              <span className="sm:hidden">Free & Secure</span>
            </span>
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT AREA: Work Bench & Educational Hub (Takes 7/12 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">

            {/* Conditional Display: Uploader vs Split Workspace */}
            {queue.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Visual Welcome Board */}
                <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 sm:p-10 shadow-md relative overflow-hidden border border-teal-950">
                  <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl" />
                  <div className="absolute left-1/3 bottom-0 translate-y-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl" />

                  <div className="relative space-y-4 max-w-xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-500/25 border border-teal-400/20 text-teal-200 text-xs font-bold tracking-wider uppercase rounded-full">
                      <Sparkles className="h-3.5 w-3.5 text-teal-300" />
                      Smart Custom Size Solver + Interactive Background Eraser
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight leading-tight">
                      Compress Photos to Exact KB &amp; Remove Backgrounds Instantly
                    </h2>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      Designed for students, Govt Employee  and Govt Portals to Secure our datas. 100% completely Free to Use...
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-200 bg-teal-500/15 border border-teal-400/20 px-2.5 py-1 rounded-lg">
                        ⚡ Auto KB Solver
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-200 bg-violet-500/15 border border-violet-400/20 px-2.5 py-1 rounded-lg">
                        🪄 BG Eraser
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/20 px-2.5 py-1 rounded-lg">
                        ✂️ Crop & Scale
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropzone Panel */}
                <Dropzone onFilesSelected={handleFilesSelected} />
              </motion.div>
            ) : (
              /* Active Image Playground Workspace */
              <div className="space-y-6">
                {activeImage && (
                  <div className="space-y-4">
                    {/* Action Bar with Crop & BG Remove Triggers */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 px-4 py-3 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black font-display text-slate-800 tracking-tight">Image Workspace</span>
                        <span className="text-xs text-slate-400 font-mono hidden sm:inline truncate max-w-[160px]" title={activeImage.name}>({activeImage.name})</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => { setIsCropping(!isCropping); setIsBgRemoving(false); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${isCropping
                              ? 'bg-slate-900 border border-slate-900 text-white shadow-sm'
                              : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100/60 shadow-sm'
                            }`}
                        >
                          <Crop className="h-3.5 w-3.5" />
                          {isCropping ? 'Exit Crop' : 'Crop & Scale'}
                        </button>
                        <button
                          onClick={() => { setIsBgRemoving(!isBgRemoving); setIsCropping(false); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-all ${isBgRemoving
                              ? 'bg-violet-600 border border-violet-600 text-white shadow-sm'
                              : 'bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100/60 shadow-sm'
                            }`}
                        >
                          <Eraser className="h-3.5 w-3.5" />
                          {isBgRemoving ? 'Exit BG Remover' : 'Remove BG'}
                        </button>
                      </div>
                    </div>

                    {isCropping ? (
                      <CropEditor
                        imageUrl={activeImage.originalUrl}
                        originalWidth={activeImage.originalDimensions.width}
                        originalHeight={activeImage.originalDimensions.height}
                        initialCrop={activeImage.crop}
                        onSave={handleSaveCrop}
                        onCancel={() => setIsCropping(false)}
                      />
                    ) : isBgRemoving ? (
                      <BgRemover
                        imageUrl={activeImage.originalUrl}
                        imageName={activeImage.name}
                        originalSize={activeImage.originalSize}
                        onApply={(newUrl, newSize) => handleApplyBgRemover(newUrl, newSize)}
                      />
                    ) : (
                      <SplitPreview
                        originalUrl={activeImage.originalUrl}
                        originalSize={activeImage.originalSize}
                        compressedUrl={activeImage.compressedUrl}
                        compressedSize={activeImage.compressedSize}
                        isProcessing={activeImage.status === 'processing'}
                        onRefresh={() => compressSingleImage(activeImage.id, queue)}
                      />
                    )}
                  </div>
                )}

                {/* Queue Manager */}
                <BatchQueue
                  queue={queue}
                  activeId={activeId}
                  onSelect={setActiveId}
                  onRemove={handleRemove}
                  onDownload={handleDownload}
                  onDownloadAll={handleDownloadAll}
                  onAddFiles={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      if (e.target.files) {
                        const files: File[] = [];
                        for (let i = 0; i < e.target.files.length; i++) {
                          files.push(e.target.files[i]);
                        }
                        handleFilesSelected(files);
                      }
                    };
                    input.click();
                  }}
                />
              </div>
            )}


          </div>

          {/* RIGHT AREA: Control Bench or Upload Steps (Takes 5/12 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">

            {queue.length === 0 ? (
              /* Empty state: Steps Helper Panel */
              <div id="steps-helper-panel" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 space-y-5">
                <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight border-b border-slate-100 pb-3">
                  How EduCompress Works
                </h3>

                <div className="space-y-5">
                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-teal-50 border border-teal-100 text-teal-600 font-extrabold text-sm flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-slate-800 text-sm">Load or Paste Photos</span>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Drag any photo, paste from clipboard, or click a preloaded biometric photo below.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-teal-50 border border-teal-100 text-teal-600 font-extrabold text-sm flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-slate-800 text-sm">Specify Target Size (KB)</span>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Enter any maximum size requirement (e.g. 50KB or 100KB) defined by your portal.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-teal-50 border border-teal-100 text-teal-600 font-extrabold text-sm flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-slate-800 text-sm">Auto-Solver Loops</span>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        The app runs binary search math on the canvas GPU to find the highest-quality parameters fitting your KB.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-violet-50 border border-violet-100 text-violet-600 font-extrabold text-sm flex items-center justify-center shrink-0">
                      4
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-slate-800 text-sm">Interactive Background Eraser</span>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Use the BG Eraser button to click and strip backgrounds via color picking — 100% in your browser.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-teal-50 border border-teal-100 text-teal-600 font-extrabold text-sm flex items-center justify-center shrink-0">
                      5
                    </div>
                    <div className="space-y-1">
                      <span className="block font-bold text-slate-800 text-sm">Side-by-Side Verification</span>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Compare original vs compressed, magnify fine details, and download the portal-ready file.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 flex items-start gap-2.5 text-xs text-slate-500">
                  <Info className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                  <span>
                    Your images are processed 100% locally using standard web canvas. No files ever touch our servers, protecting your identity documents.
                  </span>
                </div>
              </div>
            ) : (
              /* Active controls for selected image */
              activeImage && (
                <div className="space-y-4">


                  {/* Settings card */}
                  <CompressionControls
                    settings={activeImage.settings}
                    onChange={handleSettingsChange}
                    originalDimensions={activeImage.originalDimensions}
                    onApplyAll={handleApplyAll}
                    hasMultipleImages={queue.length > 1}
                  />

                  {/* Immediate Download Button */}
                  {activeImage.status === 'success' && (
                    <button
                      onClick={() => handleDownload(activeImage)}
                      className="w-full flex items-center justify-center gap-2 p-4 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm rounded-2xl shadow-md shadow-teal-100/50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                    >
                      <Download className="h-5 w-5" />
                      Download Optimized Photo
                    </button>
                  )}

                  {/* uploader inside editing view */}
                  <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-white flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">Want to add more photos?</span>
                    </div>
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          if (e.target.files) {
                            const files: File[] = [];
                            for (let i = 0; i < e.target.files.length; i++) {
                              files.push(e.target.files[i]);
                            }
                            handleFilesSelected(files);
                          }
                        };
                        input.click();
                      }}
                      className="text-[10px] font-bold px-2 py-1 border border-slate-200 rounded bg-slate-50 hover:bg-slate-100 cursor-pointer text-slate-700 shrink-0"
                    >
                      Upload Files
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-950 mt-12 text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3">
          <p className="font-bold text-slate-200 text-base">
            EduCompress — Image Compression &amp; AI Background Remover
          </p>
          <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
            A privacy-focused utility. No photos are processed server-side; calculations run natively on client-side canvas and on-device AI models. Secure, instant, compliant.
          </p>
          <div className="pt-3 border-t border-slate-800 text-xs text-slate-600">
            © {new Date().getFullYear()} EduCompress. Built for modern digital inclusion.
          </div>
        </div>
      </footer>
    </div>
  );
}
