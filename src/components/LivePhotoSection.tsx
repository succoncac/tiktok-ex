import React, { useState } from 'react';
import { LivePhotoItem } from '../types';
import { downloadMedia, copyToClipboard } from '../utils/media';
import { Flame, Play, Pause, Download, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';

interface LivePhotoSectionProps {
  livePhotos: LivePhotoItem[];
  motionPreviewUrl: string;
  authorHandle: string;
  postId: string;
}

export const LivePhotoSection: React.FC<LivePhotoSectionProps> = ({
  livePhotos,
  motionPreviewUrl,
  authorHandle,
  postId,
}) => {
  const [activeMotionIndex, setActiveMotionIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleDownloadStatic = async (url: string, index: number) => {
    const filename = `tiktok_@${authorHandle}_${postId}_live_frame_${index + 1}.jpg`;
    await downloadMedia(url, filename);
  };

  const handleDownloadMotion = async () => {
    if (!motionPreviewUrl) return;
    const filename = `tiktok_@${authorHandle}_${postId}_live_motion.mp4`;
    await downloadMedia(motionPreviewUrl, filename);
  };

  const handleCopyLink = async (url: string, index: number) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Dynamic / Live Photos</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-semibold flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              Live Photo Frames
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Original dynamic photo assets with high-resolution still frames and synchronized motion video
          </p>
        </div>

        {motionPreviewUrl && (
          <button
            onClick={handleDownloadMotion}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-[#fe2c55] hover:brightness-110 active:scale-95 rounded-xl transition-all shadow-lg shadow-purple-600/20 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Live Motion Video (.MP4)</span>
          </button>
        )}
      </div>

      {/* Grid of Live photo items */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {livePhotos.map((item, idx) => {
          const isPlayingMotion = activeMotionIndex === idx;

          return (
            <div
              key={idx}
              className="relative bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden shadow-lg flex flex-col group"
            >
              <div className="relative aspect-[3/4] bg-black overflow-hidden flex items-center justify-center">
                {isPlayingMotion && motionPreviewUrl ? (
                  <video
                    src={motionPreviewUrl}
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={item.image_url}
                    alt={`Live frame ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}

                {/* Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[11px] font-bold text-white border border-white/10 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Frame #{item.index}
                </div>

                {/* Toggle Motion Button */}
                {motionPreviewUrl && (
                  <button
                    onClick={() => setActiveMotionIndex(isPlayingMotion ? null : idx)}
                    className="absolute bottom-3 right-3 p-2 rounded-xl bg-purple-600/90 hover:bg-purple-600 text-white backdrop-blur-md shadow-lg transition-transform hover:scale-110 flex items-center gap-1 text-xs font-bold"
                    title={isPlayingMotion ? 'Pause Motion' : 'Play Live Motion'}
                  >
                    {isPlayingMotion ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPlayingMotion ? 'Stop' : 'Live'}</span>
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <div className="p-3 bg-zinc-950 flex items-center justify-between gap-1 border-t border-zinc-850">
                <button
                  onClick={() => handleDownloadStatic(item.image_url, idx)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold text-zinc-200 bg-zinc-800/90 hover:bg-zinc-700 hover:text-white rounded-lg transition-colors border border-zinc-700/60 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>Save Still</span>
                </button>

                <button
                  onClick={() => handleCopyLink(item.image_url, idx)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                  title="Copy frame link"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
