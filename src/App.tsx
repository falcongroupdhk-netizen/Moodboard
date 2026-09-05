/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { CatalogBrowser } from './components/CatalogBrowser';
import { AssetUploadForm } from './components/AssetUploadForm';
import { AndroidExportModal } from './components/AndroidExportModal';
import { AssetDetailModal } from './components/AssetDetailModal';
import { WorkspaceSetupCard } from './components/WorkspaceSetupCard';
import { MobileSyncHubModal } from './components/MobileSyncHubModal';
import { AssetRecord, DriveFolderInfo, SpreadsheetInfo, UserProfile } from './types';
import { INITIAL_SAMPLE_ASSETS } from './data/sampleAssets';
import { googleAuth } from './services/googleAuth';
import { getOrCreateDriveFolder } from './services/googleDrive';
import { getOrCreateSpreadsheet, fetchAssetsFromSheet } from './services/googleSheets';
import { mobileSyncBridge } from './services/mobileSyncBridge';

const LOCAL_STORAGE_ASSETS_KEY = 'atelier_moodboard_cached_assets';

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Workspace connections
  const [driveFolder, setDriveFolder] = useState<DriveFolderInfo | null>(null);
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetInfo | null>(null);
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);
  const [isConnectingSheets, setIsConnectingSheets] = useState<boolean>(false);

  // App Navigation & Modals
  const [activeTab, setActiveTab] = useState<'catalog' | 'upload'>('catalog');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isMobileSyncModalOpen, setIsMobileSyncModalOpen] = useState<boolean>(false);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<AssetRecord | null>(null);

  // Asset Catalog
  const [assets, setAssets] = useState<AssetRecord[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_ASSETS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return INITIAL_SAMPLE_ASSETS;
  });
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [systemNotice, setSystemNotice] = useState<string | null>(null);

  // Save to local cache on changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_ASSETS_KEY, JSON.stringify(assets));
    } catch {
      // Ignore quota errors
    }
  }, [assets]);

  // Background monitor: looks for new assets from Android and automatically uploads pending mobile assets to Google Drive & Sheets
  useEffect(() => {
    let isMounted = true;

    const checkAndSyncMobileAssets = async () => {
      try {
        // 1. Fetch server assets to see if mobile uploaded anything new
        const serverAssets = await mobileSyncBridge.fetchServerAssets();
        if (serverAssets && serverAssets.length > 0 && isMounted) {
          setAssets((prev) => {
            const map = new Map<string, AssetRecord>();
            let hasNewMobileAsset = false;
            prev.forEach((a) => map.set(a.id, a));
            serverAssets.forEach((sa) => {
              if (!map.has(sa.id)) {
                hasNewMobileAsset = true;
              }
              map.set(sa.id, {
                ...map.get(sa.id),
                ...sa,
              });
            });
            if (hasNewMobileAsset) {
              setSystemNotice('Synced new asset(s) from Android companion.');
              setTimeout(() => setSystemNotice(null), 3500);
            }
            return Array.from(map.values());
          });
        }

        // 2. If Google Workspace is active, check if any mobile assets need Drive & Sheet upload
        if (token && driveFolder && spreadsheet) {
          const uploaded = await mobileSyncBridge.syncPendingMobileAssetsToDrive(
            token,
            driveFolder.id,
            spreadsheet.id
          );
          if (uploaded.length > 0 && isMounted) {
            setAssets((prev) => {
              const map = new Map<string, AssetRecord>();
              prev.forEach((a) => map.set(a.id, a));
              uploaded.forEach((u) => map.set(u.id, u));
              return Array.from(map.values());
            });
            setSystemNotice(`Backed up ${uploaded.length} mobile asset(s) to Studio Drive & Master Sheet!`);
            setTimeout(() => setSystemNotice(null), 4000);
          }
        }
      } catch {
        // Background check note
      }
    };

    // Initial check
    checkAndSyncMobileAssets();

    // Periodic check every 15 seconds
    const interval = setInterval(checkAndSyncMobileAssets, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, driveFolder, spreadsheet]);

  // Synchronize Google Auth state
  useEffect(() => {
    const updateAuthState = () => {
      const authed = googleAuth.isAuthenticated();
      const currentToken = googleAuth.getAccessToken();
      const currentUser = googleAuth.getUserProfile();

      setIsAuthenticated(authed);
      setToken(currentToken);
      setUser(currentUser);
    };

    updateAuthState();
    const unsubscribe = googleAuth.subscribe(updateAuthState);

    // Also attempt GIS client initialization in background
    googleAuth.initClient().catch(() => {});

    return () => {
      unsubscribe();
    };
  }, []);

  // Connect Google Workspace services once token is available
  const syncWorkspaceResources = useCallback(async (authToken: string) => {
    try {
      setIsConnectingDrive(true);
      const folder = await getOrCreateDriveFolder(authToken);
      setDriveFolder(folder);
    } catch (err) {
      console.warn('Google Drive folder setup note:', err);
    } finally {
      setIsConnectingDrive(false);
    }

    try {
      setIsConnectingSheets(true);
      const sheet = await getOrCreateSpreadsheet(authToken);
      setSpreadsheet(sheet);

      // Fetch live assets from sheet
      try {
        setIsSyncingSheet(true);
        const sheetAssets = await fetchAssetsFromSheet(authToken, sheet.id);
        if (sheetAssets && sheetAssets.length > 0) {
          // Merge with unique by id
          setAssets((prev) => {
            const map = new Map<string, AssetRecord>();
            // Keep local/sample first
            prev.forEach((a) => map.set(a.id, a));
            // Overwrite with sheet records
            sheetAssets.forEach((a) => map.set(a.id, a));
            return Array.from(map.values());
          });
          setSystemNotice(`Synchronized ${sheetAssets.length} assets from Google Sheet.`);
          setTimeout(() => setSystemNotice(null), 4000);
        }
      } catch (err) {
        console.warn('Could not read existing sheet rows:', err);
      } finally {
        setIsSyncingSheet(false);
      }
    } catch (err) {
      console.warn('Google Sheet setup note:', err);
    } finally {
      setIsConnectingSheets(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      syncWorkspaceResources(token);
    }
  }, [token, syncWorkspaceResources]);

  const handleSignIn = async () => {
    try {
      await googleAuth.signIn();
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      setSystemNotice('Google sign-in popup opened. Complete authentication to link Drive & Sheets.');
    }
  };

  const handleSignOut = () => {
    googleAuth.signOut();
    setDriveFolder(null);
    setSpreadsheet(null);
    setSystemNotice('Signed out of Google Workspace.');
    setTimeout(() => setSystemNotice(null), 3000);
  };

  const handleManualRefresh = async () => {
    if (!token || !spreadsheet) {
      setSystemNotice('Connect Google Workspace to pull real-time updates from Google Sheet.');
      setTimeout(() => setSystemNotice(null), 3000);
      return;
    }

    setIsSyncingSheet(true);
    try {
      const sheetAssets = await fetchAssetsFromSheet(token, spreadsheet.id);
      if (sheetAssets) {
        setAssets((prev) => {
          const map = new Map<string, AssetRecord>();
          prev.forEach((a) => map.set(a.id, a));
          sheetAssets.forEach((a) => map.set(a.id, a));
          return Array.from(map.values());
        });
        setSystemNotice(`Fetched ${sheetAssets.length} assets from master catalog.`);
      }
    } catch (err: unknown) {
      setSystemNotice(err instanceof Error ? err.message : 'Error syncing sheet');
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSystemNotice(null), 3500);
    }
  };

  const handleAssetCreated = (newAsset: AssetRecord) => {
    setAssets((prev) => [newAsset, ...prev]);
    mobileSyncBridge.notifyServerOfWebAsset(newAsset);
    setSystemNotice(`Asset ${newAsset.id} added and synchronized!`);
    setTimeout(() => setSystemNotice(null), 4000);
  };

  const handleEnsureWorkspace = async () => {
    if (token) {
      await syncWorkspaceResources(token);
    }
  };

  const pendingMobileCount = assets.filter((a) => a.source === 'android' && !a.driveSynced).length;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1E1B18] flex flex-col selection:bg-[#C86D51]/20 selection:text-[#1E1B18]">
      
      {/* Sleek Top Navigation Header */}
      <Header
        user={user}
        isAuthenticated={isAuthenticated}
        driveFolder={driveFolder}
        spreadsheet={spreadsheet}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenMobileSync={() => setIsMobileSyncModalOpen(true)}
        pendingMobileSyncCount={pendingMobileCount}
        isConnectingDrive={isConnectingDrive}
        isConnectingSheets={isConnectingSheets}
      />

      {/* Floating System Notice Toast */}
      {systemNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E1B18] text-[#FAF7F2] text-xs px-4 py-2.5 rounded-xl shadow-lg border border-white/10 font-mono flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-[#C86D51] animate-pulse"></span>
          <span>{systemNotice}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Workspace Synchronization Overview Card */}
        <WorkspaceSetupCard
          isAuthenticated={isAuthenticated}
          driveFolder={driveFolder}
          spreadsheet={spreadsheet}
          onConnect={handleSignIn}
          onRefresh={handleManualRefresh}
          onOpenMobileSync={() => setIsMobileSyncModalOpen(true)}
          pendingMobileCount={pendingMobileCount}
        />

        {/* View Switcher: Catalog vs New Asset Form */}
        {activeTab === 'catalog' ? (
          <CatalogBrowser
            assets={assets}
            isLoading={isSyncingSheet}
            onRefresh={handleManualRefresh}
            onSelectAsset={(asset) => setSelectedAssetForDetail(asset)}
            onNavigateToUpload={() => setActiveTab('upload')}
          />
        ) : (
          <AssetUploadForm
            token={token}
            user={user}
            driveFolder={driveFolder}
            spreadsheet={spreadsheet}
            onAssetCreated={handleAssetCreated}
            onEnsureWorkspace={handleEnsureWorkspace}
            onSignInRequest={handleSignIn}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E1D5] py-8 bg-[#FAF7F2] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#766E65] gap-4">
          <div className="flex items-center space-x-2 font-serif">
            <span className="font-bold text-[#1E1B18] tracking-tight">ATELIER</span>
            <span>•</span>
            <span>Interior Design & 3D Visualization Asset Companion</span>
          </div>

          <div className="flex items-center space-x-4 font-mono text-[11px]">
            <span>Google Drive API v3</span>
            <span>•</span>
            <span>Google Sheets API v4</span>
            <span>•</span>
            <span>Android Room 2.6+</span>
          </div>
        </div>
      </footer>

      {/* Android JSON Export Modal */}
      <AndroidExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        assets={assets}
      />

      {/* Mobile Android Sync Hub & Instruction Prompt Modal */}
      <MobileSyncHubModal
        isOpen={isMobileSyncModalOpen}
        onClose={() => setIsMobileSyncModalOpen(false)}
        token={token}
        driveFolder={driveFolder}
        spreadsheet={spreadsheet}
        assets={assets}
        onAssetsUpdated={(updated) => setAssets(updated)}
        onNotify={(msg) => {
          setSystemNotice(msg);
          setTimeout(() => setSystemNotice(null), 4000);
        }}
      />

      {/* Detailed Asset Inspector Modal */}
      <AssetDetailModal
        asset={selectedAssetForDetail}
        onClose={() => setSelectedAssetForDetail(null)}
      />

    </div>
  );
}
