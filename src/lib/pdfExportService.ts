/**
 * PDF Export Service
 * Converts narrative scenes to a PDF flipbook document
 */

import type { TopicNarrative } from "@/lib/visualNarrativeService";

export interface PDFExportResult {
  success: boolean;
  pdfDataUrl?: string;
  error?: string;
}

/**
 * Export narrative scenes as PDF
 * Uses jsPDF and html2canvas for rendering
 */
export async function exportNarrativeToPDF(
  narratives: TopicNarrative[],
  courseTitle: string
): Promise<PDFExportResult> {
  try {
    // Dynamically import jsPDF (to avoid bundling if not used)
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;

    if (!narratives || narratives.length === 0) {
      return { success: false, error: "No narratives provided" };
    }

    // Create PDF (A4 size, portrait)
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;

    // Title page
    pdf.setFontSize(28);
    pdf.text(courseTitle, pageWidth / 2, pageHeight / 2 - 20, { align: "center" });
    pdf.setFontSize(14);
    pdf.setTextColor(100);
    pdf.text("Professional Learning Guide", pageWidth / 2, pageHeight / 2 + 10, { align: "center" });
    pdf.addPage();

    let pageNumber = 1;

    // Add scenes as pages
    for (const narrative of narratives) {
      for (const scene of narrative.scenes) {
        pdf.setTextColor(0);
        let yPosition = margin;

        // Add image if available
        if (scene.imageDataUrl) {
          try {
            const img = new Image();
            img.src = scene.imageDataUrl;

            // Wait for image to load
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve(); // Continue even if image fails
            });

            // Calculate image dimensions to fit width
            const imgWidth = contentWidth;
            const imgHeight = (contentWidth / img.width) * img.height;
            const maxImgHeight = pageHeight / 2; // Use max 50% of page

            const finalImgHeight = Math.min(imgHeight, maxImgHeight);
            const finalImgWidth = (finalImgHeight / imgHeight) * imgWidth;
            const imgX = margin + (contentWidth - finalImgWidth) / 2;

            pdf.addImage(scene.imageDataUrl, "JPEG", imgX, yPosition, finalImgWidth, finalImgHeight);
            yPosition += finalImgHeight + 5;
          } catch (err) {
            console.warn("Failed to add image to PDF:", err);
          }
        }

        // Add scene title
        pdf.setFontSize(14);
        pdf.setFont(undefined, "bold");
        yPosition += 5;
        const titleLines = pdf.splitTextToSize(scene.title, contentWidth);
        pdf.text(titleLines, margin, yPosition);
        yPosition += titleLines.length * 5 + 5;

        // Add caption/content
        pdf.setFontSize(11);
        pdf.setFont(undefined, "normal");
        pdf.setTextColor(40);
        const contentLines = pdf.splitTextToSize(scene.caption, contentWidth);
        pdf.text(contentLines, margin, yPosition);
        yPosition += contentLines.length * 5;

        // Add narration text if available
        if (scene.narration && scene.narration.trim().length > 0) {
          yPosition += 3;
          pdf.setFontSize(10);
          pdf.setTextColor(100);
          pdf.setFont(undefined, "italic");
          const narrativeLines = pdf.splitTextToSize(`Narration: ${scene.narration}`, contentWidth);
          pdf.text(narrativeLines, margin, yPosition);
        }

        // Add page number and topic info
        pdf.setFontSize(9);
        pdf.setTextColor(150);
        pdf.text(`Page ${pageNumber} | ${narrative.topicTitle}`, margin, pageHeight - margin);

        pageNumber++;

        // Add new page for next scene (except for last scene)
        if (narrative !== narratives[narratives.length - 1] || scene !== narrative.scenes[narrative.scenes.length - 1]) {
          pdf.addPage();
        }
      }
    }

    // Convert to data URL
    const pdfDataUrl = pdf.output("dataurlstring");

    return {
      success: true,
      pdfDataUrl,
    };
  } catch (err) {
    console.error("PDF export error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate PDF",
    };
  }
}

/**
 * Download PDF to user's computer
 */
export function downloadPDF(pdfDataUrl: string, filename: string): void {
  try {
    const link = document.createElement("a");
    link.href = pdfDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("PDF download error:", err);
    throw new Error("Failed to download PDF");
  }
}
