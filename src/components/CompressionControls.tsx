import React, { useEffect } from 'react';
import { Settings, Lock, Unlock, Zap, HelpCircle, Check, Layers, Sliders, Target } from 'lucide-react';
import { CompressionSettings, ImageFormat, ImageDimensions } from '../types';

interface CompressionControlsProps {
  settings: CompressionSettings;
  onChange: (settings: CompressionSettings) => void;
  originalDimensions?: ImageDimensions;
  onApplyAll?: () => void;
  hasMultipleImages?: boolean;
}

export default function CompressionControls({
  settings,
  onChange,
  originalDimensions,
  onApplyAll,
  hasMultipleImages = false,
}: CompressionControlsProps) {

  const handleFormatChange = (format: ImageFormat) => {
    onChange({ ...settings, format });
  };

  const handleResizeModeChange = (resizeMode: 'percentage' | 'custom') => {
    onChange({ ...settings, resizeMode });
  };

  const handleWidthChange = (val: number) => {
    if (val <= 0) return;
    let updatedHeight = settings.customHeight;
    if (settings.lockAspectRatio && originalDimensions) {
      updatedHeight = Math.round(val / originalDimensions.aspectRatio);
    }
    onChange({
      ...settings,
      customWidth: val,
      customHeight: updatedHeight,
    });
  };

  const handleHeightChange = (val: number) => {
    if (val <= 0) return;
    let updatedWidth = settings.customWidth;
    if (settings.lockAspectRatio && originalDimensions) {
      updatedWidth = Math.round(val * originalDimensions.aspectRatio);
    }
    onChange({
      ...settings,
      customWidth: updatedWidth,
      customHeight: val,
    });
  };

  // Pre-load default custom dimensions if original dimensions become available
  useEffect(() => {
    if (originalDimensions && settings.customWidth === 800 && settings.customHeight === 600) {
      onChange({
        ...settings,
        customWidth: originalDimensions.width,
        customHeight: originalDimensions.height,
      });
    }
  }, [originalDimensions]);

  // Fast portal presets helper
  const applyPreset = (width: number, height: number) => {
    onChange({
      ...settings,
      resizeMode: 'custom',
      customWidth: width,
      customHeight: height,
    });
  };

  const applyKBPreset = (kb: number) => {
    onChange({
      ...settings,
      useTargetSize: true,
      targetSizeKB: kb,
    });
  };

  return (
    <div id="compression-control-panel" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 space-y-6">
      {/* SECTION 1: EXPORT FORMAT */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-teal-600" />
          1. Target Format
        </label>
        <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-150">
          {(['image/jpg', 'image/jpeg', 'image/png'] as ImageFormat[]).map((fmt) => {
            const label = fmt === 'image/jpg' ? 'JPG' : fmt === 'image/jpeg' ? 'JPEG' : 'PNG';
            const isActive = settings.format === fmt;
            return (
              <button
                key={fmt}
                onClick={() => handleFormatChange(fmt)}
                className={`py-2.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white text-teal-600 shadow-sm border border-teal-100/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/40'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          {(settings.format === 'image/jpg' || settings.format === 'image/jpeg') && '• JPG/JPEG: Classic photo format, high compatibility, lossy compression.'}
          {settings.format === 'image/png' && '• PNG: Perfect lossless vector/transparency, larger sizes.'}
        </p>
      </div>

      {/* SECTION 2: COMPRESSION TYPE (AUTOMATED KB SOLVER vs MANUAL) */}
      <div className="space-y-3 pt-4 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-teal-600" />
          2. Compression Target Mode
        </label>
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-150">
          <button
            onClick={() => onChange({ ...settings, useTargetSize: true })}
            className={`py-2.5 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
              settings.useTargetSize
                ? 'bg-white text-teal-600 shadow-sm border border-teal-100/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Zap className="h-3.5 w-3.5 fill-teal-50 text-teal-500" />
            Auto KB Solver
          </button>
          <button
            onClick={() => onChange({ ...settings, useTargetSize: false })}
            className={`py-2.5 px-3 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
              !settings.useTargetSize
                ? 'bg-white text-teal-600 shadow-sm border border-teal-100/50'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 text-slate-400" />
            Manual Quality
          </button>
        </div>

        {/* Solver Configuration */}
        {settings.useTargetSize ? (
          <div className="space-y-3 bg-teal-50/20 p-4 rounded-xl border border-teal-100/40">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Target File Size:</span>
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                <input
                  type="number"
                  min={2}
                  max={5000}
                  value={settings.targetSizeKB}
                  onChange={(e) => onChange({ ...settings, targetSizeKB: Math.max(1, parseInt(e.target.value) || 0) })}
                  className="w-14 text-sm font-extrabold text-teal-600 focus:outline-none text-right bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs font-extrabold text-slate-400">KB</span>
              </div>
            </div>

            <input
              type="range"
              min="5"
              max="500"
              step="5"
              value={settings.targetSizeKB > 500 ? 500 : settings.targetSizeKB}
              onChange={(e) => onChange({ ...settings, targetSizeKB: parseInt(e.target.value) })}
              className="w-full accent-teal-600 cursor-pointer h-2"
            />

            {/* Quick KB Portal Presets */}
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">Submission Portal Presets:</span>
              <div className="flex flex-wrap gap-2">
                {[20, 50, 100, 150, 200].map((kb) => (
                  <button
                    key={kb}
                    onClick={() => applyKBPreset(kb)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                      settings.targetSizeKB === kb
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-600'
                    }`}
                  >
                    {kb} KB
                  </button>
                ))}
              </div>
            </div>

            {settings.format === 'image/png' && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-100/50 mt-1 leading-relaxed">
                ⚠️ <strong>PNG is Lossless:</strong> Quality solvers cannot change PNG pixels. EduCompress will scale down image resolution in layers to hit your {settings.targetSizeKB}KB target instead.
              </p>
            )}
          </div>
        ) : (
          /* Manual Quality Slider */
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {settings.format === 'image/png' ? (
              <div className="text-center py-2 text-sm text-slate-500">
                PNG is lossless and holds absolute 100% vector-sharp colors. Quality values do not affect size.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">Quality Factor:</span>
                  <span className="text-sm font-extrabold text-teal-600">{Math.round(settings.quality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={settings.quality * 100}
                  onChange={(e) => onChange({ ...settings, quality: parseInt(e.target.value) / 100 })}
                  className="w-full accent-teal-600 cursor-pointer h-2"
                />
                <p className="text-xs text-slate-400">
                  * <strong>80% Quality</strong> is the classic sweet-spot for web delivery, slashing up to 85% of bytes with zero visible artifacting.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: RESIZING CONTROLS */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5 text-teal-600" />
          3. Resize Dimensions
        </label>

        {/* Scale Percentage vs Custom Pixels */}
        <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-sm font-semibold shadow-sm">
          <button
            onClick={() => handleResizeModeChange('percentage')}
            className={`flex-1 py-2 text-center rounded-md cursor-pointer transition-colors ${
              settings.resizeMode === 'percentage' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Scale Dial (%)
          </button>
          <button
            onClick={() => handleResizeModeChange('custom')}
            className={`flex-1 py-2 text-center rounded-md cursor-pointer transition-colors ${
              settings.resizeMode === 'custom' ? 'bg-white text-slate-800 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Specific Pixels
          </button>
        </div>

        {/* SCALE PERCENTAGE PANEL */}
        {settings.resizeMode === 'percentage' ? (
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-150">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">Scaling Value:</span>
              <span className="text-sm font-extrabold text-teal-600">{settings.scalePercentage}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={settings.scalePercentage}
              onChange={(e) => onChange({ ...settings, scalePercentage: parseInt(e.target.value) })}
              className="w-full accent-teal-600 cursor-pointer h-2"
            />
            {originalDimensions && (
              <div className="text-xs text-slate-400 bg-white p-2.5 rounded border border-slate-200 text-center font-mono">
                Will scale from {originalDimensions.width}x{originalDimensions.height} px to{' '}
                {Math.round((originalDimensions.width * settings.scalePercentage) / 100)}x
                {Math.round((originalDimensions.height * settings.scalePercentage) / 100)} px
              </div>
            )}
          </div>
        ) : (
          /* SPECIFIC PIXELS PANEL */
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Width (px)</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={settings.customWidth}
                  onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                  className="w-full text-sm font-bold bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Height (px)</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={settings.customHeight}
                  onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                  className="w-full text-sm font-bold bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 text-center"
                />
              </div>
            </div>

            {/* Lock Aspect Ratio Toggle */}
            <button
              onClick={() => onChange({ ...settings, lockAspectRatio: !settings.lockAspectRatio })}
              className={`flex items-center gap-2 text-xs font-bold select-none cursor-pointer p-2.5 w-full justify-center rounded-lg border transition-all ${
                settings.lockAspectRatio
                  ? 'bg-teal-50 border-teal-150 text-teal-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60'
              }`}
            >
              {settings.lockAspectRatio ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Aspect Ratio Locked
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  Aspect Ratio Unlocked
                </>
              )}
            </button>

            {/* Dimension Presets */}
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">Resolution Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => applyPreset(600, 600)}
                  className="text-xs font-bold px-2.5 py-1.5 bg-white hover:bg-slate-150 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  600x600 (Passport ID)
                </button>
                <button
                  onClick={() => applyPreset(1200, 630)}
                  className="text-xs font-bold px-2.5 py-1.5 bg-white hover:bg-slate-150 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  1200x630 (Web Card)
                </button>
                <button
                  onClick={() => applyPreset(1920, 1080)}
                  className="text-xs font-bold px-2.5 py-1.5 bg-white hover:bg-slate-150 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  1920x1080 (HD)
                </button>
                <button
                  onClick={() => applyPreset(500, 500)}
                  className="text-xs font-bold px-2.5 py-1.5 bg-white hover:bg-slate-150 text-slate-600 rounded border border-slate-200 cursor-pointer"
                >
                  500x500 (Avatar Square)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BATCH APPLY (ONLY SHOWS IF BATCH MODE HAS MULTIPLE IMAGES) */}
      {hasMultipleImages && onApplyAll && (
        <button
          onClick={onApplyAll}
          className="w-full flex items-center justify-center gap-2 p-3.5 bg-teal-50 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 text-teal-700 font-bold text-sm rounded-xl cursor-pointer transition-all duration-200 shadow-sm"
        >
          <Check className="h-4 w-4" />
          Apply these rules to all Uploaded Photos
        </button>
      )}
    </div>
  );
}
