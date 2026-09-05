/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  RefreshCw, 
  FolderGit2, 
  Calendar, 
  User, 
  Tag, 
  Copy, 
  Check, 
  Eye, 
  Layers,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { AssetRecord, SPACES, MATERIALS, STYLES } from '../types';

interface CatalogBrowserProps {
  assets: AssetRecord[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectAsset: (asset: AssetRecord) => void;
  onNavigateToUpload: () => void;
}

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({
  assets,
  isLoading,
  onRefresh,
  onSelectAsset,
  onNavigateToUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpaceFilter, setActiveSpaceFilter] = useState<string>('All');
  const [activeMaterialFilter, setActiveMaterialFilter] = useState<string>('All');
  const [activeStyleFilter, setActiveStyleFilter] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Client-side search across Title, Description, Space, Style, Material, and Custom Tags
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Space filter
      if (activeSpaceFilter !== 'All' && !asset.spaces.includes(activeSpaceFilter)) {
        return false;
      }
      // Material filter
      if (activeMaterialFilter !== 'All' && !asset.materials.includes(activeMaterialFilter)) {
        return false;
      }
      // Style filter
      if (activeStyleFilter !== 'All' && !asset.styles.includes(activeStyleFilter)) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();

      const inTitle = asset.title.toLowerCase().includes(q);
      const inDesc = asset.description.toLowerCase().includes(q);
      const inId = asset.id.toLowerCase().includes(q);
      const inSpaces = asset.spaces.some((s) => s.toLowerCase().includes(q));
      const inStyles = asset.styles.some((s) => s.toLowerCase().includes(q));
      const inMaterials = asset.materials.some((m) => m.toLowerCase().includes(q));
      const inCustom = asset.customTags.some((c) => c.toLowerCase().includes(q));
      const inUploader = asset.uploader.toLowerCase().includes(q);

      return inTitle || inDesc || inId || inSpaces || inStyles || inMaterials || inCustom || inUploader;
    });
  }, [assets, searchQuery, activeSpaceFilter, activeMaterialFilter, activeStyleFilter]);

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearFilters = () => {
    setActiveSpaceFilter('All');
    setActiveMaterialFilter('All');
    setActiveStyleFilter('All');
    setSearchQuery('');
  };

  const hasActiveFilters = 
    activeSpaceFilter !== 'All' || 
    activeMaterialFilter !== 'All' || 
    activeStyleFilter !== 'All' || 
    searchQuery.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      
      {/* Editorial Catalog Header from Design HTML */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-[#E8E1D5] gap-4">
        <div>
          <h2 className="font-serif text-3xl text-[#1E1B18] tracking-tight">
            Asset Catalog{' '}
            <span className="text-sm font-sans italic text-[#766E65] ml-2 font-normal">
              {filteredAssets.length} records synced
            </span>
          </h2>
          <p className="text-xs text-[#766E65] mt-1">
            High-resolution moodboard imagery with spatial taxonomy and Google Sheets synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar matching Design HTML */}
          <div className="relative">
            <input
              id="input-catalog-search"
              type="text"
              placeholder="Search styles, materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-[#E8E1D5] px-4 py-2 pr-8 rounded-full text-xs w-64 focus:outline-none focus:border-[#C86D51] transition-all shadow-2xs placeholder:text-[#766E65]/60"
            />
            <div className="absolute right-3 top-2.5 text-[#766E65] pointer-events-none">
              <Search className="w-3.5 h-3.5" />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-7 top-2 text-[10px] text-[#766E65] hover:text-[#1E1B18]"
              >
                ×
              </button>
            )}
          </div>

          {/* Sync Sheets Button */}
          <button
            id="btn-refresh-catalog"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-white border border-[#E8E1D5] hover:bg-[#FAF7F2] text-xs font-semibold text-[#1E1B18] shadow-2xs transition-colors"
            title="Refresh assets from Google Sheet catalog"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#766E65] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Upload New Asset Button */}
          <button
            id="btn-catalog-new-asset"
            onClick={onNavigateToUpload}
            className="flex items-center space-x-1.5 px-4 py-2 border border-[#C86D51] bg-[#C86D51] text-white text-xs font-bold rounded-full hover:bg-[#A85238] transition-all uppercase tracking-tighter shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upload New</span>
          </button>
        </div>
      </div>

      {/* Filter Chip Groups Styled with Artistic Flair */}
      <div className="space-y-3 mb-6 bg-white border border-[#E8E1D5] p-4 rounded-xl shadow-2xs">
        
        {/* Spatial Architecture Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[#766E65] shrink-0 w-36">
            Space & Architecture:
          </label>
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              onClick={() => setActiveSpaceFilter('All')}
              className={`px-2.5 py-1 text-[10px] rounded font-medium transition-all ${
                activeSpaceFilter === 'All'
                  ? 'bg-[#C86D51] text-white shadow-2xs'
                  : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#C86D51]'
              }`}
            >
              All Spaces
            </button>
            {SPACES.slice(0, 7).map((space) => (
              <button
                key={space}
                onClick={() => setActiveSpaceFilter(activeSpaceFilter === space ? 'All' : space)}
                className={`px-2.5 py-1 text-[10px] rounded font-medium transition-all ${
                  activeSpaceFilter === space
                    ? 'bg-[#C86D51] text-white shadow-2xs'
                    : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#C86D51]'
                }`}
              >
                {space}
              </button>
            ))}
          </div>
        </div>

        {/* Material & Finish Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[#766E65] shrink-0 w-36">
            Material & Finish:
          </label>
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              onClick={() => setActiveMaterialFilter('All')}
              className={`px-2.5 py-1 text-[10px] rounded font-medium transition-all ${
                activeMaterialFilter === 'All'
                  ? 'bg-[#85937D] text-white shadow-2xs'
                  : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#85937D]'
              }`}
            >
              All Materials
            </button>
            {MATERIALS.slice(0, 7).map((material) => (
              <button
                key={material}
                onClick={() => setActiveMaterialFilter(activeMaterialFilter === material ? 'All' : material)}
                className={`px-2.5 py-1 text-[10px] rounded font-medium transition-all ${
                  activeMaterialFilter === material
                    ? 'bg-[#85937D] text-white shadow-2xs'
                    : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#85937D]'
                }`}
              >
                {material}
              </button>
            ))}
          </div>
        </div>

        {/* Aesthetic Style Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-[#766E65] shrink-0 w-36">
            Aesthetic Typology:
          </label>
          <div className="flex flex-wrap gap-1.5 items-center">
            <button
              onClick={() => setActiveStyleFilter('All')}
              className={`px-2.5 py-1 text-[10px] rounded font-medium transition-all ${
                activeStyleFilter === 'All'
                  ? 'bg-[#1E1B18] text-white shadow-2xs'
                  : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#1E1B18]'
              }`}
            >
              All Styles
            </button>
            {STYLES.slice(0, 7).map((style) => (
              <button
                key={style}
                onClick={() => setActiveStyleFilter(activeStyleFilter === style ? 'All' : style)}
                className={`px-2.5 py-1 text-[10px] rounded font-medium transition-all ${
                  activeStyleFilter === style
                    ? 'bg-[#1E1B18] text-white shadow-2xs'
                    : 'bg-[#FDF6F3] border border-[#E8E1D5] text-[#1E1B18] hover:border-[#1E1B18]'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Results Bar */}
        <div className="flex items-center justify-between text-xs text-[#766E65] pt-2 border-t border-[#E8E1D5]/60">
          <span className="text-[11px]">
            Showing <strong className="font-mono text-[#1E1B18]">{filteredAssets.length}</strong> of{' '}
            <strong className="font-mono text-[#1E1B18]">{assets.length}</strong> items
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[#C86D51] text-[11px] font-bold underline hover:text-[#A85238]"
            >
              Reset active filters
            </button>
          )}
        </div>

      </div>

      {/* Empty State */}
      {filteredAssets.length === 0 && (
        <div className="bg-white border border-[#E8E1D5] rounded-2xl p-12 text-center max-w-xl mx-auto my-8">
          <Layers className="w-10 h-10 text-[#766E65]/40 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-[#1E1B18]">
            No Matching Assets Found
          </h3>
          <p className="text-xs text-[#766E65] mt-1 max-w-sm mx-auto">
            Try resetting your taxonomy filters or clearing your search term.
          </p>
          <div className="mt-6 flex items-center justify-center space-x-3">
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-full bg-[#FAF7F2] border border-[#E8E1D5] text-xs font-semibold text-[#1E1B18] hover:bg-white"
            >
              Clear Filters
            </button>
            <button
              onClick={onNavigateToUpload}
              className="px-4 py-2 rounded-full bg-[#C86D51] text-white text-xs font-bold hover:bg-[#A85238] uppercase tracking-tighter"
            >
              Upload Asset
            </button>
          </div>
        </div>
      )}

      {/* Asset Grid matching Artistic Flair Design HTML: 3 columns with rounded-2xl & clean borders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssets.map((asset) => {
          const isCopied = copiedId === asset.id;
          const primaryStyle = asset.styles[0] || 'Design Asset';

          return (
            <div
              key={asset.id}
              onClick={() => onSelectAsset(asset)}
              className="bg-white border border-[#E8E1D5] rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all group flex flex-col cursor-pointer"
            >
              {/* Card Image Container: h-48 with blur pill */}
              <div className="h-48 bg-stone-200 relative overflow-hidden">
                {/* Top-left artistic style pill */}
                <div className="absolute top-3 left-3 flex gap-1 z-10">
                  <span className="px-2 py-0.5 bg-black/40 backdrop-blur-md text-white text-[8px] uppercase tracking-widest rounded font-medium">
                    {primaryStyle}
                  </span>
                </div>

                {/* Top-right copy ID badge */}
                <div className="absolute top-3 right-3 z-10">
                  <button
                    onClick={(e) => handleCopyId(e, asset.id)}
                    title="Click to copy Asset ID"
                    className="px-2 py-0.5 rounded bg-black/40 backdrop-blur-md hover:bg-black/60 text-white text-[9px] font-mono flex items-center space-x-1 transition-colors"
                  >
                    <span>{asset.id}</span>
                    {isCopied ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    )}
                  </button>
                </div>

                <img
                  src={asset.previewUrl || asset.driveUrl}
                  alt={asset.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-104 opacity-90 group-hover:opacity-100"
                />
              </div>

              {/* Card Body matching Design HTML */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-bold text-sm truncate text-[#1E1B18] group-hover:text-[#C86D51] transition-colors">
                      {asset.title}
                    </h3>
                    <span className="text-[9px] font-mono text-[#766E65] bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E8E1D5] shrink-0">
                      {asset.id}
                    </span>
                  </div>

                  <p className="text-[10px] text-[#766E65] line-clamp-2 leading-relaxed mb-3">
                    {asset.description || 'Sustainably sourced architectural specification with custom finishes.'}
                  </p>

                  <div className="flex flex-wrap gap-1 items-center">
                    {asset.spaces.slice(0, 2).map((sp) => (
                      <span
                        key={sp}
                        className="text-[8px] px-1.5 py-0.5 border border-[#E8E1D5] text-[#766E65] rounded-full"
                      >
                        {sp}
                      </span>
                    ))}
                    {asset.materials.slice(0, 2).map((mat) => (
                      <span
                        key={mat}
                        className="text-[8px] px-1.5 py-0.5 border border-[#E8E1D5] text-[#766E65] rounded-full"
                      >
                        {mat}
                      </span>
                    ))}
                    {asset.customTags.slice(0, 1).map((tag) => (
                      <span
                        key={tag}
                        className="text-[8px] px-1.5 py-0.5 bg-[#FDF6F3] border border-[#C86D51]/20 text-[#C86D51] rounded-full font-mono"
                      >
                        {tag}
                      </span>
                    ))}

                    {/* Dominant Palette Swatch Circle */}
                    <div
                      title={`Palette: ${asset.paletteHex}`}
                      className="w-3.5 h-3.5 rounded-full self-center ml-auto border border-stone-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: asset.paletteHex }}
                    />
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="pt-3 mt-3 border-t border-[#E8E1D5] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1 text-[#766E65]">
                    <User className="w-3 h-3 text-[#C86D51]" />
                    <span className="text-[10px] font-mono">{asset.uploader.split('@')[0]}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {asset.driveUrl && (
                      <a
                        href={asset.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open file in Google Drive"
                        className="p-1 rounded text-[#766E65] hover:text-[#C86D51] hover:bg-[#FAF7F2] transition-colors"
                      >
                        <FolderGit2 className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAsset(asset);
                      }}
                      className="flex items-center space-x-1 text-[10px] font-bold text-[#C86D51] hover:underline uppercase tracking-wider"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
