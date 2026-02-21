/**
 * Capture the map container as a base64 PNG data URL using html2canvas.
 * Returns undefined if capture fails (e.g., no map container or CORS issues).
 */
export async function captureMapScreenshot(): Promise<string | undefined> {
  try {
    const { default: html2canvas } = await import('html2canvas');

    // Find the map container - it's the first child of the .flex-1.relative div
    const mapContainer = document.querySelector('.gm-style')?.closest('div[class*="absolute inset"]') as HTMLElement
      ?? document.querySelector('.gm-style')?.parentElement as HTMLElement;

    if (!mapContainer) return undefined;

    const canvas = await html2canvas(mapContainer, {
      useCORS: true,
      allowTaint: true,
      scale: 2, // Higher resolution for PDF
      logging: false,
      backgroundColor: '#1a1a2e',
    });

    return canvas.toDataURL('image/png');
  } catch {
    // Silently fail - screenshot is optional
    return undefined;
  }
}
