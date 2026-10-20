import React, { useState, useEffect } from 'react';
import { downloadMedia, downloadImagesAsZip, copyToClipboard } from '../utils/media';
import { Download, Copy, Check, Eye, ChevronLeft, ChevronRight, X, ExternalLink, Archive, Images, ShieldCheck } from 'lucide-react';

interface PhotoCarouselSectionProps {
  images: string[];
  authorHandle: string;
  postId: string;
}

export const PhotoCarouselSection: React.FC<PhotoCarouselSectionProps> = ({ images, authorHandle, postId }) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : 0));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : images.length - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, images.length]);

  const handleCopySingle = async (url: string, index: number) => {
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const handleCopyAll = async () => {
    const allLinks = images.join('\n');
    const success = await copyToClipboard(allLinks);
    if (success) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    }
  };

  const handleDownloadSingle = async (url: string, index: number) => {
    const filename = `tiktok_@${authorHandle}_${postId}_photo_${index + 1}.jpg`;
    await downloadMedia(url, filename);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      setZipProgress({ current: 0, total: images.length });
      const zipName = `tiktok_@${authorHandle}_${postId}_photos.zip`;
      await downloadImagesAsZip(images, zipName, (current, total) => {
        setZipProgress({ current, total });
      });
    } catch (err) {
      console.error('Failed to create zip', err);
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Album ảnh gốc</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1">
              <Images className="w-3.5 h-3.5" />
              {images.length} ảnh
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Nhấp vào ảnh để xem to hoặc bấm nút tải từng ảnh / tải toàn bộ.
          </p>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Đã sao chép {images.length} link!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Sao chép tất cả link</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#fe2c55] to-pink-600 hover:brightness-110 active:scale-95 border border-pink-500/30 rounded-xl transition-all shadow-lg shadow-[#fe2c55]/20 disabled:opacity-60 cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isZipping ? 'Đang nén ZIP...' : `Tải tất cả (${images.length} ảnh .ZIP)`}</span>
          </button>
        </div>
      </div>

      {/* ZIP progress indicator */}
      {isZipping && zipProgress && (
        <div className="my-4 p-3 bg-zinc-950 border border-zinc-800 rounded-xl animate-in fade-in">
          <div className="flex justify-between items-center text-xs text-zinc-400 mb-1.5 font-medium">
            <span>Archiving photos into ZIP package...</span>
            <span className="font-mono text-zinc-200">
              {zipProgress.current} / {zipProgress.total} images ({Math.round((zipProgress.current / zipProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#fe2c55] to-[#25f4ee] h-full transition-all duration-200 rounded-full"
              style={{ width: `${(zipProgress.current / zipProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Gallery Grid */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((imgUrl, idx) => (
          <div
            key={idx}
            className="group relative bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col"
          >
            {/* Image Thumbnail Container */}
            <div
              className="relative aspect-[3/4] bg-zinc-900 cursor-pointer overflow-hidden"
              onClick={() => setLightboxIndex(idx)}
            >
              <img
                src={imgUrl}
                alt={`Slide ${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {/* Badge */}
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[11px] font-bold text-white border border-white/10">
                #{idx + 1}
              </div>

              {/* View Overlay on Hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <span className="p-2 rounded-xl bg-white/20 backdrop-blur-md text-white hover:scale-110 transition-transform">
                  <Eye className="w-5 h-5" />
                </span>
              </div>
            </div>

            {/* Bottom Card Controls */}
            <div className="p-3 bg-zinc-950 flex items-center justify-between gap-1 border-t border-zinc-850">
              <button
                onClick={() => handleDownloadSingle(imgUrl, idx)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold text-zinc-200 bg-zinc-800/90 hover:bg-zinc-700 hover:text-white rounded-lg transition-colors border border-zinc-700/60 cursor-pointer"
                title="Tải ảnh này về"
              >
                <Download className="w-3.5 h-3.5 text-[#25f4ee]" />
                <span>Tải về</span>
              </button>

              <button
                onClick={() => handleCopySingle(imgUrl, idx)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                title="Sao chép link ảnh"
              >
                {copiedIndex === idx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              <a
                href={imgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800 transition-colors"
                title="Mở ảnh gốc trong tab mới"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-lg flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          {/* Top Lightbox bar */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-700">
                Ảnh {lightboxIndex + 1} / {images.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadSingle(images[lightboxIndex], lightboxIndex)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#fe2c55] hover:bg-[#e01440] rounded-lg transition-colors shadow-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ảnh</span>
              </button>
              <button
                onClick={() => setLightboxIndex(null)}
                className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Image View */}
          <div className="relative flex-1 flex items-center justify-center p-2 my-2 overflow-hidden">
            <img
              src={images[lightboxIndex]}
              alt={`Slide ${lightboxIndex + 1}`}
              className="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl transition-all"
              referrerPolicy="no-referrer"
            />

            {/* Navigation buttons */}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : images.length - 1))}
                  className="absolute left-2 sm:left-4 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/80 backdrop-blur-md transition-all shadow-xl hover:scale-105"
                  title="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setLightboxIndex((prev) => (prev! < images.length - 1 ? prev! + 1 : 0))}
                  className="absolute right-2 sm:right-4 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/80 backdrop-blur-md transition-all shadow-xl hover:scale-105"
                  title="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails navigation strip */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-3xl mx-auto scrollbar-thin">
            {images.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setLightboxIndex(idx)}
                className={`relative shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  lightboxIndex === idx
                    ? 'border-[#fe2c55] scale-105 shadow-md shadow-[#fe2c55]/30'
                    : 'border-zinc-800 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={url}
                  alt={`Thumb ${idx + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
