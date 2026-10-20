import React, { useState } from 'react';
import { X, Terminal, Copy, Check, Cloud, Cpu, Globe, ArrowRight, ShieldCheck, FileCode } from 'lucide-react';
import { copyToClipboard } from '../utils/media';

interface WorkerDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkerDocsModal: React.FC<WorkerDocsModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (text: string, key: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const wranglerCommands = `# 1. Navigate to the worker folder
cd worker

# 2. Login to Cloudflare (one-time setup)
npx wrangler login

# 3. Test locally with Wrangler dev server
npx wrangler dev

# 4. Deploy live to Cloudflare Edge Network
npx wrangler deploy`;

  const curlExample = `curl -X GET "https://your-worker.your-subdomain.workers.dev/api/extract?url=https://www.tiktok.com/@tiktok/video/7106594312292453678"`;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Cloudflare Worker & API Architecture
              </h2>
              <p className="text-xs text-zinc-400">
                Standalone Edge Worker located in <code className="text-amber-400 font-mono">worker/index.js</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-300">
          {/* Overview Banner */}
          <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-[#25f4ee]" />
              Dual-Engine Deployment Support
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This project is built with dual-engine flexibility: The built-in Express server (<code className="text-zinc-200 font-mono">server.ts</code>) powers the live applet and local Node.js environment, while the dedicated edge worker file (<code className="text-zinc-200 font-mono">worker/index.js</code>) can be deployed directly to Cloudflare Workers for zero-cold-start global CDN performance.
            </p>
          </div>

          {/* Cloudflare Worker Deployment Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-orange-400" />
                Deploying the Cloudflare Worker
              </h3>
              <button
                onClick={() => handleCopy(wranglerCommands, 'wrangler')}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
              >
                {copiedKey === 'wrangler' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Commands</span>
                  </>
                )}
              </button>
            </div>
            <pre className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl text-xs font-mono text-zinc-300 overflow-x-auto">
              <code>{wranglerCommands}</code>
            </pre>
          </div>

          {/* API Endpoints */}
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#25f4ee]" />
              API Endpoints & Query Specs
            </h3>
            <div className="space-y-3">
              <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 font-mono text-[11px] font-bold">
                    GET
                  </span>
                  <span className="font-mono text-xs font-semibold text-zinc-200">
                    /api/extract?url=&lt;TIKTOK_URL&gt;
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Extracts raw CDN metadata, resolves short links (<code className="text-zinc-300">vm.tiktok.com</code>), and returns content type (<code className="text-pink-400 font-mono">video</code>, <code className="text-emerald-400 font-mono">images</code>, or <code className="text-purple-400 font-mono">live_photo</code>).
                </p>
              </div>

              <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] font-bold">
                    GET
                  </span>
                  <span className="font-mono text-xs font-semibold text-zinc-200">
                    /api/download?url=&lt;CDN_URL&gt;&filename=&lt;NAME&gt;
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Proxies the CDN stream with <code className="text-zinc-300">Content-Disposition: attachment</code> to force direct local file saving without browser tab redirection.
                </p>
              </div>
            </div>
          </div>

          {/* Local Vite development instructions */}
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-pink-400" />
              Running Frontend Locally
            </h3>
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2 text-xs text-zinc-400">
              <p>Run full-stack dev server with hot reload:</p>
              <pre className="bg-zinc-950 p-2 rounded-lg font-mono text-zinc-200">npm run dev</pre>
              <p>Build for production:</p>
              <pre className="bg-zinc-950 p-2 rounded-lg font-mono text-zinc-200">npm run build && npm run start</pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-zinc-800 hover:bg-zinc-750 transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
