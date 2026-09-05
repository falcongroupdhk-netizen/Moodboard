/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AssetRecord, SHEET_HEADERS, SpreadsheetInfo } from '../types';

export const TARGET_SPREADSHEET_TITLE = 'Interior Moodboard Asset Catalog';

/**
 * Searches for existing spreadsheet or creates a new one named 'Interior Moodboard Asset Catalog'
 */
export async function getOrCreateSpreadsheet(token: string): Promise<SpreadsheetInfo> {
  // Check Drive first
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.spreadsheet' and name = '${TARGET_SPREADSHEET_TITLE}' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      const existing = data.files[0];
      return {
        id: existing.id,
        title: existing.name,
        spreadsheetUrl: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
      };
    }
  }

  // Create new spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: TARGET_SPREADSHEET_TITLE,
      },
      sheets: [
        {
          properties: {
            title: 'Sheet1',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Sheet (${createRes.status}): ${errText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;

  // Initialize header row
  await initializeHeaders(token, spreadsheetId);

  return {
    id: spreadsheetId,
    title: TARGET_SPREADSHEET_TITLE,
    spreadsheetUrl: sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Ensures header row exists with styling
 */
export async function initializeHeaders(token: string, spreadsheetId: string): Promise<void> {
  const range = 'Sheet1!A1:M1';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [SHEET_HEADERS],
    }),
  });

  if (!res.ok) {
    console.warn('Could not initialize sheet headers:', await res.text());
  }
}

/**
 * Appends asset record row to spreadsheet
 */
export async function appendAssetToSheet(
  token: string,
  spreadsheetId: string,
  asset: AssetRecord
): Promise<void> {
  const range = 'Sheet1!A:M';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const rowData = [
    asset.id,
    asset.uploadedAt,
    asset.title,
    asset.description,
    asset.driveUrl,
    asset.previewUrl,
    asset.spaces.join(', '),
    asset.styles.join(', '),
    asset.materials.join(', '),
    asset.elements.join(', '),
    asset.customTags.join(', '),
    asset.paletteHex,
    asset.uploader,
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [rowData],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to append asset to Google Sheet (${res.status}): ${errText}`);
  }
}

/**
 * Fetches all asset rows from spreadsheet
 */
export async function fetchAssetsFromSheet(
  token: string,
  spreadsheetId: string
): Promise<AssetRecord[]> {
  const range = 'Sheet1!A2:M';
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch catalog from Sheet (${res.status}): ${err}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows
    .filter((row) => row && row[0] && row[0].trim() !== '')
    .map((row) => {
      const parseList = (val: string | undefined): string[] => {
        if (!val) return [];
        return val.split(',').map((s) => s.trim()).filter(Boolean);
      };

      return {
        id: row[0] || '',
        uploadedAt: row[1] || new Date().toISOString(),
        title: row[2] || 'Untitled Asset',
        description: row[3] || '',
        driveUrl: row[4] || '',
        previewUrl: row[5] || row[4] || '',
        spaces: parseList(row[6]),
        styles: parseList(row[7]),
        materials: parseList(row[8]),
        elements: parseList(row[9]),
        customTags: parseList(row[10]),
        paletteHex: row[11] || '#C86D51',
        uploader: row[12] || 'Unknown',
      };
    });
}
