import React, { useState, useEffect } from 'react';
import { FileText, Loader2, ImageOff } from 'lucide-react';

/**
 * AuthenticatedImage component for loading protected binary assets
 * (e.g. rasterized PDF page previews, evidence snapshots).
 *
 * Sends the stored JWT Bearer token via standard fetch, converts the response
 * to an in-memory blob URL, and automatically revokes the blob URL upon unmount.
 */
export default function AuthenticatedImage({
  src,
  alt = 'Document page preview',
  className = '',
  style = {},
  fallback = null,
  onLoad,
  onError,
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let activeUrl = null;

    async function fetchAuthenticatedBlob() {
      if (!src) {
        setLoading(false);
        setError(true);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const token = localStorage.getItem('niyantran_token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(src, { headers });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to load image`);
        }

        const blob = await res.blob();
        if (!isMounted) return;

        activeUrl = URL.createObjectURL(blob);
        setBlobUrl(activeUrl);
        setLoading(false);
        if (onLoad) onLoad();
      } catch (err) {
        if (!isMounted) return;
        setError(true);
        setLoading(false);
        if (onError) onError(err);
      }
    }

    fetchAuthenticatedBlob();

    return () => {
      isMounted = false;
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-secondary/60 min-h-[140px] rounded animate-pulse border border-border/60 ${className}`}
        style={style}
      >
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !blobUrl) {
    if (fallback) return fallback;
    return (
      <div
        className={`flex flex-col items-center justify-center p-4 bg-surface-secondary/40 text-text-muted text-xs text-center border border-dashed border-border rounded min-h-[140px] ${className}`}
        style={style}
      >
        <ImageOff className="w-6 h-6 mb-1 text-text-muted/60" />
        <span>Document page unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={style}
    />
  );
}

/**
 * Utility helper to open an authenticated document or PDF page in a new window/tab.
 * Always uses in-memory blob URLs with standard Bearer authorization headers
 * to prevent leaking reusable session JWTs in query strings, browser history, or server logs.
 */
export async function openAuthenticatedDocument(url) {
  let popupWin = null;
  try {
    popupWin = window.open('', '_blank', 'noopener,noreferrer');
    if (popupWin && !popupWin.closed) {
      popupWin.document.title = 'Loading document preview...';
      popupWin.document.body.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #ffffff;">
          <div style="width: 32px; height: 32px; border: 3px solid rgba(228,61,18,0.25); border-top-color: #E43D12; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
          <p style="margin: 0; font-size: 13px; color: #94a3b8;">Loading authenticated preview...</p>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </div>
      `;
    }
  } catch (_) {
    popupWin = null;
  }

  try {
    const token = localStorage.getItem('niyantran_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    if (popupWin && !popupWin.closed) {
      popupWin.location.href = objectUrl;
    } else {
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
  } catch (err) {
    if (popupWin && !popupWin.closed) {
      popupWin.close();
    }
    console.error('Failed to open authenticated document preview:', err);
  }
}
