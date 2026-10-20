import React from 'react';
import { Author, Stats, ContentType } from '../types';
import { formatNumber, downloadMedia } from '../utils/media';
import { Eye, Heart, MessageCircle, Share2, Download, ExternalLink, CheckCircle2, Film, Image as ImageIcon, Flame } from 'lucide-react';

interface AuthorCardProps {
  author: Author;
  stats: Stats;
  title: string;
  createdAt: string;
  canonicalUrl: string;
  contentType: ContentType;
}

export const AuthorCard: React.FC<AuthorCardProps> = ({
  author,
  stats,
  title,
  createdAt,
  canonicalUrl,
  contentType,
}) => {
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Highlight hashtags in caption
  const renderFormattedTitle = (text: string) => {
    if (!text) return <span className="text-zinc-500 italic">No caption provided</span>;
    const parts = text.split(/(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_.]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span key={index} className="text-[#25f4ee] hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-[#fe2c55] font-medium hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getTypeBadge = () => {
    switch (contentType) {
      case 'images':
      case 'live_photo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ImageIcon className="w-3.5 h-3.5" />
            Album ảnh
          </span>
        );
      case 'video':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fe2c55]/15 border border-[#fe2c55]/30 text-[#fe2c55] text-xs font-semibold">
            <Film className="w-3.5 h-3.5" />
            Video
          </span>
        );
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.nickname}
                className="w-13 h-13 rounded-full object-cover border-2 border-zinc-700 bg-zinc-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-13 h-13 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 border border-zinc-700">
                {author.unique_id?.[0]?.toUpperCase() || 'T'}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-zinc-950 p-0.5 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-[#25f4ee] fill-[#25f4ee]/20" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base hover:text-zinc-200 transition-colors">
                {author.nickname}
              </h3>
              <span className="text-zinc-500 text-xs">• {formattedDate}</span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">@{author.unique_id}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {getTypeBadge()}

          {(author.avatar_hd || author.avatar) && (
            <button
              onClick={async () => {
                const url = author.avatar_hd || author.avatar;
                await downloadMedia(url, `tiktok_avatar_@${author.unique_id}.jpg`);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 cursor-pointer"
              title="Tải ảnh đại diện HD của tác giả"
            >
              <Download className="w-3.5 h-3.5 text-[#fe2c55]" />
              <span>Tải Avatar</span>
            </button>
          )}

          <a
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700"
          >
            <span>Xem trên TikTok</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Caption text */}
      <div className="mt-4 text-sm text-zinc-200 leading-relaxed font-normal">
        {renderFormattedTitle(title)}
      </div>

      {/* Stats counter */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-zinc-400 shrink-0" />
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Views</div>
            <div className="text-xs font-bold text-zinc-200">{formatNumber(stats.plays)}</div>
          </div>
        </div>
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-2.5">
          <Heart className="w-4 h-4 text-[#fe2c55] shrink-0" />
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Likes</div>
            <div className="text-xs font-bold text-zinc-200">{formatNumber(stats.likes)}</div>
          </div>
        </div>
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-2.5">
          <MessageCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Comments</div>
            <div className="text-xs font-bold text-zinc-200">{formatNumber(stats.comments)}</div>
          </div>
        </div>
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-2.5">
          <Share2 className="w-4 h-4 text-[#25f4ee] shrink-0" />
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Shares</div>
            <div className="text-xs font-bold text-zinc-200">{formatNumber(stats.shares)}</div>
          </div>
        </div>
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center gap-2.5 col-span-2 sm:col-span-1">
          <Download className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Saves</div>
            <div className="text-xs font-bold text-zinc-200">{formatNumber(stats.downloads)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
