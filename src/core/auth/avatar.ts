import type { SupabaseClient } from '@supabase/supabase-js';

export function getAvatarStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;

  const publicUrlMarker = '/storage/v1/object/public/avatars/';
  const signedUrlMarker = '/storage/v1/object/sign/avatars/';
  const marker = value.includes(publicUrlMarker)
    ? publicUrlMarker
    : value.includes(signedUrlMarker)
      ? signedUrlMarker
      : null;
  const rawPath = marker ? value.slice(value.indexOf(marker) + marker.length).split('?')[0] : value;

  if (!rawPath || rawPath.startsWith('/') || rawPath.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  try {
    return rawPath.split('/').map((segment) => decodeURIComponent(segment)).join('/');
  } catch {
    return null;
  }
}

export async function createAvatarSignedUrl(
  supabase: SupabaseClient,
  value: string | null | undefined
): Promise<string | null> {
  const path = getAvatarStoragePath(value);
  if (!path) return null;

  let result: Awaited<ReturnType<typeof supabase.storage.from>['createSignedUrl']>;
  try {
    result = await supabase.storage
      .from('avatars')
      .createSignedUrl(path, 60 * 60);
  } catch (error) {
    console.error('Failed to create avatar signed URL:', error);
    return null;
  }

  if (result.error) {
    console.error('Failed to create avatar signed URL:', result.error.message);
    return null;
  }

  return result.data.signedUrl;
}
