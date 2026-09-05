/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  FolderGit2, 
  Table2, 
  ExternalLink, 
  LogOut, 
  LogIn, 
  Download, 
  Plus, 
  Sparkles,
  Layers,
  Smartphone
} from 'lucide-react';
import { UserProfile, DriveFolderInfo, SpreadsheetInfo } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  isAuthenticated: boolean;
  driveFolder: DriveFolderInfo | null;
  spreadsheet: SpreadsheetInfo | null;
  activeTab: 'catalog' | 'upload';
  onTabChange: (tab: 'catalog' | 'upload') => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenExport: () => void;
  onOpenMobileSync: () => void;
  pendingMobileSyncCount?: number;
  isConnectingDrive: boolean;
  isConnectingSheets: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isAuthenticated,
  driveFolder,
  spreadsheet,
  activeTab,
  onTabChange,
  onSignIn,
  onSignOut,
  onOpenExport,
  onOpenMobileSync,
  pendingMobileSyncCount = 0,
  isConnectingDrive,
  isConnectingSheets,
}) => {
  return (
    <header className="sticky top-0 z-40 h-16 px-4 sm:px-6 lg:px-8 border-b border-[#E8E1D5] flex items-center justify-between bg-white shadow-2xs transition-all">
      <div className="flex items-center gap-4">
        {/* Studio Branding */}
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl italic font-bold text-[#C86D51] tracking-tight">
            Studio Moodboard
          </span>
          <div className="h-6 w-px bg-[#E8E1D5] hidden sm:block"></div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#766E65] font-semibold hidden md:inline">
            Atelier Edition
          </span>
        </div>

        {/* Live Workspace Status Pills from Design HTML */}
        <div className="hidden xl:flex items-center gap-2">
          {driveFolder ? (
            <a
              id="link-google-drive-folder"
              href={driveFolder.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#FDF6F3] border border-[#C86D51]/20 rounded-full text-[10px] uppercase tracking-wider font-bold text-[#C86D51] hover:border-[#C86D51] transition-all"
              title="Open Drive Assets Folder"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Drive Linked</span>
            </a>
          ) : isConnectingDrive ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FDF6F3] border border-[#C86D51]/20 rounded-full text-[10px] uppercase tracking-wider font-bold text-[#C86D51]">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></div>
              <span>Connecting Drive...</span>
            </div>
          ) : null}

          {spreadsheet ? (
            <a
              id="link-google-sheets-catalog"
              href={spreadsheet.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#FDF6F3] border border-[#C86D51]/20 rounded-full text-[10px] uppercase tracking-wider font-bold text-[#C86D51] hover:border-[#C86D51] transition-all"
              title="Open Google Sheet Master Catalog"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Sheets Active</span>
            </a>
          ) : isConnectingSheets ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FDF6F3] border border-[#C86D51]/20 rounded-full text-[10px] uppercase tracking-wider font-bold text-[#C86D51]">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></div>
              <span>Syncing Sheets...</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Center Navigation Switcher */}
      <div className="flex items-center bg-[#FAF7F2] p-1 rounded-full border border-[#E8E1D5]">
        <button
          id="nav-tab-catalog"
          onClick={() => onTabChange('catalog')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'catalog'
              ? 'bg-white text-[#1E1B18] shadow-2xs border border-[#E8E1D5]'
              : 'text-[#766E65] hover:text-[#1E1B18]'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-[#C86D51]" />
          <span>Catalog</span>
        </button>
        <button
          id="nav-tab-upload"
          onClick={() => onTabChange('upload')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
            activeTab === 'upload'
              ? 'bg-[#C86D51] text-white shadow-2xs'
              : 'text-[#766E65] hover:text-[#1E1B18]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Asset</span>
        </button>
      </div>

      {/* Right Controls: Export & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Android Live Sync Button */}
        <button
          id="btn-open-mobile-sync"
          onClick={onOpenMobileSync}
          title="Open Android App Live Synchronization Hub & Instructions"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#E8E1D5]/50 border border-[#E8E1D5] text-[#1E1B18] text-xs font-semibold rounded-full transition-all shadow-2xs relative"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#C86D51]" />
          <span>Android Sync</span>
          {pendingMobileSyncCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#C86D51] animate-pulse"></span>
          )}
        </button>

        {/* Export JSON Button from Design HTML */}
        <button
          id="btn-export-android-deck"
          onClick={onOpenExport}
          title="Export formatted assets.json matching Android Room database"
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 border border-[#C86D51] text-[#C86D51] text-xs font-bold rounded-full hover:bg-[#C86D51] hover:text-white transition-all uppercase tracking-tighter"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export JSON</span>
        </button>

        {/* User Auth Profile from Design HTML */}
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold leading-none text-[#1E1B18]">
                {user?.name || 'Elena Rossi'}
              </p>
              <p className="text-[10px] text-[#766E65] mt-0.5">
                {user?.email ? user.email.split('@')[0] : 'Lead Visualizer'}
              </p>
            </div>
            
            <div className="w-10 h-10 rounded-full bg-[#E8E1D5] border-2 border-[#C86D51] overflow-hidden flex items-center justify-center shrink-0">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-stone-300 flex items-center justify-center text-[#1E1B18] font-serif text-sm italic font-bold">
                  {user?.name
                    ? user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : 'ER'}
                </div>
              )}
            </div>

            <button
              id="btn-google-signout"
              onClick={onSignOut}
              title="Sign out of Google Workspace"
              className="p-1.5 rounded-full text-[#766E65] hover:text-[#C86D51] hover:bg-[#FAF7F2] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            id="btn-google-signin"
            onClick={onSignIn}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#1E1B18] hover:bg-[#332E2A] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5 text-[#C86D51]" />
            <span>Connect Workspace</span>
          </button>
        )}
      </div>
    </header>
  );
};
