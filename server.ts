/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { AssetRecord, PairedDevice, BidirectionalSyncPayload } from './src/types';
import { INITIAL_SAMPLE_ASSETS } from './src/data/sampleAssets';

const PORT = 3000;
const STORAGE_FILE = path.join(process.cwd(), 'synced_catalog.json');

// In-memory catalog initialized with stored or sample data
let catalog: AssetRecord[] = [];
const pairedDevices = new Map<string, PairedDevice>();

// Initialize default sample devices
pairedDevices.set('android-pixel8-72b1', {
  id: 'android-pixel8-72b1',
  name: 'Pixel 8 Pro (Studio Field Lead)',
  platform: 'android',
  lastSyncAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  appVersion: '2.4.2',
  status: 'online',
  syncedAssetsCount: 4,
});

pairedDevices.set('android-tab-s9-90c3', {
  id: 'android-tab-s9-90c3',
  name: 'Galaxy Tab S9+ (Client Review)',
  platform: 'android',
  lastSyncAt: new Date(Date.now() - 1000 * 60 * 54).toISOString(),
  appVersion: '2.4.2',
  status: 'idle',
  syncedAssetsCount: 4,
});

// Load persistent catalog from disk or fallback to initial samples
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
    catalog = JSON.parse(data);
    console.log(`[Sync Server] Loaded ${catalog.length} assets from persistent storage.`);
  } else {
    catalog = [...INITIAL_SAMPLE_ASSETS].map((a) => ({
      ...a,
      source: 'seed',
      driveSynced: true,
      syncedAt: new Date().toISOString(),
    }));
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`[Sync Server] Initialized catalog with ${catalog.length} seed assets.`);
  }
} catch (err) {
  console.warn('[Sync Server] Error loading storage file, using seed assets:', err);
  catalog = [...INITIAL_SAMPLE_ASSETS];
}

function persistCatalog() {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(catalog, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Sync Server] Failed to save catalog to disk:', err);
  }
}

async function startServer() {
  const app = express();

  // Middleware for large image payloads (Base64 imagery from mobile)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS Middleware for Android HTTP clients (Retrofit, OkHttp, Volley)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Device-Id, X-Device-Name');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // -------------------------------------------------------------
  // API ROUTES (Always before Vite / static fallback)
  // -------------------------------------------------------------

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Sync Hub Info
  app.get('/api/sync/info', (req: Request, res: Response) => {
    const pendingDriveUploads = catalog.filter((a) => a.driveSynced === false).length;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host || `localhost:${PORT}`;
    const serverUrl = `${protocol}://${host}`;

    res.json({
      serverTime: new Date().toISOString(),
      serverUrl,
      syncEndpoint: `${serverUrl}/api/sync`,
      totalAssets: catalog.length,
      pendingDriveUploads,
      activeDevices: Array.from(pairedDevices.values()),
      driveConnected: true,
      sheetConnected: true,
      driveFolderName: 'Studio Moodboard Assets',
      sheetTitle: 'Interior Moodboard Asset Catalog',
    });
  });

  // Get all synced assets (with optional '?since=ISO_TIMESTAMP')
  app.get('/api/sync/assets', (req: Request, res: Response) => {
    const since = req.query.since as string | undefined;

    let result = catalog;
    if (since) {
      const sinceDate = new Date(since).getTime();
      result = catalog.filter((asset) => {
        const upDate = new Date(asset.uploadedAt).getTime();
        const syncDate = asset.syncedAt ? new Date(asset.syncedAt).getTime() : upDate;
        return upDate > sinceDate || syncDate > sinceDate;
      });
    }

    res.json({
      success: true,
      serverTimestamp: new Date().toISOString(),
      count: result.length,
      totalCatalogSize: catalog.length,
      assets: result,
    });
  });

  // Two-way Bidirectional Sync Reconciliation
  // Android App calls this to send its local assets and receive server updates
  app.post('/api/sync/reconcile', (req: Request, res: Response) => {
    const payload = req.body as BidirectionalSyncPayload;
    const deviceId = payload.deviceId || (req.headers['x-device-id'] as string) || 'android-device-unknown';
    const deviceName = payload.deviceName || (req.headers['x-device-name'] as string) || 'Android Mobile App';
    const clientAssets: AssetRecord[] = Array.isArray(payload.clientAssets) ? payload.clientAssets : [];
    const lastSyncTime = payload.lastSyncTimestamp ? new Date(payload.lastSyncTimestamp).getTime() : 0;

    // Register / update device
    pairedDevices.set(deviceId, {
      id: deviceId,
      name: deviceName,
      platform: 'android',
      lastSyncAt: new Date().toISOString(),
      appVersion: '2.4.2',
      status: 'online',
      syncedAssetsCount: clientAssets.length,
    });

    let newlyReceivedCount = 0;
    const clientAssetIds = new Set(clientAssets.map((a) => a.id));

    // 1. Process assets coming from Android
    for (const clientAsset of clientAssets) {
      const existingIndex = catalog.findIndex((a) => a.id === clientAsset.id);

      if (existingIndex === -1) {
        // Asset is completely new from Android
        const newAsset: AssetRecord = {
          ...clientAsset,
          id: clientAsset.id || `AST-${Math.floor(100000 + Math.random() * 900000)}`,
          uploadedAt: clientAsset.uploadedAt || new Date().toISOString(),
          source: 'android',
          // If the asset doesn't have a real drive link yet, mark driveSynced = false so web app uploads it to Google Drive
          driveSynced: Boolean(clientAsset.driveUrl && clientAsset.driveUrl.includes('drive.google.com')),
          syncedAt: new Date().toISOString(),
        };

        catalog.unshift(newAsset);
        newlyReceivedCount++;
      } else {
        // Asset exists, update if client has newer edits or newly supplied local images
        const existing = catalog[existingIndex];
        const clientDate = new Date(clientAsset.uploadedAt).getTime();
        const serverDate = new Date(existing.uploadedAt).getTime();

        if (clientDate > serverDate) {
          catalog[existingIndex] = {
            ...existing,
            ...clientAsset,
            // Retain real drive link if server had already uploaded it
            driveUrl: existing.driveUrl || clientAsset.driveUrl,
            previewUrl: existing.previewUrl || clientAsset.previewUrl,
            driveSynced: existing.driveSynced ?? false,
            syncedAt: new Date().toISOString(),
          };
        }
      }
    }

    // 2. Identify assets on server that Android doesn't have or that were updated since last sync
    const assetsToDownload = catalog.filter((serverAsset) => {
      // Missing entirely on client
      if (!clientAssetIds.has(serverAsset.id)) {
        return true;
      }
      // Or server asset was updated after client's last sync
      if (lastSyncTime > 0) {
        const serverUpdate = serverAsset.syncedAt
          ? new Date(serverAsset.syncedAt).getTime()
          : new Date(serverAsset.uploadedAt).getTime();
        return serverUpdate > lastSyncTime;
      }
      return false;
    });

    if (newlyReceivedCount > 0) {
      persistCatalog();
    }

    const pendingDriveUploads = catalog.filter((a) => a.driveSynced === false).length;

    res.json({
      success: true,
      serverTimestamp: new Date().toISOString(),
      assetsToDownload,
      newlyReceivedCount,
      totalServerAssets: catalog.length,
      pendingDriveUploads,
      message: `Reconciliation complete: ${newlyReceivedCount} new assets received from mobile, ${assetsToDownload.length} assets sent to mobile.`,
    });
  });

  // Single Asset Push from Mobile
  app.post('/api/sync/push', (req: Request, res: Response) => {
    const body = req.body;
    const deviceId = body.deviceId || 'android-client';
    const deviceName = body.deviceName || 'Android Device';

    const assetId = body.id || `AST-${Math.floor(100000 + Math.random() * 900000)}`;

    const newAsset: AssetRecord = {
      id: assetId,
      uploadedAt: body.uploadedAt || new Date().toISOString(),
      title: body.title || 'Untitled Mobile Asset',
      description: body.description || '',
      driveUrl: body.driveUrl || body.previewUrl || '',
      previewUrl: body.previewUrl || body.driveUrl || '',
      spaces: Array.isArray(body.spaces) ? body.spaces : [],
      styles: Array.isArray(body.styles) ? body.styles : [],
      materials: Array.isArray(body.materials) ? body.materials : [],
      elements: Array.isArray(body.elements) ? body.elements : [],
      customTags: Array.isArray(body.customTags) ? body.customTags : ['#MobileSync'],
      paletteHex: body.paletteHex || '#C86D51',
      uploader: body.uploader || 'mobile_user@atelier.studio',
      source: 'android',
      driveSynced: Boolean(body.driveUrl && body.driveUrl.includes('drive.google.com')),
      localImageBase64: body.imageBase64 || body.localImageBase64 || undefined,
      syncedAt: new Date().toISOString(),
    };

    // Update device
    pairedDevices.set(deviceId, {
      id: deviceId,
      name: deviceName,
      platform: 'android',
      lastSyncAt: new Date().toISOString(),
      appVersion: '2.4.2',
      status: 'online',
    });

    catalog.unshift(newAsset);
    persistCatalog();

    res.status(201).json({
      success: true,
      message: 'Asset successfully pushed from mobile and queued for Drive sync.',
      asset: newAsset,
    });
  });

  // Pending Drive Uploads (Web App queries this to upload mobile assets to Google Drive & Google Sheets)
  app.get('/api/sync/pending-drive-uploads', (req: Request, res: Response) => {
    const pending = catalog.filter((a) => a.driveSynced === false);
    res.json({
      success: true,
      count: pending.length,
      assets: pending,
    });
  });

  // Web App reports an asset has been uploaded to Google Drive & Sheets
  app.post('/api/sync/mark-drive-synced', (req: Request, res: Response) => {
    const { id, driveUrl, previewUrl, driveFileId } = req.body;
    const index = catalog.findIndex((a) => a.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: `Asset ${id} not found.` });
    }

    catalog[index] = {
      ...catalog[index],
      driveUrl: driveUrl || catalog[index].driveUrl,
      previewUrl: previewUrl || catalog[index].previewUrl,
      driveFileId: driveFileId || catalog[index].driveFileId,
      driveSynced: true,
      localImageBase64: undefined, // Clear base64 once stored in Google Drive
      syncedAt: new Date().toISOString(),
    };

    persistCatalog();

    res.json({
      success: true,
      message: `Asset ${id} marked as uploaded to Drive and Sheets.`,
      asset: catalog[index],
    });
  });

  // Update or sync the entire catalog from web app (e.g. after uploading new asset on web)
  app.post('/api/sync/web-update', (req: Request, res: Response) => {
    const { assets } = req.body;
    if (Array.isArray(assets) && assets.length > 0) {
      // Merge unique by id
      const map = new Map<string, AssetRecord>();
      catalog.forEach((a) => map.set(a.id, a));
      assets.forEach((a: AssetRecord) => {
        map.set(a.id, {
          ...a,
          source: a.source || 'web',
          driveSynced: a.driveSynced ?? true,
          syncedAt: new Date().toISOString(),
        });
      });
      catalog = Array.from(map.values());
      persistCatalog();
    }
    res.json({ success: true, count: catalog.length });
  });

  // List Devices
  app.get('/api/sync/devices', (req: Request, res: Response) => {
    res.json({
      devices: Array.from(pairedDevices.values()),
    });
  });

  // Pair new device
  app.post('/api/sync/devices/pair', (req: Request, res: Response) => {
    const { deviceId, deviceName, platform } = req.body;
    const id = deviceId || `android-${Date.now().toString(36)}`;
    const newDevice: PairedDevice = {
      id,
      name: deviceName || 'New Mobile Device',
      platform: platform || 'android',
      lastSyncAt: new Date().toISOString(),
      appVersion: '2.4.2',
      status: 'online',
      syncedAssetsCount: 0,
    };
    pairedDevices.set(id, newDevice);
    res.json({ success: true, device: newDevice });
  });

  // Demo / Simulation endpoint: triggers an Android device pushing an asset
  app.post('/api/sync/simulate-mobile-sync', (req: Request, res: Response) => {
    const demoItems = [
      {
        title: 'Travertine Cantilever Basin Unit',
        description: 'Captured on-site via Pixel 8 Pro camera. Solid Roman travertine double vanity with patinated brass shadowline.',
        spaces: ['Bathroom'],
        styles: ['Warm Modern', 'Wabi-Sabi'],
        materials: ['Travertine Stone', 'Brushed Brass'],
        elements: ['Sanitaryware', 'Bespoke Joinery'],
        customTags: ['#VillaComo', '#FieldCapture', '#OnSiteInspection'],
        paletteHex: '#E2D7C3',
        previewUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1000&q=80',
      },
      {
        title: 'Nordic Oak & Smoked Glass Partition',
        description: 'Field photo of acoustic reeded glass screens framed by oiled Danish oak for private office suite.',
        spaces: ['Home Office', 'Commercial'],
        styles: ['Minimalist', 'Japandi'],
        materials: ['White Oak Veneer', 'Fluted Glass'],
        elements: ['Wall Paneling', 'Architectural Hardware'],
        customTags: ['#StudioFieldInspection', '#AcousticScreens'],
        paletteHex: '#FAF7F2',
        previewUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=80',
      },
      {
        title: 'Cast Bronze Sculptural Dining Table',
        description: 'Captured in artisan foundry by field designer. Heavy sand-cast bronze pedestal base with microcement top.',
        spaces: ['Dining Room'],
        styles: ['Brutalist', 'Organic Luxury'],
        materials: ['Microcement', 'Blackened Steel', 'Brushed Brass'],
        elements: ['Dining Ensemble', 'Bespoke Joinery'],
        customTags: ['#ArtisanSpec', '#MobileUpload'],
        paletteHex: '#4B382A',
        previewUrl: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1000&q=80',
      },
    ];

    const pick = demoItems[Math.floor(Math.random() * demoItems.length)];
    const assetId = `AST-${Math.floor(100000 + Math.random() * 900000)}`;

    const simulatedAsset: AssetRecord = {
      id: assetId,
      uploadedAt: new Date().toISOString(),
      title: pick.title,
      description: pick.description,
      driveUrl: pick.previewUrl,
      previewUrl: pick.previewUrl,
      spaces: pick.spaces,
      styles: pick.styles,
      materials: pick.materials,
      elements: pick.elements,
      customTags: pick.customTags,
      paletteHex: pick.paletteHex,
      uploader: 'pixel8_designer@atelier.studio',
      source: 'android',
      driveSynced: false, // Marked false so web app uploads it to Google Drive and updates Sheet!
      syncedAt: new Date().toISOString(),
    };

    catalog.unshift(simulatedAsset);
    persistCatalog();

    // Update Pixel 8 Pro device
    pairedDevices.set('android-pixel8-72b1', {
      id: 'android-pixel8-72b1',
      name: 'Pixel 8 Pro (Studio Field Lead)',
      platform: 'android',
      lastSyncAt: new Date().toISOString(),
      appVersion: '2.4.2',
      status: 'online',
      syncedAssetsCount: (pairedDevices.get('android-pixel8-72b1')?.syncedAssetsCount || 4) + 1,
    });

    res.json({
      success: true,
      message: `Simulated Android asset ${assetId} pushed to server. Ready for Google Drive & Sheet sync.`,
      asset: simulatedAsset,
      pendingDriveUploads: catalog.filter((a) => a.driveSynced === false).length,
    });
  });

  // -------------------------------------------------------------
  // VITE / STATIC SERVING
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sync Server] Atelier Moodboard Companion running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Sync Server] Fatal error during startup:', err);
  process.exit(1);
});
