/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Smartphone,
  RefreshCw,
  Copy,
  Check,
  Download,
  Terminal,
  ArrowRightLeft,
  CloudUpload,
  HardDrive,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wifi,
  Send,
  Code2,
} from 'lucide-react';
import { AssetRecord, DriveFolderInfo, PairedDevice, SpreadsheetInfo, SyncStatusResponse } from '../types';
import { mobileSyncBridge } from '../services/mobileSyncBridge';

interface MobileSyncHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  driveFolder: DriveFolderInfo | null;
  spreadsheet: SpreadsheetInfo | null;
  assets: AssetRecord[];
  onAssetsUpdated: (updatedAssets: AssetRecord[]) => void;
  onNotify: (message: string) => void;
}

export const MobileSyncHubModal: React.FC<MobileSyncHubModalProps> = ({
  isOpen,
  onClose,
  token,
  driveFolder,
  spreadsheet,
  assets,
  onAssetsUpdated,
  onNotify,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'prompt' | 'api'>('status');
  const [syncInfo, setSyncInfo] = useState<SyncStatusResponse | null>(null);
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [driveUploadProgress, setDriveUploadProgress] = useState<string | null>(null);

  const serverBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/sync` : 'https://.../api/sync';

  // Load sync info and devices
  const refreshStatus = async () => {
    try {
      const info = await mobileSyncBridge.getSyncInfo();
      setSyncInfo(info);
      const devList = await mobileSyncBridge.getDevices();
      setDevices(devList);
    } catch (err) {
      console.warn('Could not load sync status:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handler: Two-way Reconciliation
  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      const result = await mobileSyncBridge.reconcileCatalog(assets);
      
      // If server gave us new or updated assets
      if (result.assetsToDownload && result.assetsToDownload.length > 0) {
        const map = new Map<string, AssetRecord>();
        assets.forEach((a) => map.set(a.id, a));
        result.assetsToDownload.forEach((a) => map.set(a.id, a));
        const merged = Array.from(map.values());
        onAssetsUpdated(merged);
      }

      await refreshStatus();
      onNotify(result.message || 'Two-way sync reconciliation completed successfully.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Reconciliation failed.');
    } finally {
      setIsReconciling(false);
    }
  };

  // Handler: Sync pending mobile assets to Google Drive & Google Sheets
  const handleSyncToDrive = async () => {
    if (!token || !driveFolder || !spreadsheet) {
      onNotify('Please authorize Google Workspace in the header to upload mobile assets to Drive.');
      return;
    }

    setIsUploadingToDrive(true);
    setDriveUploadProgress('Examining mobile assets...');

    try {
      const uploaded = await mobileSyncBridge.syncPendingMobileAssetsToDrive(
        token,
        driveFolder.id,
        spreadsheet.id,
        (title, curr, total) => {
          setDriveUploadProgress(`Uploading ${curr}/${total}: "${title}" to Drive...`);
        }
      );

      if (uploaded.length > 0) {
        // Update local state
        const map = new Map<string, AssetRecord>();
        assets.forEach((a) => map.set(a.id, a));
        uploaded.forEach((a) => map.set(a.id, a));
        onAssetsUpdated(Array.from(map.values()));
        onNotify(`Successfully uploaded ${uploaded.length} mobile assets to Google Drive and appended to Sheet!`);
      } else {
        onNotify('All mobile assets are already backed up to Google Drive.');
      }

      await refreshStatus();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Drive upload failed.');
    } finally {
      setIsUploadingToDrive(false);
      setDriveUploadProgress(null);
    }
  };

  // Handler: Simulate Android device capture
  const handleSimulateMobile = async () => {
    setIsSimulating(true);
    try {
      const res = await mobileSyncBridge.simulateMobileCapture();
      onAssetsUpdated([res.asset, ...assets]);
      onNotify(`Simulated Android capture: "${res.asset.title}" added from mobile.`);
      await refreshStatus();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Simulation failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(serverBaseUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const instructionPromptText = `# Atelier Android Moodboard Companion Sync Specification

## Overview
Connect the native Android app with the Atelier Web Hub. The mobile app captures interior design assets on-site, stores them in Room database, and reconciles two-way with the web app. The web app automatically uploads mobile photos to the studio's Google Drive folder and appends architectural records to the Master Google Sheet.

## Base Endpoint URL
${serverBaseUrl}

## 1. Sync & Reconciliation Contract
- Endpoint: POST ${serverBaseUrl}/reconcile
- Headers:
    Content-Type: application/json
    X-Device-Id: <unique-android-id>
    X-Device-Name: <device-model>
- Body:
{
  "deviceId": "android-pixel8-72b1",
  "deviceName": "Pixel 8 Pro",
  "lastSyncTimestamp": "2026-09-04T12:00:00Z",
  "clientAssets": [
    {
      "id": "AST-839201",
      "title": "Roman Travertine Basin",
      "description": "On-site capture with brass trim specs",
      "spaces": ["Bathroom"],
      "styles": ["Warm Modern"],
      "materials": ["Travertine Stone"],
      "elements": ["Sanitaryware"],
      "customTags": ["#VillaComo"],
      "paletteHex": "#E2D7C3",
      "uploader": "designer@atelier.studio",
      "imageBase64": "data:image/jpeg;base64,...",
      "uploadedAt": "2026-09-05T08:30:00Z"
    }
  ]
}

## 2. Response Handling
The server returns:
- 'assetsToDownload': New or updated assets from the web/Drive to insert into local Room DB.
- 'pendingDriveUploads': Count of assets queued for Google Drive sync by the web app.

## 3. WorkManager Background Job
Schedule a periodic WorkManager worker every 15 minutes (or on Wi-Fi connection) invoking the reconcile endpoint to keep the mobile device and studio master catalog constantly in sync.
`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(instructionPromptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([instructionPromptText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ANDROID_SYNC_INSTRUCTION_PROMPT.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const pendingMobileCount = assets.filter((a) => a.source === 'android' && !a.driveSynced).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white border border-[#E8E1D5] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E8E1D5] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#C86D51]/10 text-[#C86D51] rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-xl font-bold text-[#1E1B18]">
                  Android Mobile App Synchronization Hub
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Sync Engine Online</span>
                </span>
              </div>
              <p className="text-xs text-[#766E65] mt-0.5">
                Two-way bidirectional synchronization between native Android devices, Web Studio Hub, Google Drive, and Google Sheets.
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

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E8E1D5] bg-white px-6">
          <button
            onClick={() => setActiveSubTab('status')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeSubTab === 'status'
                ? 'border-[#C86D51] text-[#C86D51]'
                : 'border-transparent text-[#766E65] hover:text-[#1E1B18]'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Connection & Two-Way Sync</span>
          </button>

          <button
            onClick={() => setActiveSubTab('prompt')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeSubTab === 'prompt'
                ? 'border-[#C86D51] text-[#C86D51]'
                : 'border-transparent text-[#766E65] hover:text-[#1E1B18]'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Android App Instruction Prompt</span>
          </button>

          <button
            onClick={() => setActiveSubTab('api')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeSubTab === 'api'
                ? 'border-[#C86D51] text-[#C86D51]'
                : 'border-transparent text-[#766E65] hover:text-[#1E1B18]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>REST API Specifications</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAF7F2]/40">
          
          {/* TAB 1: Live Status & Reconciliation */}
          {activeSubTab === 'status' && (
            <div className="space-y-6">
              
              {/* Endpoint Connection Bar */}
              <div className="bg-white border border-[#E8E1D5] rounded-xl p-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#766E65] font-bold">
                      Android Device Connection URL
                    </span>
                    <div className="font-mono text-xs font-semibold text-[#1E1B18] mt-0.5 break-all">
                      {serverBaseUrl}
                    </div>
                  </div>

                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#E8E1D5]/40 border border-[#E8E1D5] text-xs font-medium text-[#1E1B18] shrink-0"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#766E65]" />
                        <span>Copy Base URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Drive & Sheet Sync Gateway Card */}
              <div className="bg-white border border-[#E8E1D5] rounded-xl p-5 shadow-2xs">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#C86D51]/10 rounded-lg text-[#C86D51]">
                      <CloudUpload className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-serif text-base font-bold text-[#1E1B18]">
                        Mobile ➔ Google Drive & Sheet Bridge
                      </h4>
                      <p className="text-xs text-[#766E65] mt-0.5">
                        Assets uploaded on Android are automatically backed up to Google Drive and logged into your Master Sheet through this web app.
                      </p>
                    </div>
                  </div>

                  {pendingMobileCount > 0 ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-mono font-bold">
                      {pendingMobileCount} Pending Drive Upload
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-mono font-semibold flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All Synced to Drive</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="flex items-center space-x-2 text-xs text-[#766E65] bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8E1D5]">
                    <HardDrive className="w-4 h-4 text-[#C86D51]" />
                    <span className="truncate">
                      <strong>Drive:</strong> {driveFolder ? driveFolder.name : 'Waiting for Workspace link'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-[#766E65] bg-[#FAF7F2] p-2.5 rounded-lg border border-[#E8E1D5]">
                    <FileSpreadsheet className="w-4 h-4 text-[#85937D]" />
                    <span className="truncate">
                      <strong>Sheet:</strong> {spreadsheet ? spreadsheet.title : 'Waiting for Workspace link'}
                    </span>
                  </div>
                </div>

                {driveUploadProgress && (
                  <div className="mt-3 p-2.5 rounded-lg bg-[#FDF6F3] border border-[#C86D51]/30 text-xs text-[#C86D51] font-mono animate-pulse">
                    {driveUploadProgress}
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 mt-4 pt-3 border-t border-[#E8E1D5]/60">
                  <button
                    onClick={handleSyncToDrive}
                    disabled={isUploadingToDrive || !token}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#C86D51] hover:bg-[#A85238] disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-xs"
                  >
                    <CloudUpload className={`w-3.5 h-3.5 ${isUploadingToDrive ? 'animate-bounce' : ''}`} />
                    <span>{isUploadingToDrive ? 'Uploading to Drive...' : 'Sync Mobile Assets to Drive'}</span>
                  </button>
                </div>
              </div>

              {/* Two-Way Actions & Paired Devices */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Reconcile Action */}
                <div className="bg-white border border-[#E8E1D5] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#766E65] font-bold">
                      Bidirectional Reconcile
                    </span>
                    <p className="text-xs text-[#766E65] mt-1">
                      Compares catalog items, merges new assets, and updates diffs between web and mobile.
                    </p>
                  </div>
                  <button
                    onClick={handleReconcile}
                    disabled={isReconciling}
                    className="mt-4 w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-full bg-[#1E1B18] hover:bg-[#332E2A] text-white text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                    <span>{isReconciling ? 'Reconciling...' : 'Check & Sync Now'}</span>
                  </button>
                </div>

                {/* Simulated Android Capture */}
                <div className="bg-white border border-[#E8E1D5] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#C86D51] font-bold flex items-center space-x-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Simulate Mobile Capture</span>
                    </span>
                    <p className="text-xs text-[#766E65] mt-1">
                      Simulate an on-site photo capture by an Android device to test the sync and Drive pipeline instantly.
                    </p>
                  </div>
                  <button
                    onClick={handleSimulateMobile}
                    disabled={isSimulating}
                    className="mt-4 w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-full bg-[#FAF7F2] hover:bg-[#E8E1D5]/50 border border-[#E8E1D5] text-[#1E1B18] text-xs font-semibold transition-all"
                  >
                    <Send className={`w-3.5 h-3.5 text-[#C86D51] ${isSimulating ? 'animate-pulse' : ''}`} />
                    <span>{isSimulating ? 'Sending from Mobile...' : 'Simulate Phone Upload'}</span>
                  </button>
                </div>

                {/* Sync Stats */}
                <div className="bg-white border border-[#E8E1D5] rounded-xl p-4 flex flex-col justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#766E65] font-bold">
                      Master Sync Metrics
                    </span>
                    <div className="mt-2 space-y-1.5 text-xs text-[#766E65]">
                      <div className="flex justify-between">
                        <span>Total Catalog Items:</span>
                        <strong className="font-mono text-[#1E1B18]">{assets.length}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Mobile Sourced:</span>
                        <strong className="font-mono text-[#C86D51]">
                          {assets.filter((a) => a.source === 'android').length}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Pending Drive Upload:</span>
                        <strong className="font-mono text-amber-600">{pendingMobileCount}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-[#766E65] font-mono text-right">
                    Heartbeat: {new Date().toLocaleTimeString()}
                  </div>
                </div>

              </div>

              {/* Connected Android Devices Table */}
              <div className="bg-white border border-[#E8E1D5] rounded-xl p-5 shadow-2xs">
                <h4 className="font-serif text-sm font-bold text-[#1E1B18] mb-3 flex items-center space-x-2">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span>Registered & Paired Android Devices ({devices.length})</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E8E1D5] text-[10px] font-mono uppercase tracking-wider text-[#766E65]">
                        <th className="pb-2">Device Name</th>
                        <th className="pb-2">Device ID</th>
                        <th className="pb-2">App Version</th>
                        <th className="pb-2">Last Synchronized</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E1D5]/60">
                      {devices.map((device) => (
                        <tr key={device.id} className="hover:bg-[#FAF7F2]">
                          <td className="py-2.5 font-medium text-[#1E1B18] flex items-center space-x-2">
                            <Smartphone className="w-3.5 h-3.5 text-[#C86D51]" />
                            <span>{device.name}</span>
                          </td>
                          <td className="py-2.5 font-mono text-[#766E65] text-[11px]">{device.id}</td>
                          <td className="py-2.5 font-mono text-[#766E65]">{device.appVersion}</td>
                          <td className="py-2.5 text-[#766E65] font-mono text-[11px]">
                            {new Date(device.lastSyncAt).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono font-medium border border-emerald-200">
                              Online
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Android Developer Instruction Prompt */}
          {activeSubTab === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-serif text-lg font-bold text-[#1E1B18]">
                    Android App Instruction Prompt
                  </h4>
                  <p className="text-xs text-[#766E65]">
                    Feed this complete architectural specification and code blueprint into your Android AI assistant or copy it to Android Studio.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDownloadPrompt}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-[#E8E1D5] hover:bg-[#FAF7F2] text-xs font-medium text-[#1E1B18]"
                  >
                    <Download className="w-3.5 h-3.5 text-[#766E65]" />
                    <span>Download .md</span>
                  </button>

                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#C86D51] hover:bg-[#A85238] text-white text-xs font-semibold shadow-xs"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied Prompt!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Complete Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-[#1E1B18] text-[#FAF7F2] rounded-xl p-5 font-mono text-xs overflow-x-auto leading-relaxed max-h-[460px] border border-stone-800 shadow-inner">
                <pre>
                  <code>{instructionPromptText}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: REST API Specifications */}
          {activeSubTab === 'api' && (
            <div className="space-y-4 text-xs">
              <h4 className="font-serif text-lg font-bold text-[#1E1B18]">
                Native Android Synchronization Endpoints
              </h4>
              <p className="text-xs text-[#766E65]">
                Direct HTTP contracts accessible by Android Retrofit, OkHttp, or Ktor clients.
              </p>

              {/* Endpoint 1: POST /api/sync/reconcile */}
              <div className="bg-white border border-[#E8E1D5] rounded-xl p-4 space-y-2 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-[#C86D51] text-white font-mono font-bold text-[10px]">
                    POST
                  </span>
                  <code className="font-mono text-[#1E1B18] font-bold">/api/sync/reconcile</code>
                  <span className="text-[#766E65] text-[11px]">— Primary Bidirectional Sync</span>
                </div>
                <p className="text-xs text-[#766E65]">
                  Android sends local un-synced assets; server replies with incoming assets to download and flags mobile assets for Google Drive proxy upload.
                </p>
                <div className="bg-[#FAF7F2] p-3 rounded-lg border border-[#E8E1D5] font-mono text-[11px] text-[#1E1B18]">
                  Request: &#123; deviceId: string, deviceName: string, lastSyncTimestamp?: string, clientAssets: AssetRecord[] &#125;<br/>
                  Response: &#123; success: true, serverTimestamp: string, assetsToDownload: AssetRecord[], newlyReceivedCount: number &#125;
                </div>
              </div>

              {/* Endpoint 2: GET /api/sync/assets */}
              <div className="bg-white border border-[#E8E1D5] rounded-xl p-4 space-y-2 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-[#85937D] text-white font-mono font-bold text-[10px]">
                    GET
                  </span>
                  <code className="font-mono text-[#1E1B18] font-bold">/api/sync/assets?since=ISO_TIMESTAMP</code>
                  <span className="text-[#766E65] text-[11px]">— Full or Incremental Catalog Pull</span>
                </div>
                <p className="text-xs text-[#766E65]">
                  Returns all moodboard assets stored in the catalog with real Google Drive thumbnail links and architectural metadata.
                </p>
              </div>

              {/* Endpoint 3: POST /api/sync/push */}
              <div className="bg-white border border-[#E8E1D5] rounded-xl p-4 space-y-2 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-[#C86D51] text-white font-mono font-bold text-[10px]">
                    POST
                  </span>
                  <code className="font-mono text-[#1E1B18] font-bold">/api/sync/push</code>
                  <span className="text-[#766E65] text-[11px]">— Single Asset On-Site Push</span>
                </div>
                <p className="text-xs text-[#766E65]">
                  Android immediately uploads a newly snapped photo with tactile tags. Web app queues it for Google Drive and Sheet sync.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E8E1D5] bg-white flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-[#766E65]">
            <span className="font-mono text-[#1E1B18] font-semibold">Drive Bridge:</span>
            <span>Active on this Web Hub</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#1E1B18] hover:bg-[#332E2A] text-white text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
