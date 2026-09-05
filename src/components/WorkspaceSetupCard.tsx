/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FolderGit2, Table2, ExternalLink, CheckCircle2, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';
import { DriveFolderInfo, SpreadsheetInfo } from '../types';

interface WorkspaceSetupCardProps {
  isAuthenticated: boolean;
  driveFolder: DriveFolderInfo | null;
  spreadsheet: SpreadsheetInfo | null;
  onConnect: () => void;
  onRefresh: () => void;
  onOpenMobileSync?: () => void;
  pendingMobileCount?: number;
}

export const WorkspaceSetupCard: React.FC<WorkspaceSetupCardProps> = ({
  isAuthenticated,
  driveFolder,
  spreadsheet,
  onConnect,
  onRefresh,
  onOpenMobileSync,
  pendingMobileCount = 0,
}) => {
  return (
    <div className="bg-white border border-[#E8E1D5] rounded-2xl p-5 mb-6 shadow-2xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Summary */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#C86D51] font-bold">
              Production Workspace Sync
            </span>
            {isAuthenticated && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#FDF6F3] text-[#85937D] text-[10px] font-bold border border-[#85937D]/30 uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3 text-[#85937D]" />
                <span>Connected</span>
              </span>
            )}
          </div>
          <h2 className="font-serif text-xl font-normal text-[#1E1B18] tracking-tight">
            Google Workspace Synchronization Hub
          </h2>
          <p className="text-xs text-[#766E65] max-w-2xl leading-relaxed">
            All high-resolution files are deposited into your Google Drive folder, while structural metadata, spatial taxonomies, and finish hexes are appended to your Master Google Sheet in real time.
          </p>
        </div>

        {/* Right: Connect / Status links */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isAuthenticated ? (
            <>
              {driveFolder && (
                <a
                  href={driveFolder.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-full bg-[#FAF7F2] hover:bg-[#E8E1D5]/40 border border-[#E8E1D5] text-xs font-semibold text-[#1E1B18] transition-colors shadow-2xs"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-[#C86D51]" />
                  <span>Google Drive Folder</span>
                  <ExternalLink className="w-3 h-3 text-[#766E65]" />
                </a>
              )}

              {spreadsheet && (
                <a
                  href={spreadsheet.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-full bg-[#FAF7F2] hover:bg-[#E8E1D5]/40 border border-[#E8E1D5] text-xs font-semibold text-[#1E1B18] transition-colors shadow-2xs"
                >
                  <Table2 className="w-3.5 h-3.5 text-[#85937D]" />
                  <span>Master Google Sheet</span>
                  <ExternalLink className="w-3 h-3 text-[#766E65]" />
                </a>
              )}

              {onOpenMobileSync && (
                <button
                  onClick={onOpenMobileSync}
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-full bg-[#FDF6F3] hover:bg-[#C86D51]/10 border border-[#C86D51]/30 text-xs font-semibold text-[#C86D51] transition-colors shadow-2xs"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Android Sync Hub</span>
                  {pendingMobileCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C86D51] animate-ping"></span>
                  )}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onConnect}
              className="flex items-center space-x-2 px-5 py-2 rounded-full bg-[#C86D51] hover:bg-[#A85238] text-white text-xs font-bold shadow-xs transition-all uppercase tracking-tighter"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Authorize Google Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
