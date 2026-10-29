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
 */
export async function openAuthenticatedDocument(url) {
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
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.warn('Direct authenticated fetch failed, attempting query token:', err);
    const token = localStorage.getItem('niyantran_token');
    const separator = url.includes('?') ? '&' : '?';
    const targetUrl = token ? `${url}${separator}token=${encodeURIComponent(token)}` : url;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
}
