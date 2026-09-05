/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Check, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Tag, 
  Palette, 
  Layers, 
  FolderGit2, 
  Table2,
  ExternalLink,
  Plus
} from 'lucide-react';
import { 
  AssetRecord, 
  SPACES, 
  STYLES, 
  MATERIALS, 
  ELEMENTS, 
  PALETTE_PRESETS,
  UploadStep,
  DriveFolderInfo,
  SpreadsheetInfo,
  UserProfile
} from '../types';
import { uploadAssetToDrive } from '../services/googleDrive';
import { appendAssetToSheet } from '../services/googleSheets';

interface AssetUploadFormProps {
  token: string | null;
  user: UserProfile | null;
  driveFolder: DriveFolderInfo | null;
  spreadsheet: SpreadsheetInfo | null;
  onAssetCreated: (newAsset: AssetRecord) => void;
  onEnsureWorkspace: () => Promise<void>;
  onSignInRequest: () => void;
}

export const AssetUploadForm: React.FC<AssetUploadFormProps> = ({
  token,
  user,
  driveFolder,
  spreadsheet,
  onAssetCreated,
  onEnsureWorkspace,
  onSignInRequest,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileDimensions, setFileDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>(['Living Room']);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['Warm Modern']);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(['Travertine Stone']);
  const [selectedElements, setSelectedElements] = useState<string[]>(['Bespoke Joinery']);
  const [paletteHex, setPaletteHex] = useState('#C86D51');
  const [customTagInput, setCustomTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>(['#AtelierCollection']);

  // Upload Process State
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [uploadProgressMsg, setUploadProgressMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUploadedAsset, setLastUploadedAsset] = useState<AssetRecord | null>(null);

  // Drag and Drop
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, or WEBP)');
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Calculate dimensions
    const img = new Image();
    img.onload = () => {
      setFileDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = objectUrl;

    // Auto populate title if empty
    if (!title.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      setTitle(cleanName);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFileDimensions(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleTag = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleCustomTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCustomTag();
    }
  };

  const addCustomTag = () => {
    let clean = customTagInput.trim();
    if (!clean) return;
    if (!clean.startsWith('#')) {
      clean = `#${clean}`;
    }
    if (!customTags.includes(clean)) {
      setCustomTags([...customTags, clean]);
    }
    setCustomTagInput('');
  };

  const removeCustomTag = (tagToRemove: string) => {
    setCustomTags(customTags.filter((t) => t !== tagToRemove));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile && !previewUrl) {
      setErrorMessage('Please provide an image for the moodboard asset.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please provide an asset title.');
      return;
    }

    setErrorMessage(null);
    setUploadStep('preparing');

    // Generate standard Asset ID format
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const assetId = `AST-${randomSuffix}`;
    const timestamp = new Date().toISOString();
    const uploaderEmail = user?.email || 'designer@atelier-studio.com';

    try {
      // If token is available, perform full Google Workspace Drive & Sheets synchronization
      if (token) {
        setUploadProgressMsg('Ensuring Google Workspace folder and catalog exist...');
        await onEnsureWorkspace();

        let driveFileUrl = previewUrl || '';
        let directPreviewUrl = previewUrl || '';

        if (selectedFile && driveFolder) {
          setUploadStep('uploading_drive');
          setUploadProgressMsg(`Uploading high-res asset to Google Drive folder "${driveFolder.name}"...`);
          
          const driveResult = await uploadAssetToDrive(
            token,
            driveFolder.id,
            selectedFile,
            title.trim()
          );

          driveFileUrl = driveResult.webViewLink;
          directPreviewUrl = driveResult.previewUrl;
        }

        const newRecord: AssetRecord = {
          id: assetId,
          uploadedAt: timestamp,
          title: title.trim(),
          description: description.trim(),
          driveUrl: driveFileUrl,
          previewUrl: directPreviewUrl,
          spaces: selectedSpaces,
          styles: selectedStyles,
          materials: selectedMaterials,
          elements: selectedElements,
          customTags: customTags,
          paletteHex: paletteHex,
          uploader: uploaderEmail,
        };

        if (spreadsheet) {
          setUploadStep('syncing_sheet');
          setUploadProgressMsg(`Synchronizing asset metadata to Google Sheet "${spreadsheet.title}"...`);
          await appendAssetToSheet(token, spreadsheet.id, newRecord);
        }

        setUploadStep('completed');
        setLastUploadedAsset(newRecord);
        onAssetCreated(newRecord);
      } else {
        // Local preview mode if user has not yet connected Google Workspace
        setUploadProgressMsg('Recording asset locally (connect Google Workspace for persistent Drive & Sheets sync)...');
        
        const localRecord: AssetRecord = {
          id: assetId,
          uploadedAt: timestamp,
          title: title.trim(),
          description: description.trim(),
          driveUrl: previewUrl || 'https://drive.google.com',
          previewUrl: previewUrl || 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=80',
          spaces: selectedSpaces,
          styles: selectedStyles,
          materials: selectedMaterials,
          elements: selectedElements,
          customTags: customTags,
          paletteHex: paletteHex,
          uploader: uploaderEmail,
        };

        setUploadStep('completed');
        setLastUploadedAsset(localRecord);
        onAssetCreated(localRecord);
      }

      // Reset fields for subsequent uploads
      handleRemoveFile();
      setTitle('');
      setDescription('');
    } catch (err: unknown) {
      console.error('Upload flow error:', err);
      setUploadStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload and synchronization failed.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      
      {/* Workspace Authentication Notice if not connected */}
      {!token && (
        <div className="mb-8 p-5 bg-[#FAF7F2] border border-[#C86D51]/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-[#C86D51]/10 rounded-lg text-[#C86D51] mt-0.5">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-[#1E1B18]">
                Connect Google Workspace for Production Synchronization
              </h3>
              <p className="text-xs text-[#766E65] mt-0.5">
                Sign in to automatically store full-res imagery in <span className="font-mono text-[#1E1B18]">Studio Moodboard Assets</span> and append structured tags to <span className="font-mono text-[#1E1B18]">Interior Moodboard Asset Catalog</span>.
              </p>
            </div>
          </div>
          <button
            id="btn-upload-connect-google"
            type="button"
            onClick={onSignInRequest}
            className="whitespace-nowrap px-4 py-2 bg-[#1E1B18] hover:bg-[#332E2A] text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
          >
            Connect Workspace
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {uploadStep === 'completed' && lastUploadedAsset && (
        <div className="mb-8 p-5 bg-[#FFFFFF] border border-[#85937D] rounded-xl shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-[#85937D]/20 text-[#85937D] flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-serif text-base font-bold text-[#1E1B18]">
                  Asset Synchronized Successfully
                </h4>
                <p className="text-xs text-[#766E65] mt-1">
                  Assigned ID <span className="font-mono font-semibold text-[#1E1B18]">{lastUploadedAsset.id}</span>. Full-res file and structured specs are ready for design decks.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {driveFolder && (
                    <a
                      href={lastUploadedAsset.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-xs font-medium text-[#C86D51] hover:underline"
                    >
                      <FolderGit2 className="w-3.5 h-3.5" />
                      <span>View in Google Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {spreadsheet && (
                    <a
                      href={spreadsheet.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-xs font-medium text-[#85937D] hover:underline"
                    >
                      <Table2 className="w-3.5 h-3.5" />
                      <span>View Master Sheet Row</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setUploadStep('idle')}
              className="text-[#766E65] hover:text-[#1E1B18]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Form Container */}
      <form onSubmit={handleSubmit} className="bg-[#FFFFFF] border border-[#E8E1D5] rounded-2xl p-6 sm:p-8 shadow-xs">
        
        <div className="border-b border-[#E8E1D5] pb-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#C86D51] font-semibold">
                Studio Intake
              </span>
              <h2 className="font-serif text-2xl font-bold text-[#1E1B18] mt-1">
                Upload Moodboard Asset
              </h2>
              <p className="text-sm text-[#766E65] mt-1">
                Upload high-resolution photography, material textures, and finishes with multi-select architectural taxonomy.
              </p>
            </div>
            <div className="hidden sm:flex items-center space-x-2 bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#E8E1D5]">
              <Sparkles className="w-4 h-4 text-[#C86D51]" />
              <span className="text-xs font-medium text-[#1E1B18]">Android Schema Ready</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section 1: File Upload & Live Preview */}
        <div className="mb-8">
          <label className="block text-[10px] uppercase tracking-widest font-bold text-[#766E65] mb-2">
            Asset Imagery & Photography <span className="text-[#C86D51]">*</span>
          </label>

          {!previewUrl ? (
            <div
              id="dropzone-asset-file"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed border-[#C86D51]/30 bg-[#FAF7F2] rounded-xl p-8 text-center cursor-pointer hover:border-[#C86D51] hover:bg-[#FDF6F3] transition-colors ${
                isDragging ? 'border-[#C86D51] bg-[#FDF6F3]' : ''
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="w-10 h-10 bg-[#C86D51]/10 rounded-full flex items-center justify-center mx-auto mb-2 text-[#C86D51]">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-[#1E1B18]">
                Drop high-res imagery here, or <span className="text-[#C86D51] underline">browse files</span>
              </p>
              <p className="text-[10px] text-[#766E65] mt-1 font-mono">
                PNG, WEBP, JPG up to 50MB
              </p>
            </div>
          ) : (
            <div className="relative border border-[#E8E1D5] rounded-xl p-4 bg-[#FAF7F2] flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-48 h-36 shrink-0 rounded-lg overflow-hidden border border-[#E8E1D5] bg-black/5 shadow-2xs">
                <img
                  src={previewUrl}
                  alt="Asset Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              </div>

              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-[#1E1B18] truncate max-w-[200px]">
                    {selectedFile?.name || 'Asset Image'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1 rounded-md text-[#766E65] hover:text-red-600 hover:bg-white transition-colors"
                    title="Remove and replace image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="p-2 rounded bg-white border border-[#E8E1D5]">
                    <span className="text-[#766E65] block text-[10px] uppercase font-mono">File Size</span>
                    <span className="font-mono font-medium text-[#1E1B18]">
                      {selectedFile ? formatFileSize(selectedFile.size) : 'External'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E8E1D5]">
                    <span className="text-[#766E65] block text-[10px] uppercase font-mono">Resolution</span>
                    <span className="font-mono font-medium text-[#1E1B18]">
                      {fileDimensions ? `${fileDimensions.width} × ${fileDimensions.height} px` : 'Calculating...'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 text-xs text-[#C86D51] hover:underline font-semibold flex items-center space-x-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose a different photo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Asset Metadata & Description */}
        <div className="mb-8 grid grid-cols-1 gap-5">
          <div>
            <label htmlFor="input-asset-title" className="block text-[10px] uppercase tracking-widest font-bold text-[#766E65] mb-2">
              Asset Title & Subject <span className="text-[#C86D51]">*</span>
            </label>
            <input
              id="input-asset-title"
              type="text"
              required
              placeholder="e.g., Kyoto Minimalist Living Pavilion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E8E1D5] focus:border-[#C86D51] focus:ring-1 focus:ring-[#C86D51] outline-none text-base text-[#1E1B18] placeholder-[#766E65]/50 transition-all font-serif font-bold shadow-2xs"
            />
          </div>

          <div>
            <label htmlFor="input-asset-description" className="block text-[10px] uppercase tracking-widest font-bold text-[#766E65] mb-2">
              Architectural Description & Material Specs
            </label>
            <textarea
              id="input-asset-description"
              rows={3}
              placeholder="Detail spatial finishes, joinery details, stone veining, fabric tactile notes, lighting specs..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E8E1D5] focus:border-[#C86D51] focus:ring-1 focus:ring-[#C86D51] outline-none text-xs text-[#1E1B18] placeholder-[#766E65]/50 transition-all leading-relaxed shadow-2xs"
            />
          </div>
        </div>

        {/* Section 3: Dominant Color Swatch Picker from Design HTML */}
        <div className="mb-8 p-4 rounded-xl bg-white border border-[#E8E1D5] shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#766E65] flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>Dominant Palette</span>
            </label>
            <div className="flex items-center space-x-2">
              <span 
                className="w-4 h-4 rounded-full border border-stone-300 shadow-2xs" 
                style={{ backgroundColor: paletteHex }} 
              />
              <span className="font-mono text-xs font-semibold text-[#1E1B18]">{paletteHex}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-3">
            {PALETTE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                onClick={() => setPaletteHex(preset.hex)}
                className={`w-7 h-7 rounded-full border border-[#E8E1D5] shadow-inner transition-transform hover:scale-110 cursor-pointer ${
                  paletteHex.toLowerCase() === preset.hex.toLowerCase()
                    ? 'ring-2 ring-[#C86D51] scale-105'
                    : ''
                }`}
                style={{ backgroundColor: preset.hex }}
              />
            ))}
            
            {/* Custom Color Circle from Design HTML */}
            <label
              htmlFor="input-color-picker"
              title="Pick custom palette color"
              className="w-7 h-7 rounded-full border border-dashed border-[#C86D51] flex items-center justify-center text-[#C86D51] text-xs hover:bg-[#FDF6F3] cursor-pointer"
            >
              +
            </label>
            <input
              id="input-color-picker"
              type="color"
              value={paletteHex}
              onChange={(e) => setPaletteHex(e.target.value)}
              className="sr-only"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t border-[#E8E1D5]/60 text-xs text-[#766E65]">
            <span>Hex:</span>
            <input
              id="input-palette-hex"
              type="text"
              value={paletteHex}
              onChange={(e) => setPaletteHex(e.target.value)}
              className="w-24 px-2 py-0.5 rounded bg-[#FAF7F2] border border-[#E8E1D5] font-mono text-xs uppercase text-[#1E1B18]"
            />
          </div>
        </div>

        {/* Section 4: Multi-Select Structured Architectural Taxonomy */}
        <div className="mb-8 space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#766E65] flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>Structured Tag Taxonomy</span>
            </label>
            <span className="text-[10px] text-[#766E65]">Multi-select tags</span>
          </div>

          {/* Spaces */}
          <div>
            <span className="block text-[10px] font-bold text-[#766E65] mb-2 uppercase tracking-widest">
              Space & Architecture
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SPACES.map((space) => {
                const isSelected = selectedSpaces.includes(space);
                return (
                  <button
                    key={space}
                    type="button"
                    onClick={() => toggleTag(selectedSpaces, space, setSelectedSpaces)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#C86D51] text-white shadow-2xs'
                        : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#C86D51]'
                    }`}
                  >
                    {space}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Styles */}
          <div>
            <span className="block text-[10px] font-bold text-[#766E65] mb-2 uppercase tracking-widest">
              Aesthetic Typology
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((style) => {
                const isSelected = selectedStyles.includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleTag(selectedStyles, style, setSelectedStyles)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E1B18] text-white shadow-2xs'
                        : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#1E1B18]'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Materials */}
          <div>
            <span className="block text-[10px] font-bold text-[#766E65] mb-2 uppercase tracking-widest">
              Material & Finish
            </span>
            <div className="flex flex-wrap gap-1.5">
              {MATERIALS.map((material) => {
                const isSelected = selectedMaterials.includes(material);
                return (
                  <button
                    key={material}
                    type="button"
                    onClick={() => toggleTag(selectedMaterials, material, setSelectedMaterials)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#85937D] text-white shadow-2xs'
                        : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#85937D]'
                    }`}
                  >
                    {material}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Elements */}
          <div>
            <span className="block text-[10px] font-bold text-[#766E65] mb-2 uppercase tracking-widest">
              Elements & Details
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ELEMENTS.map((element) => {
                const isSelected = selectedElements.includes(element);
                return (
                  <button
                    key={element}
                    type="button"
                    onClick={() => toggleTag(selectedElements, element, setSelectedElements)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#766E65] text-white shadow-2xs'
                        : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#766E65]'
                    }`}
                  >
                    {element}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Studio Tags */}
          <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E8E1D5]">
            <span className="block text-[10px] font-bold text-[#766E65] mb-1 uppercase tracking-widest flex items-center space-x-1.5">
              <Tag className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>Custom Studio Tags</span>
            </span>
            <p className="text-[10px] text-[#766E65] mb-2">
              Add client IDs, villa codes, or budget tiers (e.g. #Budget-Tier-1, #Villa-Como)
            </p>
            
            <div className="flex flex-wrap gap-1.5 mb-2">
              {customTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-white border border-[#E8E1D5] text-[10px] font-mono text-[#1E1B18]"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeCustomTag(tag)}
                    className="text-[#766E65] hover:text-red-600 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="input-custom-tag"
                type="text"
                placeholder="Type tag and hit Enter (e.g. #Villa-Como)..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={handleCustomTagKeyDown}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-[#E8E1D5] text-xs outline-none focus:border-[#C86D51]"
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#E8E1D5] text-xs font-medium text-[#1E1B18] hover:bg-[#FDF6F3]"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Upload Progress Status Indicator */}
        {uploadStep !== 'idle' && uploadStep !== 'completed' && (
          <div className="mb-6 p-4 rounded-xl bg-[#FAF7F2] border border-[#C86D51]/30 flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-[#C86D51] animate-spin shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-[#1E1B18]">{uploadProgressMsg}</p>
              <div className="w-full bg-[#E8E1D5] h-1.5 rounded-full overflow-hidden mt-1.5">
                <div 
                  className="bg-[#C86D51] h-full transition-all duration-300 rounded-full"
                  style={{
                    width: uploadStep === 'preparing' ? '25%' :
                           uploadStep === 'uploading_drive' ? '60%' :
                           uploadStep === 'syncing_sheet' ? '90%' : '100%'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Form Submission Action Buttons matching Artistic Flair Design HTML */}
        <div className="pt-6 border-t border-[#E8E1D5]">
          <div className="flex items-center justify-between text-[10px] text-[#766E65] mb-4">
            <span>Drive: Studio Moodboard Assets</span>
            <span>Sheet: Interior Moodboard Asset Catalog</span>
          </div>

          <button
            id="btn-submit-asset-upload"
            type="submit"
            disabled={uploadStep !== 'idle' && uploadStep !== 'completed' && uploadStep !== 'error'}
            className="w-full py-4 bg-[#C86D51] text-white font-bold rounded-xl shadow-lg shadow-[#C86D51]/20 hover:bg-[#A85238] transition-all uppercase tracking-widest text-xs flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {uploadStep !== 'idle' && uploadStep !== 'completed' && uploadStep !== 'error' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synchronizing Spec to Catalog...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Submit Asset Specification</span>
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};
