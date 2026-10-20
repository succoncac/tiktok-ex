import JSZip from 'jszip';

/**
 * Ensures relative URLs are converted to valid absolute URLs
 */
export function ensureAbsoluteUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('//')) return 'https:' + trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('/api/')) {
    return 'https://www.tikwm.com' + trimmed;
  }
  return trimmed;
}

/**
 * Validates whether a response blob is real media or an HTML/error response
 */
async function isValidMediaBlob(blob: Blob): Promise<boolean> {
  if (!blob || blob.size === 0) return false;
  if (blob.type.includes('text/html') || blob.type.includes('application/json')) {
    return false;
  }
  // If small payload, inspect first 100 bytes for HTML doctype/tags
  if (blob.size < 4000) {
    try {
      const text = await blob.slice(0, 200).text();
      const lower = text.toLowerCase().trim();
      if (
        lower.startsWith('<!doctype') ||
        lower.startsWith('<html') ||
        lower.includes('<body') ||
        lower.startsWith('{"error"') ||
        lower.startsWith('{"success":false')
      ) {
        return false;
      }
    } catch {
      // ignore
    }
  }
  return true;
}

/**
 * Triggers browser file save from a verified media Blob
 */
function saveBlob(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
}

/**
 * Multi-layer resilient downloader:
 * Layer 1: Proxy streaming via /api/download (with strict binary verification)
 * Layer 2: Client-side device direct fetch (bypasses server geographic blocks)
 * Layer 3: Clean stream download anchor / window
 */
export async function downloadMedia(rawUrl: string, filename: string): Promise<void> {
  if (!rawUrl) return;
  const url = ensureAbsoluteUrl(rawUrl);

  // Layer 1: Fetch through proxy with blob validation (NEVER download raw HTML)
  try {
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const blob = await res.blob();
      const valid = await isValidMediaBlob(blob);
      if (valid) {
        saveBlob(blob, filename);
        return;
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy download attempt failed, falling back to direct client fetch...', proxyErr);
  }

  // Layer 2: Client-side direct fetch on the user's device (bypasses proxy IP/geo blocks)
  try {
    const directRes = await fetch(url, { mode: 'cors' });
    if (directRes.ok) {
      const blob = await directRes.blob();
      const valid = await isValidMediaBlob(blob);
      if (valid) {
        saveBlob(blob, filename);
        return;
      }
    }
  } catch (directErr) {
    console.warn('Direct device fetch blocked by CORS, falling back to clean stream window...', directErr);
  }

  // Layer 3: Fallback - Open direct media stream URL in new window/tab
  // User can right-click / hold and select "Save video as..." or "Save image as..."
  const win = window.open(url, '_blank');
  if (!win) {
    // If popup blocked, create anchor trigger
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Download an array of image URLs as a bundled .zip file with real image verification
 */
export async function downloadImagesAsZip(
  imageUrls: string[],
  zipFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('tiktok_photos') || zip;
  let addedCount = 0;

  for (let i = 0; i < imageUrls.length; i++) {
    const rawImgUrl = imageUrls[i];
    const imgUrl = ensureAbsoluteUrl(rawImgUrl);
    let added = false;

    // Try proxy first
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(imgUrl)}&filename=image_${i + 1}.jpg`);
      if (res.ok) {
        const blob = await res.blob();
        if (await isValidMediaBlob(blob)) {
          folder.file(`photo_${String(i + 1).padStart(2, '0')}.jpg`, blob);
          added = true;
          addedCount++;
        }
      }
    } catch {
      // ignore
    }

    // Try direct fetch if proxy failed
    if (!added) {
      try {
        const directRes = await fetch(imgUrl, { mode: 'cors' });
        if (directRes.ok) {
          const blob = await directRes.blob();
          if (await isValidMediaBlob(blob)) {
            folder.file(`photo_${String(i + 1).padStart(2, '0')}.jpg`, blob);
            addedCount++;
          }
        }
      } catch {
        // ignore
      }
    }

    if (onProgress) {
      onProgress(i + 1, imageUrls.length);
    }
  }

  if (addedCount === 0) {
    throw new Error('Không thể tải các ảnh vào file ZIP. Vui lòng thử tải từng ảnh riêng lẻ.');
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveBlob(content, zipFilename.endsWith('.zip') ? zipFilename : `${zipFilename}.zip`);
}

/**
 * Copy string to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('Clipboard API failed, trying fallback:', e);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Copy fallback failed:', err);
    return false;
  }
}

/**
 * Format numbers to compact strings (e.g. 1.2M, 45.6K)
 */
export function formatNumber(num: number): string {
  if (!num || isNaN(num)) return '0';
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
}

/**
 * Format bytes to readable string (e.g. 14.5 MB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

/**
 * Format duration in seconds to mm:ss
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
