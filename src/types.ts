/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AssetRecord {
  id: string; // e.g. "AST-829104"
  uploadedAt: string; // ISO timestamp
  title: string;
  description: string;
  driveUrl: string; // Google Drive File URL (webViewLink)
  previewUrl: string; // Direct image preview URL
  spaces: string[];
  styles: string[];
  materials: string[];
  elements: string[];
  customTags: string[];
  paletteHex: string;
  uploader: string; // User email or display name
  source?: 'web' | 'android' | 'seed';
  driveSynced?: boolean;
  driveFileId?: string;
  localImageBase64?: string; // Captured on mobile, queued for web Drive upload
  syncedAt?: string;
}

export interface PairedDevice {
  id: string; // e.g. "android-pixel8-72b1"
  name: string; // e.g. "Pixel 8 Pro - Studio Lead"
  platform: 'android' | 'ios' | 'web';
  lastSyncAt: string;
  appVersion: string;
  status: 'online' | 'idle' | 'offline';
  ip?: string;
  syncedAssetsCount?: number;
}

export interface SyncStatusResponse {
  serverTime: string;
  serverUrl: string;
  totalAssets: number;
  pendingDriveUploads: number;
  activeDevices: PairedDevice[];
  driveConnected: boolean;
  sheetConnected: boolean;
  driveFolderName?: string;
  sheetTitle?: string;
}

export interface BidirectionalSyncPayload {
  deviceId: string;
  deviceName: string;
  lastSyncTimestamp?: string;
  clientAssets: AssetRecord[];
}

export interface BidirectionalSyncResult {
  success: boolean;
  serverTimestamp: string;
  assetsToDownload: AssetRecord[];
  newlyReceivedCount: number;
  totalServerAssets: number;
  pendingDriveUploads: number;
  message: string;
}

export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink: string;
}

export interface SpreadsheetInfo {
  id: string;
  title: string;
  spreadsheetUrl: string;
}

export type UploadStep = 
  | 'idle'
  | 'preparing'
  | 'uploading_drive'
  | 'setting_permissions'
  | 'syncing_sheet'
  | 'completed'
  | 'error';

export const SPACES = [
  'Living Room',
  'Master Suite',
  'Kitchen',
  'Dining Room',
  'Bathroom',
  'Foyer & Entry',
  'Home Office',
  'Terrace & Balcony',
  'Walk-In Closet',
  'Commercial',
] as const;

export const STYLES = [
  'Minimalist',
  'Warm Modern',
  'Japandi',
  'Wabi-Sabi',
  'Industrial',
  'Classic Contemporary',
  'Mid-Century',
  'Brutalist',
  'Organic Luxury',
] as const;

export const MATERIALS = [
  'Travertine Stone',
  'White Oak Veneer',
  'Brushed Brass',
  'Blackened Steel',
  'Bouclé Fabric',
  'Fluted Glass',
  'Microcement',
  'Carrara Marble',
  'Walnut Wood',
  'Linen',
] as const;

export const ELEMENTS = [
  'Pendant Lighting',
  'Bespoke Joinery',
  'Accent Seating',
  'Dining Ensemble',
  'Wall Paneling',
  'Architectural Hardware',
  'Area Rug',
  'Sanitaryware',
] as const;

export interface PalettePreset {
  name: string;
  hex: string;
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { name: 'Terracotta Clay', hex: '#C86D51' },
  { name: 'Warm Alabaster', hex: '#FAF7F2' },
  { name: 'Roman Travertine', hex: '#E2D7C3' },
  { name: 'Smoked Walnut', hex: '#4B382A' },
  { name: 'Muted Sage', hex: '#85937D' },
  { name: 'Brushed Brass', hex: '#C5A059' },
  { name: 'Deep Charcoal', hex: '#1E1B18' },
  { name: 'Carrara Grey', hex: '#D8D8D8' },
  { name: 'Blackened Steel', hex: '#2B2D2F' },
  { name: 'Raw Linen', hex: '#D5C7B3' },
];

export const SHEET_HEADERS = [
  'Asset ID',
  'Uploaded At',
  'Asset Title',
  'Description',
  'Google Drive File URL',
  'Direct Image Preview URL',
  'Space Tags',
  'Style Tags',
  'Material Tags',
  'Element Tags',
  'Custom Tags',
  'Palette Hex',
  'Uploader',
] as const;
