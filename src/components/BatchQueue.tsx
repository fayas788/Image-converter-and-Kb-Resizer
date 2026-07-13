import React from 'react';
import { Trash2, Download, Image as ImageIcon, Sparkles, CheckCircle2, XCircle, Loader2, ListOrdered, DownloadCloud, Plus } from 'lucide-react';
import { ImageFile } from '../types';
import { formatBytes } from '../utils/compressor';

interface BatchQueueProps {
  queue: ImageFile[];
  activeId: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (image: ImageFile) => void;
  onDownloadAll: () => void;
  onAddFiles?: () => void;
}

export default function BatchQueue({
  queue,
  activeId,
  onSelect,
  onRemove,
  onDownload,
  onDownloadAll,
  onAddFiles,
}: BatchQueueProps) {
  if (queue.length === 0) return null;

  return (
    <div id="batch-queue-container" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-4">
      {/* Queue Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-teal-600" />
            <span className="text-sm font-bold text-slate-800">
              Uploaded Photos Queue ({queue.length})
            </span>
          </div>
          {onAddFiles && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddFiles(); }}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded cursor-pointer transition-colors"
              title="Add more photos"
            >
              <Plus className="h-3.5 w-3.5" />
              Add More
            </button>
          )}
        </div>

        {queue.some((img) => img.status === 'success') && (
          <button
            onClick={onDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            <DownloadCloud className="h-4 w-4" />
            Download All (Batch)
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {queue.map((img) => {
          const isActive = img.id === activeId;
          const hasCompressed = img.status === 'success' && img.compressedSize;

          return (
            <div
              key={img.id}
              onClick={() => onSelect(img.id)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                isActive
                  ? 'bg-teal-50/40 border-teal-200 shadow-sm'
                  : 'bg-white border-slate-200 hover:bg-slate-50/40'
              }`}
            >
              {/* Thumbnail + Name */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative h-12 w-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  <img
                    src={img.originalUrl}
                    alt={img.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isActive && (
                    <div className="absolute inset-0 bg-teal-600/10 border-2 border-teal-600 rounded-lg pointer-events-none" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-700 truncate" title={img.name}>
                    {img.name}
                  </span>
                  
                  {/* Sizing Comparison */}
                  <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400 mt-0.5">
                    <span>{formatBytes(img.originalSize)}</span>
                    {hasCompressed && (
                      <>
                        <span className="text-slate-300">▶</span>
                        <span className="text-teal-600 font-extrabold">{formatBytes(img.compressedSize || 0)}</span>
                        <span className="text-emerald-500 font-bold">
                          (-{(((img.originalSize - (img.compressedSize || 0)) / img.originalSize) * 100).toFixed(0)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                {/* Status indicator icon */}
                {img.status === 'processing' && (
                  <Loader2 className="h-4 w-4 text-teal-500 animate-spin" />
                )}
                {img.status === 'success' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" title="Successfully Optimized" />
                )}
                {img.status === 'failed' && (
                  <XCircle className="h-4 w-4 text-rose-500" title={img.error || 'Failed'} />
                )}

                {/* Individual Download */}
                {img.status === 'success' && (
                  <button
                    onClick={() => onDownload(img)}
                    title="Download compressed image"
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-teal-600 transition-colors border border-slate-200 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Remove from list */}
                <button
                  onClick={() => onRemove(img.id)}
                  title="Remove from queue"
                  className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors border border-transparent hover:border-slate-100 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
