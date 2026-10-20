import React from 'react';
import { HistoryItem } from '../types';
import { X, Trash2, Clock, Film, Image as ImageIcon, Flame, ArrowRight, ExternalLink } from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#fe2c55]" />
            <h2 className="font-bold text-white text-base">Extraction History</h2>
            <span className="text-xs bg-zinc-850 px-2 py-0.5 rounded-full text-zinc-400 font-mono">
              {history.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-900 transition-colors"
                title="Clear all history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No extractions yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Any media you extract will be saved here for quick access
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id + item.extracted_at}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="p-3 bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800/90 hover:border-zinc-750 rounded-xl cursor-pointer transition-all flex items-start gap-3 group"
              >
                {/* Thumbnail */}
                <div className="w-12 h-16 rounded-lg bg-zinc-950 overflow-hidden shrink-0 border border-zinc-800 relative">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                      Media
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 p-0.5 bg-black/70 rounded text-[9px] text-white">
                    {item.content_type === 'images' ? (
                      <ImageIcon className="w-2.5 h-2.5" />
                    ) : item.content_type === 'live_photo' ? (
                      <Flame className="w-2.5 h-2.5 text-purple-400" />
                    ) : (
                      <Film className="w-2.5 h-2.5 text-[#fe2c55]" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-zinc-200 truncate">@{item.author}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(item.extracted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-snug">
                    {item.title || 'No caption'}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#25f4ee] group-hover:translate-x-1 transition-transform">
                    <span>Load media</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
