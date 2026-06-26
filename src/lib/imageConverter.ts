/**
 * Image Format Converter
 * Converts PNG images to JPEG format for better compression and file size
 */

/**
 * Convert base64 data URL from PNG to JPEG format
 * @param pngDataUrl Base64 PNG data URL
 * @param quality JPEG quality (0-100, default 85)
 * @returns Promise<string> JPEG base64 data URL
 */
export async function convertPngToJpeg(
  pngDataUrl: string,
  quality: number = 85
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create image from PNG data URL
      const img = new Image();
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        // Get 2D context and draw image
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Fill white background (for PNG transparency support)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Convert to JPEG data URL
        try {
          const jpegDataUrl = canvas.toDataURL("image/jpeg", quality / 100);
          resolve(jpegDataUrl);
        } catch (error) {
          reject(new Error(`Failed to convert canvas to JPEG: ${error}`));
        }
      };

      img.onerror = () => {
        reject(new Error("Failed to load image from data URL"));
      };

      // Set source to PNG data URL
      img.src = pngDataUrl;
    } catch (error) {
      reject(new Error(`Image conversion error: ${error}`));
    }
  });
}

/**
 * Convert base64 data URL to different format
 * @param dataUrl Original data URL
 * @param targetFormat Target format (jpeg, png, webp, etc.)
 * @param quality Quality for lossy formats (0-100)
 * @returns Promise<string> Converted data URL
 */
export async function convertImageFormat(
  dataUrl: string,
  targetFormat: "jpeg" | "png" | "webp" = "jpeg",
  quality: number = 85
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // For JPEG, fill white background
        if (targetFormat === "jpeg") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        try {
          const mimeType = `image/${targetFormat}`;
          const convertedUrl = canvas.toDataURL(
            mimeType,
            targetFormat === "png" ? undefined : quality / 100
          );
          resolve(convertedUrl);
        } catch (error) {
          reject(new Error(`Failed to convert to ${targetFormat}: ${error}`));
        }
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = dataUrl;
    } catch (error) {
      reject(new Error(`Image conversion error: ${error}`));
    }
  });
}

/**
 * Get MIME type from data URL
 */
export function getMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/data:([^;]+)/);
  return match ? match[1] : "image/png";
}

/**
 * Check if image is PNG format
 */
export function isPngImage(mimeType: string): boolean {
  return mimeType.toLowerCase().includes("png");
}
