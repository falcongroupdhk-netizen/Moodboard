/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  FolderGit2, 
  Copy, 
  Check, 
  Calendar, 
  User, 
  Layers, 
  Sparkles,
  Palette,
  Maximize2
} from 'lucide-react';
import { AssetRecord } from '../types';

interface AssetDetailModalProps {
  asset: AssetRecord | null;
  onClose: () => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ asset, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!asset) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formattedDate = new Date(asset.uploadedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-[#FFFFFF] border border-[#E8E1D5] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => copyToClipboard(asset.id, 'id')}
              className="px-2.5 py-1 rounded-md bg-white border border-[#E8E1D5] text-xs font-mono font-bold text-[#1E1B18] flex items-center space-x-1.5 hover:border-[#C86D51] transition-colors"
            >
              <span>{asset.id}</span>
              {copiedField === 'id' ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3 text-[#766E65]" />
              )}
            </button>
            <span className="text-xs text-[#766E65] font-mono hidden sm:inline">
              Uploaded {formattedDate}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {asset.driveUrl && (
              <a
                href={asset.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-white border border-[#E8E1D5] text-xs font-medium text-[#C86D51] transition-colors"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Drive File</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#766E65] hover:text-[#1E1B18] hover:bg-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
          
          {/* Main Visual & Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Image Preview */}
            <div className="lg:col-span-7 rounded-xl overflow-hidden border border-[#E8E1D5] bg-[#FAF7F2] relative group">
              <img
                src={asset.previewUrl || asset.driveUrl}
                alt={asset.title}
                className="w-full h-auto max-h-[460px] object-cover"
              />
              <div className="absolute top-3 right-3">
                <a
                  href={asset.previewUrl || asset.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 backdrop-blur-xs transition-colors block"
                  title="Open full resolution in new tab"
                >
                  <Maximize2 className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Details Panel */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#C86D51] font-semibold">
                  Architectural Record
                </span>
                <h2 className="font-serif text-2xl font-bold text-[#1E1B18] mt-1">
                  {asset.title}
                </h2>
                <p className="text-sm text-[#766E65] mt-2 leading-relaxed">
                  {asset.description || 'No detailed specifications entered.'}
                </p>
              </div>

              {/* Color Swatch Information */}
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E1D5]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#766E65] font-semibold block mb-2">
                  Dominant Finish Swatch
                </span>
                <div className="flex items-center space-x-3">
                  <span
                    className="w-8 h-8 rounded-lg border border-black/10 shadow-2xs"
                    style={{ backgroundColor: asset.paletteHex }}
                  />
                  <div>
                    <span className="font-mono text-sm font-bold text-[#1E1B18] block">
                      {asset.paletteHex}
                    </span>
                    <button
                      onClick={() => copyToClipboard(asset.paletteHex, 'hex')}
                      className="text-[11px] text-[#C86D51] hover:underline font-mono"
                    >
                      {copiedField === 'hex' ? 'Hex Copied!' : 'Copy Hex Code'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Meta & Uploader info */}
              <div className="space-y-2 text-xs border-t border-[#E8E1D5] pt-4 font-mono">
                <div className="flex justify-between py-1">
                  <span className="text-[#766E65]">Uploader:</span>
                  <span className="text-[#1E1B18] font-medium">{asset.uploader}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#766E65]">Timestamp:</span>
                  <span className="text-[#1E1B18] font-medium">{formattedDate}</span>
                </div>
              </div>

            </div>

          </div>

          {/* Structured Architectural Taxonomy Section */}
          <div className="border-t border-[#E8E1D5] pt-6 space-y-5">
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#1E1B18] font-bold">
              Structured Taxonomy Specs
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Spaces */}
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E1D5]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#C86D51] font-semibold block mb-2">
                  Spatial Programs
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {asset.spaces.length > 0 ? (
                    asset.spaces.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-white border border-[#E8E1D5] text-xs font-medium text-[#1E1B18]">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#766E65] italic">None specified</span>
                  )}
                </div>
              </div>

              {/* Styles */}
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E1D5]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#1E1B18] font-semibold block mb-2">
                  Aesthetic Typologies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {asset.styles.length > 0 ? (
                    asset.styles.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-white border border-[#E8E1D5] text-xs font-medium text-[#1E1B18]">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#766E65] italic">None specified</span>
                  )}
                </div>
              </div>

              {/* Materials */}
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E1D5]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#85937D] font-semibold block mb-2">
                  Finishes & Materials
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {asset.materials.length > 0 ? (
                    asset.materials.map((m) => (
                      <span key={m} className="px-2 py-0.5 rounded bg-white border border-[#E8E1D5] text-xs font-medium text-[#1E1B18]">
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#766E65] italic">None specified</span>
                  )}
                </div>
              </div>

              {/* Elements & Custom */}
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E1D5]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#766E65] font-semibold block mb-2">
                  Elements & Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {asset.elements.map((el) => (
                    <span key={el} className="px-2 py-0.5 rounded bg-white border border-[#E8E1D5] text-xs font-medium text-[#1E1B18]">
                      {el}
                    </span>
                  ))}
                  {asset.customTags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-[#FDF6F3] border border-[#C86D51]/30 text-xs font-mono text-[#C86D51]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E8E1D5] bg-white flex items-center justify-between">
          <div className="text-xs font-mono text-[#766E65] truncate max-w-sm">
            <span>Direct preview URL: </span>
            <span className="text-[#1E1B18] underline cursor-pointer" onClick={() => copyToClipboard(asset.previewUrl, 'url')}>
              {copiedField === 'url' ? 'Copied to clipboard!' : 'Copy direct link'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#1E1B18] hover:bg-[#332E2A] text-white text-xs font-semibold transition-colors"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
