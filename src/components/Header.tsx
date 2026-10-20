import React from 'react';
import { Layers } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-[#fe2c55] via-purple-600 to-[#25f4ee] p-[1.5px] shadow-lg shadow-[#fe2c55]/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              TikTok Extractor
            </span>
            <p className="text-xs text-zinc-400">Tải video & ảnh gốc không logo</p>
          </div>
        </div>
      </div>
    </header>
  );
};
