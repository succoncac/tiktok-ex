import React, { useState } from 'react';
import { ExtractionResult } from './types';
import { Header } from './components/Header';
import { UrlInputForm } from './components/UrlInputForm';
import { AuthorCard } from './components/AuthorCard';
import { VideoSection } from './components/VideoSection';
import { PhotoCarouselSection } from './components/PhotoCarouselSection';
import { AudioSection } from './components/AudioSection';
import { ProfileFeedSection } from './components/ProfileFeedSection';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/extract?url=${encodeURIComponent(url)}`);
      const rawText = await response.text();
      const trimmed = rawText.trim();

      // Check if response is an HTML error page (Cloudflare challenge, 404/500 HTML error, etc.)
      if (
        trimmed.startsWith('<!DOCTYPE') ||
        trimmed.startsWith('<!doctype') ||
        trimmed.startsWith('<html') ||
        trimmed.startsWith('<head') ||
        trimmed.includes('<body')
      ) {
        let friendlyMsg = 'Dịch vụ trích xuất trả về trang web HTML thay vì dữ liệu JSON.';
        if (response.status === 404) {
          friendlyMsg = 'Không tìm thấy API trích xuất (/api/extract).';
        } else if (response.status === 502 || response.status === 504) {
          friendlyMsg = 'Máy chủ trung gian hoặc Proxy đang quá tải (502/504). Vui lòng thử lại sau vài giây.';
        } else if (response.status === 403) {
          friendlyMsg = 'Bị chặn bởi Cloudflare Security / Firewall. Vui lòng thử lại sau giây lát.';
        } else if (response.status >= 500) {
          friendlyMsg = `Lỗi máy chủ nội bộ (HTTP ${response.status}). Vui lòng thử lại.`;
        }
        throw new Error(friendlyMsg);
      }

      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error('Dữ liệu máy chủ trả về không đúng định dạng JSON chuẩn.');
      }

      if (!response.ok || !data || !data.success) {
        throw new Error(data?.error || 'Không thể lấy thông tin từ liên kết này. Video có thể đã bị xóa hoặc ở chế độ riêng tư.');
      }

      setResult(data);

      setTimeout(() => {
        const el = document.getElementById('extraction-result');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra khi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-[#fe2c55]/30 selection:text-white">
      {/* Top Navbar */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Minimal Hero */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Tải video & ảnh TikTok{' '}
            <span className="bg-gradient-to-r from-[#fe2c55] to-[#25f4ee] bg-clip-text text-transparent">
              không logo
            </span>
          </h1>
        </div>

        {/* Input Form */}
        <UrlInputForm
          onExtract={handleExtract}
          isLoading={isLoading}
          error={error}
        />

        {/* Extraction Result View */}
        {result && (
          <div id="extraction-result" className="mt-10 space-y-6 animate-in fade-in duration-200">
            {/* Case 1: Profile Channel Extraction (paste tiktok.com/@username) */}
            {result.content_type === 'profile' ? (
              <ProfileFeedSection
                author={result.author}
                profile={result.profile}
                videos={result.profile_videos}
              />
            ) : (
              /* Case 2: Single Video, Photo Carousel, or Story */
              <>
                {/* Author Card with Avatar download */}
                <AuthorCard
                  author={result.author}
                  stats={result.stats}
                  title={result.title}
                  createdAt={result.created_at}
                  canonicalUrl={result.canonical_url}
                  contentType={result.content_type}
                />

                {/* Video */}
                {result.content_type === 'video' && result.media?.video && (
                  <VideoSection
                    video={result.media.video}
                    authorHandle={result.author.unique_id}
                    postId={result.id}
                  />
                )}

                {/* Photos (Carousels & Live photo frames up to 35+ items) */}
                {(result.content_type === 'images' || result.content_type === 'live_photo') && result.media && (
                  <PhotoCarouselSection
                    images={
                      result.media.images && result.media.images.length > 0
                        ? result.media.images
                        : (result.media.live_photos || []).map((lp) => lp.image_url)
                    }
                    authorHandle={result.author.unique_id}
                    postId={result.id}
                  />
                )}

                {/* Background Audio */}
                {result.media?.music && result.media.music.play_url && (
                  <AudioSection
                    music={result.media.music}
                    authorHandle={result.author.unique_id}
                    postId={result.id}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <span>TikTok Raw Media Extractor</span>
        </div>
      </footer>
    </div>
  );
}
