import React, { useState } from 'react';
import { MusicInfo } from '../types';
import { downloadMedia, copyToClipboard, formatDuration } from '../utils/media';
import { Music, Download, Copy, Check, Disc3, Volume2 } from 'lucide-react';

interface AudioSectionProps {
  music: MusicInfo;
  authorHandle: string;
  postId: string;
}

export const AudioSection: React.FC<AudioSectionProps> = ({ music, authorHandle, postId }) => {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!music.play_url) return null;

  const handleCopy = async () => {
    const success = await copyToClipboard(music.play_url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const cleanTitle = (music.title || 'audio').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `tiktok_audio_@${authorHandle}_${cleanTitle}.mp3`;
      await downloadMedia(music.play_url, filename);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
            {music.cover ? (
              <img
                src={music.cover}
                alt={music.title}
                className="w-full h-full object-cover animate-spin-slow"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Disc3 className="w-6 h-6 text-[#25f4ee] animate-spin-slow" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-mono tracking-wider text-zinc-400">Background Audio</span>
              {music.duration ? (
                <span className="text-[10px] font-mono text-zinc-500">• {formatDuration(music.duration)}</span>
              ) : null}
            </div>
            <h3 className="font-bold text-white text-sm truncate max-w-sm sm:max-w-md">
              {music.title || 'Original Sound'}
            </h3>
            <p className="text-xs text-zinc-400 truncate">By {music.author || authorHandle}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all cursor-pointer"
            title="Copy audio stream URL"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-400" />
                <span>Copy Audio URL</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 active:scale-95 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Audio (.MP3)</span>
          </button>
        </div>
      </div>

      {/* HTML5 Audio Player */}
      <div className="mt-4 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 flex items-center gap-3">
        <Volume2 className="w-4 h-4 text-[#25f4ee] shrink-0 ml-1" />
        <audio
          src={music.play_url}
          controls
          className="w-full h-8 brightness-90 filter invert-[0.85] hue-rotate-180"
          preload="metadata"
        />
      </div>
    </div>
  );
};
