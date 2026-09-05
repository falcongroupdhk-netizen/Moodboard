/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Download, Copy, Check, FileCode2, Smartphone, Terminal } from 'lucide-react';
import { AssetRecord } from '../types';

interface AndroidExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: AssetRecord[];
}

export const AndroidExportModal: React.FC<AndroidExportModalProps> = ({
  isOpen,
  onClose,
  assets,
}) => {
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  // Format schema matching Android Room Database entity
  const formattedJson = JSON.stringify(
    assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      description: asset.description,
      uploadedAt: asset.uploadedAt,
      driveUrl: asset.driveUrl,
      previewUrl: asset.previewUrl,
      spaces: asset.spaces,
      styles: asset.styles,
      materials: asset.materials,
      elements: asset.elements,
      customTags: asset.customTags,
      paletteHex: asset.paletteHex,
      uploader: asset.uploader,
    })),
    null,
    2
  );

  const handleDownload = () => {
    const blob = new Blob([formattedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assets.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-[#FFFFFF] border border-[#E8E1D5] rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="p-6 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#C86D51]/10 rounded-lg text-[#C86D51]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold text-[#1E1B18]">
                Export Android Moodboard Deck
              </h3>
              <p className="text-xs text-[#766E65] font-mono mt-0.5">
                Target Schema: Android Room Database (assets.json) • {assets.length} items
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#766E65] hover:text-[#1E1B18] hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Entity Spec Note */}
        <div className="px-6 py-3 bg-[#FDF6F3] border-b border-[#C86D51]/20 flex items-center justify-between text-xs text-[#1E1B18]">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-[#C86D51]" />
            <span className="font-mono font-medium">assets.json ➔ assets/assets.json</span>
            <span className="text-[#766E65] hidden sm:inline">Room pre-populate asset pipeline ready</span>
          </div>
          <span className="font-mono text-[11px] text-[#C86D51]">Schema: Room 2.6+</span>
        </div>

        {/* JSON Preview Content */}
        <div className="flex-1 overflow-auto p-6 bg-[#FAF7F2]/50 font-mono text-xs">
          <pre className="p-4 rounded-xl bg-[#1E1B18] text-[#FAF7F2] overflow-x-auto text-[11px] leading-relaxed shadow-inner">
            <code>{formattedJson}</code>
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[#E8E1D5] bg-white flex items-center justify-between">
          <span className="text-xs text-[#766E65]">
            Compatible with Android Studio project asset import
          </span>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#FAF7F2] hover:bg-[#E8E1D5]/60 border border-[#E8E1D5] text-xs font-semibold text-[#1E1B18] transition-colors"
            >
              {hasCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              id="btn-confirm-download-json"
              onClick={handleDownload}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-[#C86D51] hover:bg-[#A85238] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download assets.json</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
