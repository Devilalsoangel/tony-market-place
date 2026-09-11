import { getAdminUrl } from './adminSync';
import { serverApi } from './serverApi';

/**
 * Media upload pipeline (industry standard: upload FIRST, reference the
 * hosted URL everywhere).
 *
 * Fixes the carry-over bug where create-post/create-story persisted the
 * local file:// or content:// URI as the image — unviewable on every other
 * device and rejected by the hardened backend. Local media now goes through
 * /api/app/upload (auth + MIME allow-list + 5MB cap) and only the returned
 * /uploads/... URL is stored.
 */

const UPLOAD_MAX_DIM = 1280;
const UPLOAD_QUALITY = 0.75;

/** True when the URL is already hosted (http/https) — safe to persist. */
export function isHostedImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Read a local file/content URI and encode it as a base64 data URL. */
export async function uriToDataUrl(uri: string, mime = 'image/jpeg'): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscale a local image via expo-image-picker's ImageManipulator so uploads
 * stay under the server's 5MB cap. Falls back to a straight data-URL encode.
 */
export async function shrinkForUpload(
  uri: string,
  maxDim = UPLOAD_MAX_DIM,
  quality = UPLOAD_QUALITY
): Promise<string> {
  try {
    const ImagePicker = require('expo-image-picker');
    const manip = ImagePicker?.ImageManipulator;
    if (manip?.manipulateAsync) {
      const out = await manip.manipulateAsync(
        uri,
        [{ resize: { width: maxDim } }],
        { compress: quality, format: manip.SaveFormat.JPEG, base64: true }
      );
      if (out?.base64) return `data:image/jpeg;base64,${out.base64}`;
      if (out?.uri) return uriToDataUrl(out.uri);
    }
  } catch {
    // fall through to plain encode
  }
  return uriToDataUrl(uri);
}

/** Resolve a stored image reference to an absolute URL for <Image source>. */
export function resolveImageUrl(url: string, base: string): string {
  return url.startsWith('http') ? url : `${base.replace(/\/$/, '')}${url}`;
}

/**
 * Upload one local image to the admin panel and return the ABSOLUTE hosted
 * URL (uploadBannerImage returns a root-relative /uploads/... path).
 * Throws on failure — callers decide the UX (block post, or offline fallback).
 */
export async function uploadToServer(localUri: string): Promise<string> {
  const dataUrl = await shrinkForUpload(localUri.trim());
  const res = await serverApi.uploadBannerImage(dataUrl);
  if (!res.ok || !res.data?.url) throw new Error(res.error || 'Upload failed');
  const base = await getAdminUrl();
  return resolveImageUrl(res.data.url, base);
}

/**
 * Upload every local URI in a media list; already-hosted URLs pass through
 * unchanged. Items that fail are skipped (best-effort) so one bad image
 * never blocks the whole post — but an empty result signals total failure.
 */
export async function uploadAllToServer(uris: (string | number)[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of uris) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const u = raw.trim();
    if (isHostedImageUrl(u)) {
      out.push(u);
      continue;
    }
    try {
      out.push(await uploadToServer(u));
    } catch {
      // skip failed item
    }
  }
  return out;
}
