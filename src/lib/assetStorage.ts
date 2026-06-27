/**
 * Asset Storage & Management
 * Handles uploading, retrieving, and managing user assets (Objects)
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/integrations/supabase/types';

type UserAsset = Database['public']['Tables']['user_assets']['Row'];

const STORAGE_BUCKET = 'user-assets';
const UPLOAD_PATH = 'uploads';
const ASSET_PATH = 'assets';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate file before upload
 */
export function validateAssetFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  if (!ALLOWED_FORMATS.includes(file.type)) {
    return { valid: false, error: 'Only JPG, PNG, and WebP formats are supported' };
  }

  return { valid: true };
}

/**
 * Upload asset file to Supabase Storage (temporary location)
 * Will be processed by Edge Function
 */
export async function uploadAssetFile(
  userId: string,
  file: File
): Promise<{ uploadPath: string; tempId: string } | null> {
  try {
    const tempId = crypto.randomUUID();
    const uploadPath = `${UPLOAD_PATH}/${userId}/${tempId}/${file.name}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(uploadPath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    return { uploadPath, tempId };
  } catch (error) {
    console.error('Asset upload failed:', error);
    return null;
  }
}

/**
 * Create asset record in database
 */
export async function createAssetRecord(
  userId: string,
  assetId: string,
  data: {
    filename: string;
    originalFilename: string;
    storageUrl: string;
    storagePath: string;
    fileSizeBytes: number;
    mimeType: string;
    width: number;
    height: number;
    tags: string[];
    description: string;
  }
): Promise<UserAsset | null> {
  try {
    const { data: asset, error } = await supabase
      .from('user_assets')
      .insert([
        {
          id: assetId,
          user_id: userId,
          filename: data.filename,
          original_filename: data.originalFilename,
          storage_url: data.storageUrl,
          storage_path: data.storagePath,
          file_size_bytes: data.fileSizeBytes,
          mime_type: data.mimeType,
          width: data.width,
          height: data.height,
          tags: data.tags,
          description: data.description,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Asset record creation error:', error);
      return null;
    }

    return asset;
  } catch (error) {
    console.error('Failed to create asset record:', error);
    return null;
  }
}

/**
 * Get all assets for a user
 */
export async function getUserAssets(userId: string): Promise<UserAsset[]> {
  try {
    const { data, error } = await supabase
      .from('user_assets')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get assets error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get assets:', error);
    return [];
  }
}

/**
 * Get single asset by ID
 */
export async function getAsset(assetId: string, userId: string): Promise<UserAsset | null> {
  try {
    const { data, error } = await supabase
      .from('user_assets')
      .select('*')
      .eq('id', assetId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Get asset error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to get asset:', error);
    return null;
  }
}

/**
 * Update asset metadata (tags, description)
 */
export async function updateAssetMetadata(
  assetId: string,
  userId: string,
  updates: {
    tags?: string[];
    description?: string;
    filename?: string;
  }
): Promise<UserAsset | null> {
  try {
    const { data, error } = await supabase
      .from('user_assets')
      .update({
        ...(updates.tags && { tags: updates.tags }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.filename && { filename: updates.filename }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Update asset error:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to update asset:', error);
    return null;
  }
}

/**
 * Delete asset (soft delete)
 */
export async function deleteAsset(assetId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', assetId)
      .eq('user_id', userId);

    if (error) {
      console.error('Delete asset error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to delete asset:', error);
    return false;
  }
}

/**
 * Get signed URL for asset preview (1-hour TTL)
 */
export async function getSignedAssetUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Failed to get signed URL:', error);
    return null;
  }
}

/**
 * Get public URL for asset in final course
 */
export function getPublicAssetUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

/**
 * Fetch asset image as data URL
 */
export async function fetchAssetImage(storageUrl: string): Promise<{
  dataUrl: string;
  mimeType: string;
} | null> {
  try {
    const response = await fetch(storageUrl);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        resolve({
          dataUrl: reader.result as string,
          mimeType,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to fetch asset image:', error);
    return null;
  }
}

/**
 * Save asset selection preference
 */
export async function saveAssetSelectionPreference(
  userId: string,
  courseId: string,
  selectedAssetIds: string[],
  courseType: string,
  topicKeywords: string[],
  contentHash: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('asset_selection_preferences')
      .insert([
        {
          user_id: userId,
          course_id: courseId,
          selected_asset_ids: selectedAssetIds,
          course_type: courseType,
          topic_keywords: topicKeywords,
          content_hash: contentHash,
        },
      ]);

    if (error) {
      console.error('Save preference error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to save preference:', error);
    return false;
  }
}

/**
 * Get similar asset preferences for context-aware suggestions
 */
export async function getSimilarAssetPreferences(
  userId: string,
  courseType: string
): Promise<{
  selectedAssetIds: string[];
  courseType: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('asset_selection_preferences')
      .select('selected_asset_ids, course_type')
      .eq('user_id', userId)
      .eq('course_type', courseType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No previous preference found - that's okay
      return null;
    }

    return {
      selectedAssetIds: data.selected_asset_ids || [],
      courseType: data.course_type,
    };
  } catch (error) {
    console.error('Failed to get preferences:', error);
    return null;
  }
}

/**
 * Log asset usage for analytics
 */
export async function logAssetUsage(
  userId: string,
  assetId: string,
  courseId: string,
  slideNumber: number,
  slideTitle: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('asset_usage_log')
      .insert([
        {
          user_id: userId,
          asset_id: assetId,
          course_id: courseId,
          slide_number: slideNumber,
          slide_title: slideTitle,
        },
      ]);

    if (error) {
      console.error('Log usage error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to log asset usage:', error);
    return false;
  }
}

/**
 * Get asset usage stats
 */
export async function getAssetUsageStats(
  userId: string,
  assetId: string
): Promise<{ totalUses: number; coursesUsedIn: number } | null> {
  try {
    const { data, error } = await supabase
      .from('asset_usage_log')
      .select('id, course_id')
      .eq('user_id', userId)
      .eq('asset_id', assetId);

    if (error) {
      console.error('Get usage stats error:', error);
      return null;
    }

    const uniqueCourses = new Set((data || []).map((log) => log.course_id));

    return {
      totalUses: data?.length || 0,
      coursesUsedIn: uniqueCourses.size,
    };
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    return null;
  }
}
