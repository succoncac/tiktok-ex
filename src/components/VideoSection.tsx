import React, { useState } from 'react';
import { VideoData } from '../types';
import { downloadMedia, copyToClipboard } from '../utils/media';
import { Download, Copy, Check, Sparkles, ShieldCheck } from 'lucide-react';

interface VideoSectionProps {
  video: VideoData;
  authorHandle: string;
  postId: string;
}

export const VideoSection: React.FC<VideoSectionProps> = ({ video, authorHandle, postId }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const activeStreamUrl = video.hd || video.no_watermark;
  const posterUrl = video.cover || video.dynamic_cover || '';

  const handleCopy = async () => {
    const success = await copyToClipboard(activeStreamUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const filename = `tiktok_@${authorHandle}_${postId}_nowatermark.mp4`;
      await downloadMedia(activeStreamUrl, filename);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Visual Video Preview with Poster Thumbnail */}
        <div className="md:col-span-5 flex justify-center">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[460px] w-full max-w-[280px] border border-zinc-800 shadow-2xl flex items-center justify-center">
            <video
              src={activeStreamUrl}
              poster={posterUrl}
              controls
              playsInline
              loop
              preload="metadata"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Video Actions & Details */}
        <div className="md:col-span-7 flex flex-col justify-center space-y-4">
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Đã xóa logo & watermark
            </span>
            <h2 className="text-xl font-bold text-white">Video không logo (MP4)</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Xem trước video ở khung bên trái và bấm nút bên dưới để tải hoặc sao chép liên kết.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full py-3.5 px-5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#fe2c55] to-[#e01440] hover:brightness-110 active:scale-[0.99] transition-all shadow-lg shadow-[#fe2c55]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              <span>{isDownloading ? 'Đang tải...' : 'Tải Video về máy'}</span>
            </button>

            <button
              onClick={handleCopy}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-zinc-200 bg-zinc-800 hover:bg-zinc-750 hover:text-white border border-zinc-700/80 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Đã sao chép link video!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#25f4ee]" />
                  <span>Sao chép link video</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-3">
            <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1">Link trực tiếp</div>
            <div className="text-xs font-mono text-zinc-400 truncate select-all">{activeStreamUrl}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
