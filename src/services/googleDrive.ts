/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DriveFolderInfo } from '../types';

export const TARGET_FOLDER_NAME = 'Studio Moodboard Assets';

export interface DriveUploadResult {
  fileId: string;
  name: string;
  webViewLink: string;
  previewUrl: string;
}

/**
 * Searches for existing folder or creates a new one named 'Studio Moodboard Assets'
 */
export async function getOrCreateDriveFolder(token: string): Promise<DriveFolderInfo> {
  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${TARGET_FOLDER_NAME}' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Google Drive API search failed (${searchRes.status}): ${errorText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existing = searchData.files[0];
    return {
      id: existing.id,
      name: existing.name,
      webViewLink: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
    };
  }

  // If not found, create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: TARGET_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Central asset repository for Atelier Interior Design Moodboards & Visualizations',
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create Google Drive folder (${createRes.status}): ${errorText}`);
  }

  const newFolder = await createRes.json();
  return {
    id: newFolder.id,
    name: newFolder.name,
    webViewLink: newFolder.webViewLink || `https://drive.google.com/drive/folders/${newFolder.id}`,
  };
}

/**
 * Sets public read permission so moodboard cards and client presentations can display thumbnails
 */
export async function setFilePublicReadable(token: string, fileId: string): Promise<void> {
  try {
    const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
        allowFileDiscovery: false,
      }),
    });

    if (!permRes.ok) {
      console.warn(`Permission setting warning (${permRes.status}):`, await permRes.text());
    }
  } catch (err) {
    console.warn('Error setting file permissions:', err);
  }
}

/**
 * Performs multipart upload to Google Drive v3
 */
export async function uploadAssetToDrive(
  token: string,
  folderId: string,
  file: File,
  customTitle?: string
): Promise<DriveUploadResult> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileName = customTitle 
    ? `${customTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${file.name}`
    : file.name;

  const metadata = {
    name: fileName,
    parents: [folderId],
    description: `Moodboard asset uploaded via Atelier Studio Companion`,
  };

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const fileHeader = `${delimiter}Content-Type: ${file.type || 'image/jpeg'}\r\n\r\n`;

  // Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();

  // Construct multipart request body using Blob
  const multipartBlob = new Blob([
    metadataPart,
    fileHeader,
    fileBuffer,
    closeDelimiter,
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,thumbnailLink,webContentLink';

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Drive multipart upload failed (${uploadRes.status}): ${errorText}`);
  }

  const uploadData = await uploadRes.json();
  const fileId = uploadData.id;

  // Make readable
  await setFilePublicReadable(token, fileId);

  // Reliable direct preview image URL
  const previewUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  const webViewLink = uploadData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

  return {
    fileId,
    name: uploadData.name,
    webViewLink,
    previewUrl,
  };
}
