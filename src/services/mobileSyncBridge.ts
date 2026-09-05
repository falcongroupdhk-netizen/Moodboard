/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetRecord, BidirectionalSyncResult, PairedDevice, SyncStatusResponse } from '../types';
import { uploadAssetToDrive } from './googleDrive';
import { appendAssetToSheet } from './googleSheets';

export class MobileSyncBridgeService {
  private lastReconcileTime: string = '';

  /**
   * Retrieves overall sync hub status, active devices, and pending uploads
   */
  async getSyncInfo(): Promise<SyncStatusResponse> {
    const res = await fetch('/api/sync/info');
    if (!res.ok) {
      throw new Error(`Failed to fetch sync status (${res.status})`);
    }
    return res.json();
  }

  /**
   * Fetches latest assets from the sync server
   */
  async fetchServerAssets(since?: string): Promise<AssetRecord[]> {
    const url = since ? `/api/sync/assets?since=${encodeURIComponent(since)}` : '/api/sync/assets';
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch assets from sync server (${res.status})`);
    }
    const data = await res.json();
    return data.assets || [];
  }

  /**
   * Performs bidirectional reconciliation between the Web App and Mobile Sync Server
   */
  async reconcileCatalog(currentAssets: AssetRecord[]): Promise<BidirectionalSyncResult> {
    const payload = {
      deviceId: 'web-companion-console',
      deviceName: 'Atelier Web Companion Hub',
      lastSyncTimestamp: this.lastReconcileTime || undefined,
      clientAssets: currentAssets,
    };

    const res = await fetch('/api/sync/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Reconciliation failed with status ${res.status}`);
    }

    const result: BidirectionalSyncResult = await res.json();
    this.lastReconcileTime = result.serverTimestamp;
    return result;
  }

  /**
   * Automatically looks for mobile-originated assets that are missing from Google Drive,
   * uploads them to the Google Drive folder, appends them to the Master Google Sheet,
   * and reports back to the sync server with authentic Google Drive URLs!
   */
  async syncPendingMobileAssetsToDrive(
    token: string,
    driveFolderId: string,
    spreadsheetId: string,
    onProgress?: (assetTitle: string, index: number, total: number) => void
  ): Promise<AssetRecord[]> {
    // 1. Fetch assets marked as pending drive upload
    const pendingRes = await fetch('/api/sync/pending-drive-uploads');
    if (!pendingRes.ok) return [];

    const data = await pendingRes.json();
    const pendingAssets: AssetRecord[] = data.assets || [];

    if (pendingAssets.length === 0) {
      return [];
    }

    const uploadedAssets: AssetRecord[] = [];

    for (let i = 0; i < pendingAssets.length; i++) {
      const asset = pendingAssets[i];
      if (onProgress) {
        onProgress(asset.title, i + 1, pendingAssets.length);
      }

      try {
        let file: File;

        // If mobile app provided Base64
        if (asset.localImageBase64) {
          const base64Data = asset.localImageBase64.replace(/^data:image\/\w+;base64,/, '');
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let b = 0; b < byteCharacters.length; b++) {
            byteNumbers[b] = byteCharacters.charCodeAt(b);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });
          file = new File([blob], `${asset.id}.jpg`, { type: 'image/jpeg' });
        } else if (asset.previewUrl && asset.previewUrl.startsWith('http')) {
          // If mobile provided an image URL (e.g. cloud storage or staging image)
          const imgRes = await fetch(asset.previewUrl);
          const imgBlob = await imgRes.blob();
          file = new File([imgBlob], `${asset.id}.jpg`, { type: imgBlob.type || 'image/jpeg' });
        } else {
          // Create dummy placeholder specification image
          const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
            <rect width="800" height="600" fill="${asset.paletteHex || '#C86D51'}"/>
            <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="serif" font-size="28">${asset.title}</text>
            <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" opacity="0.8" font-family="sans-serif" font-size="16">Mobile Sync • ${asset.id}</text>
          </svg>`;
          const blob = new Blob([svgContent], { type: 'image/svg+xml' });
          file = new File([blob], `${asset.id}.svg`, { type: 'image/svg+xml' });
        }

        // Upload to Drive folder
        const driveResult = await uploadAssetToDrive(token, driveFolderId, file, asset.title);

        const updatedAsset: AssetRecord = {
          ...asset,
          driveUrl: driveResult.webViewLink,
          previewUrl: driveResult.previewUrl,
          driveSynced: true,
          driveFileId: driveResult.fileId,
          source: 'android',
        };

        // Append row to master Google Sheet
        await appendAssetToSheet(token, spreadsheetId, updatedAsset);

        // Notify server that Drive upload is complete
        await fetch('/api/sync/mark-drive-synced', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: asset.id,
            driveUrl: driveResult.webViewLink,
            previewUrl: driveResult.previewUrl,
            driveFileId: driveResult.fileId,
          }),
        });

        uploadedAssets.push(updatedAsset);
      } catch (err) {
        console.error(`Error uploading mobile asset ${asset.id} to Google Drive:`, err);
      }
    }

    return uploadedAssets;
  }

  /**
   * Pushes a freshly created web asset to the sync server so mobile devices receive it
   */
  async notifyServerOfWebAsset(asset: AssetRecord): Promise<void> {
    try {
      await fetch('/api/sync/web-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: [asset] }),
      });
    } catch (err) {
      console.warn('Could not notify sync server of web asset:', err);
    }
  }

  /**
   * Simulates an Android device taking a photo in the field and pushing it to the sync server
   */
  async simulateMobileCapture(): Promise<{ asset: AssetRecord; pendingDriveUploads: number }> {
    const res = await fetch('/api/sync/simulate-mobile-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Simulation failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Fetches list of registered mobile devices
   */
  async getDevices(): Promise<PairedDevice[]> {
    const res = await fetch('/api/sync/devices');
    if (!res.ok) return [];
    const data = await res.json();
    return data.devices || [];
  }
}

export const mobileSyncBridge = new MobileSyncBridgeService();
