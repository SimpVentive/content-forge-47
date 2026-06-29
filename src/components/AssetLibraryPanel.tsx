import React, { useState, useEffect } from 'react';
import { Upload, X, Edit2, Trash2, Eye, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  validateAssetFile,
  uploadAssetFile,
  createAssetRecord,
  getUserAssets,
  updateAssetMetadata,
  deleteAsset,
  getSignedAssetUrl,
  getAssetUsageStats,
} from '@/lib/assetStorage';
import type { Database } from '@/integrations/supabase/types';

type UserAsset = Database['public']['Tables']['user_assets']['Row'];

const SUGGESTED_TAGS = [
  'reactor', 'equipment', 'distillation', 'valve',
  'control-panel', 'safety', 'procedure', 'industrial',
  'instrument', 'vessel', 'pipe', 'pump', 'compressor',
  'gauge', 'control-room', 'lab', 'facility'
];

interface AssetLibraryPanelProps {
  userId: string;
}

export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({ userId }) => {
  const [assets, setAssets] = useState<UserAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingAsset, setEditingAsset] = useState<UserAsset | null>(null);
  const [previewAsset, setPreviewAsset] = useState<UserAsset | null>(null);
  const [usageStats, setUsageStats] = useState<Record<string, { totalUses: number; coursesUsedIn: number }>>({});

  // Fetch assets on mount
  useEffect(() => {
    loadAssets();
  }, [userId]);

  const loadAssets = async () => {
    setLoading(true);
    const assets = await getUserAssets(userId);
    setAssets(assets);

    // Load usage stats for each asset
    const stats: typeof usageStats = {};
    for (const asset of assets) {
      const stat = await getAssetUsageStats(userId, asset.id);
      if (stat) {
        stats[asset.id] = stat;
      }
    }
    setUsageStats(stats);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAssetFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid file');
      return;
    }

    setUploading(true);
    try {
      const upload = await uploadAssetFile(userId, file);
      if (!upload) {
        toast.error('Failed to upload file');
        return;
      }

      // Create asset record
      const assetId = crypto.randomUUID();
      const newAsset = await createAssetRecord(userId, assetId, {
        filename: file.name,
        originalFilename: file.name,
        storageUrl: upload.uploadPath,
        storagePath: upload.uploadPath,
        fileSizeBytes: file.size,
        mimeType: file.type,
        width: 0,
        height: 0,
        tags: [],
        description: '',
      });

      if (newAsset) {
        setAssets([newAsset, ...assets]);
        setEditingAsset(newAsset);
        toast.success('Asset uploaded! Add tags and description.');
      }
    } catch (error) {
      toast.error('Upload failed');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveAsset = async () => {
    if (!editingAsset) return;

    if (editingAsset.tags.length === 0) {
      toast.error('Please add at least one tag');
      return;
    }

    const updated = await updateAssetMetadata(editingAsset.id, userId, {
      tags: editingAsset.tags,
      description: editingAsset.description || '',
      filename: editingAsset.filename,
    });

    if (updated) {
      setAssets(assets.map((a) => (a.id === updated.id ? updated : a)));
      setEditingAsset(null);
      toast.success('Asset updated!');
    } else {
      toast.error('Failed to update asset');
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Delete this asset?')) return;

    const success = await deleteAsset(assetId, userId);
    if (success) {
      setAssets(assets.filter((a) => a.id !== assetId));
      toast.success('Asset deleted');
    } else {
      toast.error('Failed to delete asset');
    }
  };

  const handleAddTag = (tag: string) => {
    if (editingAsset && !editingAsset.tags.includes(tag)) {
      setEditingAsset({
        ...editingAsset,
        tags: [...editingAsset.tags, tag],
      });
    }
  };

  const handleRemoveTag = (tag: string) => {
    if (editingAsset) {
      setEditingAsset({
        ...editingAsset,
        tags: editingAsset.tags.filter((t) => t !== tag),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:border-teal-400 hover:bg-teal-50 transition-all">
        <label className="cursor-pointer block">
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
              <span className="text-sm font-medium text-slate-600">Uploading...</span>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="font-semibold text-slate-900">Drag & drop your image</p>
              <p className="text-xs text-slate-500 mt-1">or click to select (JPG, PNG, WebP • Max 10MB)</p>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </>
          )}
        </label>
      </div>

      {/* Assets List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-600 mb-3">No assets yet. Upload your first image!</p>
          <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            To include your own or your organization's images in the content you create, upload them here. Be sure to add the appropriate tags so the system can recognize and organize your assets correctly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-all">
              {/* Thumbnail */}
              <div className="h-40 bg-slate-100 relative group">
                {asset.width && asset.height ? (
                  <img
                    src={asset.storage_url}
                    alt={asset.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-slate-300" />
                  </div>
                )}

                {/* Overlay buttons */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setPreviewAsset(asset)}
                    title="Preview"
                    className="p-2 bg-white rounded-lg hover:bg-slate-100"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => setEditingAsset(asset)}
                    title="Edit"
                    className="p-2 bg-white rounded-lg hover:bg-slate-100"
                  >
                    <Edit2 className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    title="Delete"
                    className="p-2 bg-white rounded-lg hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <p className="text-sm font-medium text-slate-900 truncate">{asset.filename}</p>

                {/* Tags */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {asset.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                  {asset.tags.length > 2 && (
                    <span className="text-xs text-slate-500">+{asset.tags.length - 2}</span>
                  )}
                </div>

                {/* Usage stats */}
                {usageStats[asset.id] && (
                  <p className="text-xs text-slate-500 mt-2">
                    Used in {usageStats[asset.id].coursesUsedIn} course{usageStats[asset.id].coursesUsedIn !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900">Edit Asset</h3>
              <button onClick={() => setEditingAsset(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Filename */}
              <div>
                <label className="text-sm font-medium text-slate-900">Filename</label>
                <input
                  type="text"
                  value={editingAsset.filename}
                  onChange={(e) => setEditingAsset({ ...editingAsset, filename: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-slate-900">Description</label>
                <textarea
                  value={editingAsset.description || ''}
                  onChange={(e) => setEditingAsset({ ...editingAsset, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 resize-none"
                  rows={3}
                  placeholder="What is this asset used for?"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium text-slate-900">Tags</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {editingAsset.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>

                {editingAsset.tags.length === 0 && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    At least one tag required
                  </p>
                )}

                {/* Suggested tags */}
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-500">Suggested tags:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_TAGS.filter((tag) => !editingAsset.tags.includes(tag)).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleAddTag(tag)}
                        className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setEditingAsset(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsset}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                >
                  Save Asset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{previewAsset.filename}</h3>
              <button onClick={() => setPreviewAsset(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <img src={previewAsset.storage_url} alt={previewAsset.filename} className="w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
