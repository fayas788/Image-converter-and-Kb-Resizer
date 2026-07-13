import React, { useState, useRef, useEffect, useCallback } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { Sparkles, Eraser, RotateCcw, Download, MousePointer2, Settings2, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '../utils/compressor';

interface BgRemoverProps {
  imageUrl: string;
  imageName: string;
  originalSize: number;
  onBgRemovedUrl?: (url: string) => void;
  onApply?: (url: string, size: number) => void;
}

type BgColor = 'transparent' | 'white' | 'black' | 'custom';

export default function BgRemover({ imageUrl, imageName, originalSize, onBgRemovedUrl, onApply }: BgRemoverProps) {
  // UI States
  const [tolerance, setTolerance] = useState(30);
  const [isContiguous, setIsContiguous] = useState(true);
  const [bgColor, setBgColor] = useState<BgColor>('transparent');
  const [customColor, setCustomColor] = useState('#ffffff');
  
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoRemoving, setIsAutoRemoving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [erasedCount, setErasedCount] = useState(0);
  const [addShadow, setAddShadow] = useState(false);

  // Refs for logic
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalDataRef = useRef<ImageData | null>(null);
  const maskRef = useRef<Uint8Array | null>(null);

  // 1. Load image data on mount
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = img.naturalWidth;
      cvs.height = img.naturalHeight;
      const ctx = cvs.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      originalDataRef.current = ctx.getImageData(0, 0, cvs.width, cvs.height);
      maskRef.current = new Uint8Array(cvs.width * cvs.height).fill(255); // 255 = solid
      setIsLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 2. Render Result (combines original data + mask + bg color)
  const renderResult = useCallback(() => {
    if (!originalDataRef.current || !maskRef.current || !canvasRef.current) return;
    
    const orig = originalDataRef.current;
    const mask = maskRef.current;
    const width = orig.width;
    const height = orig.height;
    
    const cvs = canvasRef.current;
    cvs.width = width;
    cvs.height = height;
    const ctx = cvs.getContext('2d')!;
    
    const outData = ctx.createImageData(width, height);
    
    // Parse bg color
    let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
    if (bgColor === 'white') { bgR = 255; bgG = 255; bgB = 255; bgA = 255; }
    else if (bgColor === 'black') { bgR = 0; bgG = 0; bgB = 0; bgA = 255; }
    else if (bgColor === 'custom') {
      const hex = customColor.replace('#', '');
      bgR = parseInt(hex.substring(0, 2), 16) || 0;
      bgG = parseInt(hex.substring(2, 4), 16) || 0;
      bgB = parseInt(hex.substring(4, 6), 16) || 0;
      bgA = 255;
    }

    // Prepare cutout image data (always transparent background initially to allow drop shadow)
    for (let i = 0; i < mask.length; i++) {
      const dataIdx = i * 4;
      const m = mask[i]; // 255 or 0
      
      if (m === 0) { // erased
        outData.data[dataIdx] = 0;
        outData.data[dataIdx+1] = 0;
        outData.data[dataIdx+2] = 0;
        outData.data[dataIdx+3] = 0; // completely transparent
      } else {
        outData.data[dataIdx] = orig.data[dataIdx];
        outData.data[dataIdx+1] = orig.data[dataIdx+1];
        outData.data[dataIdx+2] = orig.data[dataIdx+2];
        outData.data[dataIdx+3] = orig.data[dataIdx+3]; // keep original alpha
      }
    }
    
    // Draw background color first
    if (bgColor !== 'transparent') {
      ctx.fillStyle = `rgba(${bgR}, ${bgG}, ${bgB}, ${bgA / 255})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    
    // Draw the cutout (with or without shadow)
    const tempCvs = document.createElement('canvas');
    tempCvs.width = width;
    tempCvs.height = height;
    const tempCtx = tempCvs.getContext('2d')!;
    tempCtx.putImageData(outData, 0, 0);

    ctx.save();
    if (addShadow) {
      // Simulate a natural drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
    }
    ctx.drawImage(tempCvs, 0, 0);
    ctx.restore();
    
    // Generate blob url for download / preview
    cvs.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setResultUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setResultSize(blob.size);
        if (onBgRemovedUrl) onBgRemovedUrl(url);
      }
    }, 'image/png');
  }, [bgColor, customColor, addShadow, onBgRemovedUrl]);

  // Initial render when loaded
  useEffect(() => {
    if (isLoaded) {
      renderResult();
    }
  }, [isLoaded, renderResult]);

  // 3. Handle Canvas Click to Erase
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!originalDataRef.current || !maskRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    
    // Coordinates mapping
    const cvs = canvasRef.current;
    const rect = cvs.getBoundingClientRect();
    const scaleX = cvs.width / rect.width;
    const scaleY = cvs.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Defer heavy processing to allow UI to show loading state if needed
    setTimeout(() => {
      const orig = originalDataRef.current!;
      const width = orig.width;
      const height = orig.height;
      const data = orig.data;
      
      if (x < 0 || x >= width || y < 0 || y >= height) {
        setIsProcessing(false);
        return;
      }
      
      const startIdx = (y * width + x) * 4;
      const targetR = data[startIdx];
      const targetG = data[startIdx+1];
      const targetB = data[startIdx+2];
      
      const colorDist = (r: number, g: number, b: number) => {
        return Math.sqrt((r-targetR)**2 + (g-targetG)**2 + (b-targetB)**2);
      };
      
      const mask = maskRef.current!;
      
      if (isContiguous) {
        // Flood fill using Int32Array stack (very fast)
        const stack = new Int32Array(width * height * 2);
        let stackSize = 0;
        stack[stackSize++] = x;
        stack[stackSize++] = y;
        
        const visited = new Uint8Array(width * height);
        visited[y * width + x] = 1;
        
        while (stackSize > 0) {
          const cy = stack[--stackSize];
          const cx = stack[--stackSize];
          
          const idx = (cy * width + cx) * 4;
          const dist = colorDist(data[idx], data[idx+1], data[idx+2]);
          
          if (dist <= tolerance) {
            mask[cy * width + cx] = 0; // erase
            
            // push neighbors
            if (cx > 0 && !visited[cy * width + (cx - 1)]) {
              stack[stackSize++] = cx - 1;
              stack[stackSize++] = cy;
              visited[cy * width + (cx - 1)] = 1;
            }
            if (cx < width - 1 && !visited[cy * width + (cx + 1)]) {
              stack[stackSize++] = cx + 1;
              stack[stackSize++] = cy;
              visited[cy * width + (cx + 1)] = 1;
            }
            if (cy > 0 && !visited[(cy - 1) * width + cx]) {
              stack[stackSize++] = cx;
              stack[stackSize++] = cy - 1;
              visited[(cy - 1) * width + cx] = 1;
            }
            if (cy < height - 1 && !visited[(cy + 1) * width + cx]) {
              stack[stackSize++] = cx;
              stack[stackSize++] = cy + 1;
              visited[(cy + 1) * width + cx] = 1;
            }
          }
        }
      } else {
        // Global replacement
        for (let i = 0; i < mask.length; i++) {
          if (mask[i] === 0) continue;
          const idx = i * 4;
          const dist = colorDist(data[idx], data[idx+1], data[idx+2]);
          if (dist <= tolerance) {
            mask[i] = 0; // erase
          }
        }
      }
      
      setErasedCount(c => c + 1);
      renderResult();
      setIsProcessing(false);
    }, 10);
  };

  const handleAutoRemove = async () => {
    if (!originalDataRef.current || !maskRef.current || !canvasRef.current) return;
    
    setIsAutoRemoving(true);
    try {
      // Use imgly to get blob
      const blob = await removeBackground(imageUrl);
      
      // We need to apply this blob to our mask
      const img = new Image();
      const objUrl = URL.createObjectURL(blob);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const cvs = document.createElement('canvas');
          const width = originalDataRef.current!.width;
          const height = originalDataRef.current!.height;
          cvs.width = width;
          cvs.height = height;
          const ctx = cvs.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height); // draw cutout scaled to original bounds
          
          const cutoutData = ctx.getImageData(0, 0, width, height).data;
          
          // Update mask based on alpha channel of cutout
          let changes = 0;
          for (let i = 0; i < maskRef.current!.length; i++) {
            const alpha = cutoutData[i * 4 + 3];
            if (alpha < 128) {
              if (maskRef.current![i] !== 0) changes++;
              maskRef.current![i] = 0; // erase
            } else {
              maskRef.current![i] = 255; // keep
            }
          }
          
          if (changes > 0) setErasedCount(c => c + 1); // just to trigger UI update indicating edits
          renderResult();
          resolve();
        };
        img.onerror = reject;
        img.src = objUrl;
      });
      
      URL.revokeObjectURL(objUrl);
    } catch (error) {
      console.error('Failed to auto remove background:', error);
      alert('Failed to auto remove background. Check console for details.');
    } finally {
      setIsAutoRemoving(false);
    }
  };

  const handleReset = () => {
    if (maskRef.current) {
      maskRef.current.fill(255);
      setErasedCount(0);
      renderResult();
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const baseName = imageName.substring(0, imageName.lastIndexOf('.')) || imageName;
    const suffix = bgColor === 'transparent' ? 'nobg' : `bg-${bgColor}`;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `${baseName}_${suffix}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const bgOptions: { value: BgColor; label: string; color: string | null }[] = [
    { value: 'transparent', label: 'Transparent', color: null },
    { value: 'white', label: 'White', color: '#ffffff' },
    { value: 'black', label: 'Black', color: '#000000' },
    { value: 'custom', label: 'Custom', color: customColor },
  ];

  return (
    <div id="bg-remover-panel" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-violet-50 rounded-xl border border-violet-100">
          <Eraser className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 leading-tight">Interactive Background Eraser</h3>
          <p className="text-xs text-slate-500 mt-0.5">Click the image to erase colors instantly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Canvas Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <MousePointer2 className="h-3.5 w-3.5" />
              Click colors below to erase
            </span>
            {erasedCount > 0 && (
              <span className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                {erasedCount} edit{erasedCount !== 1 ? 's' : ''} applied
              </span>
            )}
          </div>
          
          <div 
            className={`relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-crosshair transition-opacity ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
            style={bgColor === 'transparent' ? {
              backgroundImage: 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(135deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(135deg, transparent 75%, #e2e8f0 75%)',
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 8px 8px, 8px 8px, 0 0',
            } : {}}
          >
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-400">
                Loading image...
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              onClick={handleCanvasClick}
              className="w-full h-auto max-h-[400px] object-contain block touch-none"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Controls */}
        <div className="space-y-6">

          {/* Auto Remove AI */}
          <div className="space-y-4 bg-teal-50 p-4 rounded-xl border border-teal-200">
            <h4 className="text-xs font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4" />
              AI Auto-Removal
            </h4>
            
            <button
              onClick={handleAutoRemove}
              disabled={isAutoRemoving}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                isAutoRemoving 
                  ? 'bg-teal-200 text-teal-600 cursor-wait'
                  : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-100 cursor-pointer'
              }`}
            >
              {isAutoRemoving ? (
                <>
                  <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  Processing AI...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Auto Remove Background
                </>
              )}
            </button>

            <label className="flex items-center gap-2 cursor-pointer mt-3">
              <input 
                type="checkbox" 
                checked={addShadow}
                onChange={(e) => {
                  setAddShadow(e.target.checked);
                  // Render immediately without waiting since it's just shadow processing
                }}
                className="w-4 h-4 text-teal-600 rounded border-teal-300 focus:ring-teal-500"
              />
              <span className="text-sm font-bold text-teal-800">Keep / Add Synthetic Shadow</span>
            </label>
            <p className="text-xs text-teal-600/80 leading-relaxed pl-6">
              Applies a natural drop shadow to replace original shadows removed by the AI.
            </p>
          </div>
          
          {/* Eraser Settings */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Settings2 className="h-4 w-4 text-violet-500" />
              Eraser Settings
            </h4>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-700">Tolerance:</span>
                <span className="text-sm font-extrabold text-violet-600">{tolerance}</span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value))}
                className="w-full accent-violet-600 cursor-pointer h-2"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Higher tolerance removes a wider range of similar colors.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsContiguous(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${
                  isContiguous 
                    ? 'bg-violet-600 text-white border-violet-700 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Contiguous Area
              </button>
              <button
                onClick={() => setIsContiguous(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all border ${
                  !isContiguous 
                    ? 'bg-violet-600 text-white border-violet-700 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Global Color
              </button>
            </div>
          </div>

          {/* Background Replacement */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Replace Erased Area With:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {bgOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBgColor(opt.value)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                    bgColor === opt.value
                      ? 'bg-violet-50 border-violet-300 text-violet-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50/40'
                  }`}
                >
                  {opt.color !== null ? (
                    <div
                      className="w-5 h-5 rounded-md border border-slate-200 shadow-sm shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-md border border-dashed border-slate-300 bg-gradient-to-br from-slate-100 to-white flex items-center justify-center text-[8px] text-slate-400 font-mono shrink-0">
                      α
                    </div>
                  )}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {bgColor === 'custom' && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <label className="text-sm font-bold text-slate-600 shrink-0">Pick color:</label>
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-12 h-8 rounded-lg cursor-pointer border border-slate-200 bg-transparent"
                />
                <span className="text-sm font-mono text-slate-500">{customColor.toUpperCase()}</span>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="pt-2 flex flex-col gap-3">
            {erasedCount > 0 && (
              <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Original</span>
                  <span className="text-sm font-extrabold text-slate-700">{formatBytes(originalSize)}</span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Result (PNG)</span>
                  <span className="text-sm font-extrabold text-violet-600">{formatBytes(resultSize)}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={erasedCount === 0}
                className={`flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm rounded-xl transition-all border flex-1 ${
                  erasedCount > 0 
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer' 
                    : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="h-4 w-4" />
                Reset Image
              </button>
              
              <button
                onClick={handleDownload}
                disabled={!resultUrl}
                className={`flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm rounded-xl transition-all flex-1 ${
                  resultUrl
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
                    : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                }`}
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              
              <button
                onClick={() => {
                  if (resultUrl && onApply) {
                    onApply(resultUrl, resultSize);
                  }
                }}
                disabled={!resultUrl}
                className={`flex items-center justify-center gap-2 py-3 px-4 font-bold text-sm rounded-xl transition-all flex-[2] ${
                  resultUrl
                    ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-100 cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                Apply Changes
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
