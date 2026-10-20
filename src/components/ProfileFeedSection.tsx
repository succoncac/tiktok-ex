import React, { useState, useEffect } from 'react';
import { Author, UserProfileData, ProfileVideoItem } from '../types';
import { downloadMedia, copyToClipboard, formatNumber, formatDuration } from '../utils/media';
import { Download, Copy, Check, ExternalLink, Eye, Film, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ProfileFeedSectionProps {
  author: Author;
  profile?: UserProfileData;
  videos?: ProfileVideoItem[];
}

export const ProfileFeedSection: React.FC<ProfileFeedSectionProps> = ({ author, profile, videos = [] }) => {
  const [copiedAvatar, setCopiedAvatar] = useState(false);
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  const initialAvatar = author.avatar_hd || author.avatar || '';
  const [avatarSrc, setAvatarSrc] = useState(initialAvatar);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    const nextUrl = author.avatar_hd || author.avatar || '';
    setAvatarSrc(nextUrl);
    setAvatarFailed(!nextUrl);
  }, [author.avatar_hd, author.avatar]);

  const handleAvatarError = () => {
    if (!avatarSrc) {
      setAvatarFailed(true);
      return;
    }
    // If direct link failed and not yet proxied through /api/avatar, try proxy
    if (!avatarSrc.startsWith('/api/avatar')) {
      setAvatarSrc(`/api/avatar?url=${encodeURIComponent(avatarSrc)}`);
    } else {
      setAvatarFailed(true);
    }
  };

  const handleDownloadAvatar = async () => {
    const targetUrl = avatarSrc || initialAvatar;
    if (!targetUrl) return;
    const filename = `tiktok_avatar_@${author.unique_id}.jpg`;
    await downloadMedia(targetUrl, filename);
  };

  const handleCopyAvatar = async () => {
    const targetUrl = avatarSrc || initialAvatar;
    if (!targetUrl) return;
    const ok = await copyToClipboard(targetUrl);
    if (ok) {
      setCopiedAvatar(true);
      setTimeout(() => setCopiedAvatar(false), 2000);
    }
  };

  const handleDownloadVideo = async (video: ProfileVideoItem) => {
    try {
      setDownloadingId(video.id);
      const downloadUrl = video.hdplay || video.play;
      const filename = `tiktok_@${author.unique_id}_${video.id}_nowatermark.mp4`;
      await downloadMedia(downloadUrl, filename);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyVideoUrl = async (video: ProfileVideoItem) => {
    const downloadUrl = video.hdplay || video.play;
    const ok = await copyToClipboard(downloadUrl);
    if (ok) {
      setCopiedVideoId(video.id);
      setTimeout(() => setCopiedVideoId(null), 2000);
    }
  };

  // Format bio text with links and hashtags
  const renderBioContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(https?:\/\/[^\s]+|#[a-zA-Z0-9_\p{L}]+|@[a-zA-Z0-9_.-]+)/gu);
    return parts.map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#25f4ee] underline underline-offset-2 hover:opacity-80 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-[#25f4ee] font-medium">
            {part}
          </span>
        );
      }
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-[#fe2c55] font-medium">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const signatureText = author.signature?.trim() || profile?.signature?.trim() || '';
  const isBioLong = signatureText.length > 130 || signatureText.split('\n').length > 3;

  return (
    <div className="space-y-6">
      {/* Profile Overview Card */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-5 pb-5 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row items-start gap-4 min-w-0 flex-1 w-full">
            {/* Avatar */}
            <div className="relative group shrink-0">
              {!avatarFailed && avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={author.nickname}
                  className="w-20 h-20 sm:w-22 sm:h-22 rounded-full object-cover border-2 border-[#fe2c55]/40 shadow-lg bg-zinc-800"
                  referrerPolicy="no-referrer"
                  onError={handleAvatarError}
                />
              ) : (
                <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center font-bold text-2xl text-zinc-200 border border-zinc-600 shadow-md">
                  {author.unique_id?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              {author.verified && (
                <div className="absolute -bottom-1 -right-1 bg-zinc-950 p-0.5 rounded-full shadow">
                  <CheckCircle2 className="w-5 h-5 text-[#25f4ee] fill-[#25f4ee]/20" />
                </div>
              )}
            </div>

            {/* User Meta & Bio */}
            <div className="min-w-0 flex-1 w-full space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
                  {author.nickname}
                </h2>
                <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/60">
                  @{author.unique_id}
                </span>
              </div>

              {/* Responsive Bio with Auto-wrap & Focus */}
              {signatureText && (
                <div className="w-full pt-1">
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Tiểu sử tài khoản"
                    className={`group relative text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700 focus:border-[#fe2c55]/70 focus:ring-2 focus:ring-[#fe2c55]/20 focus:outline-none rounded-xl p-3 sm:p-3.5 transition-all shadow-inner ${
                      !isBioExpanded && isBioLong ? 'max-h-24 overflow-hidden' : ''
                    }`}
                  >
                    <p className="select-text">{renderBioContent(signatureText)}</p>

                    {/* Gradient fade when collapsed */}
                    {!isBioExpanded && isBioLong && (
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950/95 via-zinc-950/60 to-transparent pointer-events-none rounded-b-xl" />
                    )}
                  </div>

                  {isBioLong && (
                    <button
                      type="button"
                      onClick={() => setIsBioExpanded(!isBioExpanded)}
                      className="mt-1.5 text-xs font-semibold text-[#25f4ee] hover:text-[#25f4ee]/80 inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isBioExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Thu gọn tiểu sử</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Xem thêm tiểu sử</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Avatar Actions */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0 w-full sm:w-auto">
            <button
              onClick={handleDownloadAvatar}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#fe2c55] to-pink-600 hover:brightness-110 active:scale-95 rounded-xl transition-all shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Avatar</span>
            </button>

            <button
              onClick={handleCopyAvatar}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all cursor-pointer"
              title="Sao chép link avatar CDN"
            >
              {copiedAvatar ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Đã chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Link Avatar</span>
                </>
              )}
            </button>

            <a
              href={`https://www.tiktok.com/@${author.unique_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-700"
              title="Xem trên TikTok"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Stats Row */}
        {profile && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Followers</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatNumber(profile.followers)}</div>
            </div>
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Đang Follow</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatNumber(profile.following)}</div>
            </div>
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Lượt thích</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatNumber(profile.hearts)}</div>
            </div>
            <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Tổng video</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatNumber(profile.video_count)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Videos List Section */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-5">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-[#25f4ee]" />
            <h3 className="font-bold text-white text-base">Video gần đây của @{author.unique_id}</h3>
            <span className="text-xs bg-zinc-800 px-2.5 py-0.5 rounded-full text-zinc-300 font-mono">
              {videos.length} video
            </span>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Film className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Không tìm thấy video công khai nào hoặc tài khoản ở chế độ riêng tư.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden shadow-lg flex flex-col group transition-all"
              >
                {/* Poster Thumbnail */}
                <div className="relative aspect-[9/14] bg-zinc-900 overflow-hidden">
                  <img
                    src={video.cover}
                    alt={video.title || 'Video'}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  {/* Duration badge */}
                  {video.duration > 0 && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-mono text-white">
                      {formatDuration(video.duration)}
                    </div>
                  )}
                  {/* Views counter */}
                  {video.views > 0 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white">
                      <Eye className="w-3 h-3 text-[#25f4ee]" />
                      <span>{formatNumber(video.views)}</span>
                    </div>
                  )}
                </div>

                {/* Video Info */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-3 bg-zinc-950">
                  <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                    {video.title || 'Video TikTok'}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-850">
                    <button
                      onClick={() => handleDownloadVideo(video)}
                      disabled={downloadingId === video.id}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-bold text-white bg-gradient-to-r from-[#fe2c55] to-pink-600 hover:brightness-110 active:scale-95 rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      title="Tải video không logo"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{downloadingId === video.id ? 'Đang tải...' : 'Tải video'}</span>
                    </button>

                    <button
                      onClick={() => handleCopyVideoUrl(video)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-850 hover:bg-zinc-800 rounded-lg border border-zinc-750 transition-colors cursor-pointer"
                      title="Sao chép link CDN trực tiếp"
                    >
                      {copiedVideoId === video.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <a
                      href={`https://www.tiktok.com/@${author.unique_id}/video/${video.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-850 hover:bg-zinc-800 rounded-lg border border-zinc-750 transition-colors"
                      title="Xem trên TikTok"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
