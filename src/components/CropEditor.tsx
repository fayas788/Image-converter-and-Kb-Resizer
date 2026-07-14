import React, { useState, useRef, useEffect } from 'react';
import { CropArea } from '../types';
import { Crop, Check, X, RefreshCw, Maximize2, Wand2 } from 'lucide-react';

interface CropEditorProps {
  imageUrl: string;
  originalWidth: number;
  originalHeight: number;
  initialCrop?: CropArea;
  onSave: (crop: CropArea | undefined, applyEnhancement?: boolean) => void;
  onCancel: () => void;
}

type AspectRatioPreset = 'free' | '1:1' | '3:4' | '4:3' | '16:9';

export default function CropEditor({
  imageUrl,
  originalWidth,
  originalHeight,
  initialCrop,
  onSave,
  onCancel,
}: CropEditorProps) {
  // Crop coordinates in original image pixel units
  const [crop, setCrop] = useState<CropArea>(() => {
    if (initialCrop) return initialCrop;
    // Default to a centered 80% crop box
    const width = Math.round(originalWidth * 0.8);
    const height = Math.round(originalHeight * 0.8);
    const x = Math.round((originalWidth - width) / 2);
    const y = Math.round((originalHeight - height) / 2);
    return { x, y, width, height };
  });

  const [activePreset, setActivePreset] = useState<AspectRatioPreset>('free');
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Rendered dimensions of the image on screen (for scaling coordinates)
  const [renderedDim, setRenderedDim] = useState({ width: 0, height: 0 });

  // Update rendered dimensions once the image is loaded or container resizes
  const updateRenderedDimensions = () => {
    if (imageRef.current) {
      setRenderedDim({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
    }
  };

  useEffect(() => {
    updateRenderedDimensions();
    window.addEventListener('resize', updateRenderedDimensions);
    return () => window.removeEventListener('resize', updateRenderedDimensions);
  }, [imageUrl]);

  // Handle preset ratios
  const applyPreset = (preset: AspectRatioPreset) => {
    setActivePreset(preset);
    
    let targetRatio = 1;
    if (preset === '1:1') targetRatio = 1;
    else if (preset === '3:4') targetRatio = 3 / 4;
    else if (preset === '4:3') targetRatio = 4 / 3;
    else if (preset === '16:9') targetRatio = 16 / 9;
    else return; // 'free' maintains current box

    let w = originalWidth;
    let h = originalHeight;

    if (originalWidth / originalHeight > targetRatio) {
      // Image is wider than target ratio: crop width
      h = originalHeight * 0.9;
      w = h * targetRatio;
    } else {
      // Image is taller than target ratio: crop height
      w = originalWidth * 0.9;
      h = w / targetRatio;
    }

    w = Math.round(w);
    h = Math.round(h);
    const x = Math.round((originalWidth - w) / 2);
    const y = Math.round((originalHeight - h) / 2);

    setCrop({ x, y, width: w, height: h });
  };

  // Convert original pixels to screen percentages
  const scaleX = renderedDim.width > 0 ? originalWidth / renderedDim.width : 1;
  const scaleY = renderedDim.height > 0 ? originalHeight / renderedDim.height : 1;

  // Render crop box position in percentages of the rendered image width/height
  const pctLeft = renderedDim.width > 0 ? (crop.x / originalWidth) * 100 : 10;
  const pctTop = renderedDim.height > 0 ? (crop.y / originalHeight) * 100 : 10;
  const pctWidth = renderedDim.width > 0 ? (crop.width / originalWidth) * 100 : 80;
  const pctHeight = renderedDim.height > 0 ? (crop.height / originalHeight) * 100 : 80;

  // Drag state trackers
  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startCrop: CropArea;
    action: 'move' | 'nw' | 'ne' | 'sw' | 'se';
  } | null>(null);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    action: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragStartRef.current) return;

    // Capture the pointer
    e.currentTarget.setPointerCapture(e.pointerId);

    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
      action,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
    
    const drag = dragStartRef.current;
    // Distance dragged in screen pixels
    const dxScreen = e.clientX - drag.startX;
    const dyScreen = e.clientY - drag.startY;

    // Scale to original image pixels
    const dx = Math.round(dxScreen * scaleX);
    const dy = Math.round(dyScreen * scaleY);

    let nextCrop = { ...drag.startCrop };

    if (drag.action === 'move') {
      nextCrop.x = Math.max(0, Math.min(originalWidth - nextCrop.width, drag.startCrop.x + dx));
      nextCrop.y = Math.max(0, Math.min(originalHeight - nextCrop.height, drag.startCrop.y + dy));
    } else {
      // Corner resize points
      const isNorth = drag.action === 'nw' || drag.action === 'ne';
      const isSouth = drag.action === 'sw' || drag.action === 'se';
      const isWest = drag.action === 'nw' || drag.action === 'sw';
      const isEast = drag.action === 'ne' || drag.action === 'se';

      let newX = drag.startCrop.x;
      let newY = drag.startCrop.y;
      let newW = drag.startCrop.width;
      let newH = drag.startCrop.height;

      if (isWest) {
        newX = Math.max(0, Math.min(drag.startCrop.x + drag.startCrop.width - 20, drag.startCrop.x + dx));
        newW = drag.startCrop.width - (newX - drag.startCrop.x);
      } else if (isEast) {
        newW = Math.max(20, Math.min(originalWidth - drag.startCrop.x, drag.startCrop.width + dx));
      }

      if (isNorth) {
        newY = Math.max(0, Math.min(drag.startCrop.y + drag.startCrop.height - 20, drag.startCrop.y + dy));
        newH = drag.startCrop.height - (newY - drag.startCrop.y);
      } else if (isSouth) {
        newH = Math.max(20, Math.min(originalHeight - drag.startCrop.y, drag.startCrop.height + dy));
      }

      // Constrain to Aspect Ratio if not 'free'
      if (activePreset !== 'free') {
        let ratio = 1;
        if (activePreset === '1:1') ratio = 1;
        else if (activePreset === '3:4') ratio = 3 / 4;
        else if (activePreset === '4:3') ratio = 4 / 3;
        else if (activePreset === '16:9') ratio = 16 / 9;

        if (isEast || isWest) {
          newH = Math.round(newW / ratio);
          // adjust northern bounds if moving nw
          if (isNorth) {
            newY = drag.startCrop.y + drag.startCrop.height - newH;
          }
        } else {
          newW = Math.round(newH * ratio);
          if (isWest) {
            newX = drag.startCrop.x + drag.startCrop.width - newW;
          }
        }

        // Boundary safety check for forced aspect ratio
        if (newX < 0) {
          newW += newX;
          newX = 0;
          newH = Math.round(newW / ratio);
        }
        if (newY < 0) {
          newH += newY;
          newY = 0;
          newW = Math.round(newH * ratio);
        }
        if (newX + newW > originalWidth) {
          newW = originalWidth - newX;
          newH = Math.round(newW / ratio);
        }
        if (newY + newH > originalHeight) {
          newH = originalHeight - newY;
          newW = Math.round(newH * ratio);
        }
      }

      nextCrop = {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      };
    }

    setCrop(nextCrop);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || dragStartRef.current.pointerId !== e.pointerId) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragStartRef.current = null;
  };

  const handleReset = () => {
    setActivePreset('free');
    const width = Math.round(originalWidth * 0.9);
    const height = Math.round(originalHeight * 0.9);
    const x = Math.round((originalWidth - width) / 2);
    const y = Math.round((originalHeight - height) / 2);
    setCrop({ x, y, width, height });
  };

  const handleFullImage = () => {
    setActivePreset('free');
    setCrop({ x: 0, y: 0, width: originalWidth, height: originalHeight });
  };

  const handleAutoEnhanceCrop = () => {
    setActivePreset('free');
    if (!imageRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(imageRef.current, 0, 0);
    const imgData = ctx.getImageData(0, 0, originalWidth, originalHeight);
    const data = imgData.data;
    
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    
    const threshold = 25; 
    const isBg = (r: number, g: number, b: number) => {
        return Math.abs(r - bgR) < threshold && Math.abs(g - bgG) < threshold && Math.abs(b - bgB) < threshold;
    };
    
    let top = 0, bottom = originalHeight, left = 0, right = originalWidth;
    
    outTop: for (let y = 0; y < originalHeight; y++) {
        for (let x = 0; x < originalWidth; x++) {
            const i = (y * originalWidth + x) * 4;
            if (!isBg(data[i], data[i+1], data[i+2])) {
                top = y;
                break outTop;
            }
        }
    }
    outBottom: for (let y = originalHeight - 1; y >= 0; y--) {
        for (let x = 0; x < originalWidth; x++) {
            const i = (y * originalWidth + x) * 4;
            if (!isBg(data[i], data[i+1], data[i+2])) {
                bottom = y;
                break outBottom;
            }
        }
    }
    outLeft: for (let x = 0; x < originalWidth; x++) {
        for (let y = 0; y < originalHeight; y++) {
            const i = (y * originalWidth + x) * 4;
            if (!isBg(data[i], data[i+1], data[i+2])) {
                left = x;
                break outLeft;
            }
        }
    }
    outRight: for (let x = originalWidth - 1; x >= 0; x--) {
        for (let y = 0; y < originalHeight; y++) {
            const i = (y * originalWidth + x) * 4;
            if (!isBg(data[i], data[i+1], data[i+2])) {
                right = x;
                break outRight;
            }
        }
    }
    
    if (right <= left || bottom <= top) {
        left = Math.floor(originalWidth * 0.05);
        right = Math.floor(originalWidth * 0.95);
        top = Math.floor(originalHeight * 0.05);
        bottom = Math.floor(originalHeight * 0.95);
    } else {
        const pad = 15;
        left = Math.max(0, left - pad);
        top = Math.max(0, top - pad);
        right = Math.min(originalWidth, right + pad);
        bottom = Math.min(originalHeight, bottom + pad);
    }
    
    const w = right - left;
    const h = bottom - top;
    
    onSave({ x: left, y: top, width: w, height: h }, true);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden border border-slate-800 flex flex-col md:flex-row h-[550px] md:h-[600px]">
      
      {/* 1. Main Workspace: Interactive Canvas Display */}
      <div className="flex-1 relative bg-slate-950 p-4 flex items-center justify-center min-h-0 select-none">
        
        {/* Interactive Image Container */}
        <div
          ref={containerRef}
          className="relative max-w-full max-h-full"
          style={{ aspectRatio: `${originalWidth}/${originalHeight}` }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            onLoad={updateRenderedDimensions}
            className="max-w-full max-h-[420px] md:max-h-[480px] object-contain pointer-events-none rounded border border-white/5"
            alt="Source for cropping"
            referrerPolicy="no-referrer"
          />

          {/* Dimmable Background Masks (Overlay outside of crop frame) */}
          {renderedDim.width > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Top mask */}
              <div
                className="absolute bg-black/60 inset-x-0 top-0 transition-all duration-75"
                style={{ height: `${pctTop}%` }}
              />
              {/* Bottom mask */}
              <div
                className="absolute bg-black/60 inset-x-0 bottom-0 transition-all duration-75"
                style={{ height: `${100 - pctTop - pctHeight}%` }}
              />
              {/* Left mask */}
              <div
                className="absolute bg-black/60 left-0 transition-all duration-75"
                style={{
                  top: `${pctTop}%`,
                  height: `${pctHeight}%`,
                  width: `${pctLeft}%`,
                }}
              />
              {/* Right mask */}
              <div
                className="absolute bg-black/60 right-0 transition-all duration-75"
                style={{
                  top: `${pctTop}%`,
                  height: `${pctHeight}%`,
                  width: `${100 - pctLeft - pctWidth}%`,
                }}
              />
            </div>
          )}

          {/* Draggable Active Crop Window */}
          {renderedDim.width > 0 && (
            <div
              className="absolute border border-teal-400 cursor-move shadow-[0_0_0_1px_rgba(0,0,0,0.5),_inset_0_0_0_1px_rgba(255,255,255,0.2)]"
              style={{
                left: `${pctLeft}%`,
                top: `${pctTop}%`,
                width: `${pctWidth}%`,
                height: `${pctHeight}%`,
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* Rule of Thirds Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-dashed border-white/50 col-span-1 row-span-3" />
                <div className="border-r border-dashed border-white/50 col-span-1 row-span-3" />
                <div className="border-b border-dashed border-white/50 col-span-3 row-span-1 absolute inset-x-0 top-1/3" />
                <div className="border-b border-dashed border-white/50 col-span-3 row-span-1 absolute inset-x-0 top-2/3" />
              </div>

              {/* Resize Corner Handles */}
              <div
                className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-teal-400 border border-white rounded-full cursor-nwse-resize shadow-md active:scale-125 z-10"
                onPointerDown={(e) => handlePointerDown(e, 'nw')}
              />
              <div
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-teal-400 border border-white rounded-full cursor-nesw-resize shadow-md active:scale-125 z-10"
                onPointerDown={(e) => handlePointerDown(e, 'ne')}
              />
              <div
                className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-teal-400 border border-white rounded-full cursor-nesw-resize shadow-md active:scale-125 z-10"
                onPointerDown={(e) => handlePointerDown(e, 'sw')}
              />
              <div
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-teal-400 border border-white rounded-full cursor-nwse-resize shadow-md active:scale-125 z-10"
                onPointerDown={(e) => handlePointerDown(e, 'se')}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Side Panel: Aspect Ratio Presets and Controls */}
      <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-5 flex flex-col justify-between shrink-0 font-sans">
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-1.5 text-teal-400 font-bold text-xs tracking-wider uppercase mb-1">
              <Crop className="h-4 w-4" />
              Aspect Ratio Presets
            </div>
            <h3 className="text-base font-black font-display tracking-tight text-white leading-tight">
              Crop & Scale Photo
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Perfect for alignment checks, Biometric verification, and portrait cropping.
            </p>
          </div>

          {/* Aspect Ratio List */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'free', label: 'Free Aspect', desc: 'Custom Shape' },
              { id: '1:1', label: '1:1 Square', desc: 'Avatar / ID' },
              { id: '3:4', label: '3:4 Portrait', desc: 'Visa / Passport' },
              { id: '4:3', label: '4:3 Standard', desc: 'Normal Photo' },
              { id: '16:9', label: '16:9 Wide', desc: 'Banner Shape' },
            ].map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id as AspectRatioPreset)}
                  className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all ${
                    isActive
                      ? 'bg-teal-500/10 border-teal-500 text-teal-300'
                      : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="block font-bold text-xs">{preset.label}</span>
                  <span className="text-[9px] text-slate-400">{preset.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Manual crop coordinates status info */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl space-y-2 font-mono text-[10px]">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-sans block">
              Crop Box Pixel Area
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Left (X):</span>
                <span>{crop.x}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Width:</span>
                <span>{crop.width}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Top (Y):</span>
                <span>{crop.y}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Height:</span>
                <span>{crop.height}px</span>
              </div>
            </div>
            <div className="text-center text-slate-500 text-[9px] pt-1 border-t border-slate-800">
              Original: {originalWidth} × {originalHeight} px
            </div>
          </div>
        </div>

        {/* Buttons Action Group */}
        <div className="space-y-2 mt-5 md:mt-0">
          <button
            onClick={handleAutoEnhanceCrop}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-violet-900/50 transition-all mb-2"
          >
            <Wand2 className="h-4 w-4" />
            Auto Crop & Enhance
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleFullImage}
              className="py-2.5 px-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer text-slate-300"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Full Frame
            </button>
            <button
              onClick={handleReset}
              className="py-2.5 px-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer text-slate-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onCancel}
              className="py-3 px-4 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer text-slate-400"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              onClick={() => onSave(crop)}
              className="py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-teal-950/40"
            >
              <Check className="h-3.5 w-3.5" />
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
