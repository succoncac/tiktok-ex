import React, { useState } from 'react';
import { ExtractionResult } from '../types';
import { copyToClipboard } from '../utils/media';
import { Terminal, Copy, Check, ChevronDown, ChevronUp, Code2, Cpu } from 'lucide-react';

interface CdnInspectorProps {
  data: ExtractionResult;
}

export const CdnInspector: React.FC<CdnInspectorProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    const success = await copyToClipboard(jsonString);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-850/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-[#25f4ee]" />
          <span className="text-sm font-bold text-zinc-300">Raw CDN Metadata & API Payload</span>
          <span className="text-[11px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800">
            {data.content_type.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-xs hidden sm:inline">{isOpen ? 'Hide JSON' : 'Inspect JSON'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-zinc-800/80 bg-zinc-950/80 animate-in fade-in">
          <div className="flex items-center justify-between py-2 text-xs text-zinc-400">
            <span className="font-mono text-zinc-500">JSON Schema Payload ({jsonString.length} bytes)</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-750 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">JSON Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Payload</span>
                </>
              )}
            </button>
          </div>

          <pre className="max-h-96 overflow-y-auto text-xs font-mono text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 scrollbar-thin leading-relaxed">
            <code>{jsonString}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
