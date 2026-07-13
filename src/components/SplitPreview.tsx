import React, { useState, useRef, useEffect } from 'react';
import { Eye, HelpCircle, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { formatBytes } from '../utils/compressor';

interface SplitPreviewProps {
  originalUrl: string;
  originalSize: number;
  compressedUrl?: string;
  compressedSize?: number;
  isProcessing: boolean;
  onRefresh?: () => void;
}

export default function SplitPreview({
  originalUrl,
  originalSize,
  compressedUrl,
  compressedSize,
  isProcessing,
  onRefresh,
}: SplitPreviewProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 to 100)
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100' | '200'>('fit');
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Drag logic
  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current) return;
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Clean up global listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const changeZoom = () => {
    if (zoomLevel === 'fit') setZoomLevel('100');
    else if (zoomLevel === '100') setZoomLevel('200');
    else setZoomLevel('fit');
  };

  const zoomClass = {
    fit: 'w-full h-full object-contain',
    '100': 'w-[100%] h-[100%] object-none object-center scale-100',
    '200': 'w-[100%] h-[100%] object-none object-center scale-200',
  };

  const showCompressed = compressedUrl && !isProcessing;

  return (
    <div id="comparison-slider-container" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
      {/* Visual Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-teal-600" />
          <span className="text-sm font-bold text-slate-800">
            Interactive Split-Screen Inspect Slider
          </span>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            (Drag divider line left/right)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Selector */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50 shadow-sm">
            <button
              onClick={() => setZoomLevel('fit')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md cursor-pointer transition-all ${
                zoomLevel === 'fit' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Fit
            </button>
            <button
              onClick={() => setZoomLevel('100')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md cursor-pointer transition-all ${
                zoomLevel === '100' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              1x Magnify
            </button>
            <button
              onClick={() => setZoomLevel('200')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md cursor-pointer transition-all ${
                zoomLevel === '200' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              2x Inspect
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Force recompute"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-teal-600 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Comparison Stage */}
      <div
        ref={containerRef}
        className="relative h-[300px] sm:h-[420px] md:h-[450px] w-full bg-slate-900 rounded-xl overflow-hidden select-none border border-slate-950 shadow-inner group"
      >
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/70 z-30 flex flex-col items-center justify-center text-white space-y-3 backdrop-blur-xs">
            <RefreshCw className="h-8 w-8 text-teal-400 animate-spin" />
            <span className="text-xs font-semibold tracking-wide text-slate-200">
              Automating KB Compression Solver...
            </span>
          </div>
        )}

        {/* BOTTOM LAYER: Original Image */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src={originalUrl}
            alt="Original Preview"
            className={`${zoomClass[zoomLevel]} pointer-events-none`}
            referrerPolicy="no-referrer"
          />
          {/* Label Original */}
          <span className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-mono tracking-wider px-2 py-1 rounded border border-white/10 select-none z-10 shadow-sm">
            ORIGINAL: {formatBytes(originalSize)}
          </span>
        </div>

        {/* TOP LAYER: Compressed Image (Clipped via sliding width) */}
        {showCompressed ? (
          <div
            className="absolute inset-0 h-full overflow-hidden z-10 border-r border-white/20"
            style={{ width: `${sliderPosition}%` }}
          >
            {/* We force the width of the inner image to match the container width so it doesn't squish */}
            <div
              className="absolute inset-0 h-full"
              style={{ width: containerRef.current?.getBoundingClientRect().width || '100%' }}
            >
              <img
                src={compressedUrl}
                alt="Compressed Preview"
                className={`${zoomClass[zoomLevel]} pointer-events-none`}
                referrerPolicy="no-referrer"
              />
              {/* Label Compressed */}
              <span className="absolute bottom-3 right-3 bg-teal-950/85 backdrop-blur-md text-teal-200 text-[10px] font-mono tracking-wider px-2 py-1 rounded border border-teal-500/20 select-none z-20 shadow-sm">
                COMPRESSED: {formatBytes(compressedSize || 0)}
              </span>
            </div>
          </div>
        ) : (
          !isProcessing && (
            <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center text-white p-4 text-center text-xs z-10 pointer-events-none">
              Apply compression settings in the right sidebar to preview optimization
            </div>
          )
        )}

        {/* DRAG HANDLE BAR */}
        {showCompressed && (
          <div
            className="absolute top-0 bottom-0 z-20 w-1 cursor-ew-resize bg-teal-500 hover:bg-teal-400 transition-colors"
            style={{ left: `${sliderPosition}%` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-teal-600 border-2 border-white shadow-md flex items-center justify-center text-white">
              {/* Simple arrow helper */}
              <div className="flex gap-0.5">
                <span className="text-[8px]">◀</span>
                <span className="text-[8px]">▶</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual Indicator of Savings */}
      {showCompressed && compressedSize && (
        <div id="size-reduction-savings-card" className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-150 rounded-xl text-center">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Reduction Ratio</span>
            <span className="text-base font-extrabold text-teal-600">
              {(originalSize / compressedSize).toFixed(1)}x Smaller
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Bandwidth Saved</span>
            <span className="text-base font-extrabold text-emerald-600">
              {(((originalSize - compressedSize) / originalSize) * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Bytes Cut</span>
            <span className="text-base font-extrabold text-slate-700">
              {formatBytes(originalSize - compressedSize)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
