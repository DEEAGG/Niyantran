import { reportService } from '../services/reportService';

/**
 * Robust, authenticated, popup-safe helper to view, download, or print Niyantran PDF Dossiers.
 *
 * @param {Object} options
 * @param {string} options.applicationId - Application ID (e.g. APP-...)
 * @param {'view'|'download'|'print'} [options.action='view']
 * @param {Function} [options.addToast] - Toast notification function
 * @param {Function} [options.onBlockedPopup] - Callback if popup was blocked by browser
 */
export async function handleReportAction({
  applicationId,
  action = 'view',
  addToast = () => {},
  onBlockedPopup = null,
}) {
  if (!applicationId) {
    addToast({
      title: 'Missing Application ID',
      message: 'Cannot generate regulatory dossier without a valid application identifier.',
      type: 'warning',
    });
    return null;
  }

  let popupWin = null;
  // If viewing or printing in a new tab, open the tab synchronously in response to user click
  if (action === 'view' || action === 'print') {
    try {
      popupWin = window.open('', '_blank');
      if (popupWin && !popupWin.closed) {
        popupWin.document.title = 'Preparing Regulatory Dossier...';
        popupWin.document.body.innerHTML = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #ffffff;">
            <div style="width: 44px; height: 44px; border: 3px solid rgba(228,61,18,0.25); border-top-color: #E43D12; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px;"></div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em;">Preparing NIYANTRAN Dossier</h3>
            <p style="margin: 0; font-size: 13px; color: #94a3b8;">Authenticating and generating cryptographic PDF document for ${applicationId}...</p>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
          </div>
        `;
      }
    } catch (_) {
      popupWin = null;
    }
  }

  try {
    const blob = await reportService.getReportPdfBlob(applicationId);

    // Validate that blob is a non-empty PDF
    if (!blob || blob.size < 64) {
      throw new Error('Server returned an empty or invalid document.');
    }

    // Verify PDF header magic bytes if returned as wrong mime or text
    if (blob.type && blob.type !== 'application/pdf' && !blob.type.includes('pdf')) {
      const text = await blob.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.detail || json.message || 'Server error while generating dossier.');
      } catch (_) {
        throw new Error('Received non-PDF response from regulatory server.');
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const filename = `Niyantran_Dossier_${applicationId}.pdf`;

    if (action === 'download') {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      addToast({
        title: 'Dossier Downloaded',
        message: `Saved ${filename} successfully.`,
        type: 'success',
      });

      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      return objectUrl;
    }

    if (action === 'print') {
      if (popupWin && !popupWin.closed) {
        popupWin.location.href = objectUrl;
      } else {
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        printIframe.src = objectUrl;
        document.body.appendChild(printIframe);
        printIframe.onload = () => {
          setTimeout(() => {
            try {
              printIframe.contentWindow.focus();
              printIframe.contentWindow.print();
            } catch (_) {
              window.open(objectUrl, '_blank');
            }
          }, 400);
        };
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
      return objectUrl;
    }

    // action === 'view'
    if (popupWin && !popupWin.closed) {
      popupWin.location.href = objectUrl;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
      return objectUrl;
    } else {
      // Browser blocked popup
      if (typeof onBlockedPopup === 'function') {
        onBlockedPopup(objectUrl, filename);
      } else {
        addToast({
          title: 'Popup Blocked',
          message: 'Browser blocked popup. Downloading dossier instead...',
          type: 'warning',
        });
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
      return objectUrl;
    }
  } catch (err) {
    if (popupWin && !popupWin.closed) {
      popupWin.close();
    }
    const errMsg = err?.response?.data?.detail || err?.message || 'Failed to generate regulatory report';
    addToast({
      title: 'Report Generation Failed',
      message: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg),
      type: 'error',
    });
    throw err;
  }
}
