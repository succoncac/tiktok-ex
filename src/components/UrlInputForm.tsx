import React, { useState } from 'react';
import { Link2, X, ArrowRight, Loader2 } from 'lucide-react';

interface UrlInputFormProps {
  onExtract: (url: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export const UrlInputForm: React.FC<UrlInputFormProps> = ({ onExtract, isLoading, error }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    onExtract(url.trim());
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#fe2c55]/30 to-[#25f4ee]/30 rounded-2xl blur-md opacity-40 group-hover:opacity-75 group-focus-within:opacity-100 transition duration-300" />

          <div className="relative flex flex-col sm:flex-row items-center bg-zinc-900/95 border border-zinc-700/80 hover:border-zinc-600 rounded-2xl p-2 sm:p-2.5 shadow-2xl backdrop-blur-xl transition-all">
            <div className="flex items-center w-full px-3 py-1">
              <Link2 className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Dán link video, hình ảnh..."
                disabled={isLoading}
                className="w-full bg-transparent text-white placeholder-zinc-500 text-sm sm:text-base focus:outline-none focus:ring-0 font-medium tracking-wide"
              />
              {url && !isLoading && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors mr-1 cursor-pointer"
                  title="Xóa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="w-full sm:w-auto mt-2 sm:mt-0 shrink-0 flex items-center justify-center gap-2 px-6 py-3 sm:py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#fe2c55] to-[#e01440] hover:from-[#ff3b63] hover:to-[#eb204b] active:scale-[0.98] transition-all shadow-lg shadow-[#fe2c55]/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Bắt đầu lấy</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3.5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-300 text-xs sm:text-sm animate-in fade-in">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <p className="flex-1 font-medium">{error}</p>
          </div>
        )}
      </form>
    </div>
  );
};
