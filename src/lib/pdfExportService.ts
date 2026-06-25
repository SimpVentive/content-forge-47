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
  courseTitle: string,
  assessmentRaw?: string
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

    // Overview page
    let overviewY = margin;

    pdf.setFontSize(18);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(0);
    pdf.text("Course Overview", margin, overviewY);
    overviewY += 10;

    // Module Objectives
    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(40);
    pdf.text("Module Objectives:", margin, overviewY);
    overviewY += 6;

    pdf.setFontSize(11);
    pdf.setFont(undefined, "normal");
    const objectives = narratives
      .map(n => n.topicObjective || "Master key concepts")
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);

    objectives.forEach(obj => {
      const objLines = pdf.splitTextToSize(`• ${obj}`, contentWidth - 5);
      pdf.text(objLines, margin + 5, overviewY);
      overviewY += objLines.length * 4 + 2;
    });

    overviewY += 3;

    // Course Contents
    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(40);
    pdf.text("Course Contents:", margin, overviewY);
    overviewY += 6;

    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    narratives.forEach(narrative => {
      const titleLines = pdf.splitTextToSize(`• ${narrative.topicTitle}`, contentWidth - 5);
      pdf.text(titleLines, margin + 5, overviewY);
      overviewY += titleLines.length * 3 + 1;

      narrative.scenes.slice(0, 3).forEach(scene => {
        const sceneLines = pdf.splitTextToSize(`  ◦ ${scene.title}`, contentWidth - 10);
        pdf.text(sceneLines, margin + 10, overviewY);
        overviewY += sceneLines.length * 3 + 0.5;
      });

      if (narrative.scenes.length > 3) {
        pdf.text(`  ◦ ... and ${narrative.scenes.length - 3} more scenes`, margin + 10, overviewY);
        overviewY += 3;
      }
    });

    overviewY += 3;

    // Duration
    const totalScenes = narratives.reduce((sum, n) => sum + n.scenes.length, 0);
    const estimatedMinutes = Math.ceil(totalScenes * 1.5);

    pdf.setFontSize(12);
    pdf.setFont(undefined, "bold");
    pdf.setTextColor(40);
    pdf.text(`Duration: Approximately ${estimatedMinutes} minutes`, margin, overviewY);

    // Page number
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text("Overview", margin, pageHeight - margin);

    pdf.addPage();

    let pageNumber = 2;

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

    // Add assessment pages if provided
    if (assessmentRaw) {
      try {
        let assessmentData = JSON.parse(assessmentRaw);
        const match = assessmentRaw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (!assessmentData && match) {
          assessmentData = JSON.parse(match[1].trim());
        }

        if (assessmentData) {
          // Add assessment section title page
          pdf.addPage();
          pdf.setFontSize(24);
          pdf.setFont(undefined, "bold");
          pdf.setTextColor(0);
          pdf.text("Assessment", margin, pageHeight / 2 - 20, { align: "center" });
          pdf.setFontSize(12);
          pdf.setTextColor(100);
          pdf.text("Review your knowledge with these questions", margin, pageHeight / 2 + 10, { align: "center" });

          // Add MCQ questions
          if (Array.isArray(assessmentData.mcq)) {
            assessmentData.mcq.slice(0, 10).forEach((q: any, qIdx: number) => {
              pdf.addPage();
              let qY = margin;

              // Question number and text
              pdf.setFontSize(12);
              pdf.setFont(undefined, "bold");
              pdf.setTextColor(0);
              const qText = `${qIdx + 1}. ${q.question || "Question"}`;
              const qLines = pdf.splitTextToSize(qText, contentWidth);
              pdf.text(qLines, margin, qY);
              qY += qLines.length * 5 + 5;

              // Options
              pdf.setFontSize(11);
              pdf.setFont(undefined, "normal");
              (q.options || []).forEach((opt: string) => {
                const optLines = pdf.splitTextToSize(`• ${opt}`, contentWidth);
                pdf.text(optLines, margin + 5, qY);
                qY += optLines.length * 4 + 2;
              });

              // Correct answer
              qY += 3;
              pdf.setFontSize(10);
              pdf.setTextColor(22, 163, 74); // Green
              pdf.setFont(undefined, "bold");
              pdf.text(`Answer: ${q.correct_answer || ""}`, margin, qY);

              // Page number
              pdf.setFontSize(9);
              pdf.setTextColor(150);
              pdf.text(`Assessment Q${qIdx + 1}`, margin, pageHeight - margin);
            });
          }

          // Add scenario questions
          if (Array.isArray(assessmentData.scenarios)) {
            assessmentData.scenarios.slice(0, 5).forEach((s: any, sIdx: number) => {
              pdf.addPage();
              let sY = margin;

              pdf.setFontSize(12);
              pdf.setFont(undefined, "bold");
              pdf.setTextColor(0);
              pdf.text(`Scenario ${sIdx + 1}`, margin, sY);
              sY += 7;

              pdf.setFontSize(11);
              pdf.setFont(undefined, "normal");
              const situationLines = pdf.splitTextToSize(s.situation || "Scenario", contentWidth);
              pdf.text(situationLines, margin, sY);
              sY += situationLines.length * 5 + 5;

              (s.options || []).forEach((opt: string) => {
                const optLines = pdf.splitTextToSize(`• ${opt}`, contentWidth);
                pdf.text(optLines, margin + 5, sY);
                sY += optLines.length * 4 + 2;
              });

              sY += 3;
              pdf.setFontSize(10);
              pdf.setTextColor(22, 163, 74);
              pdf.setFont(undefined, "bold");
              pdf.text(`Best Response: ${s.best_response || ""}`, margin, sY);

              pdf.setFontSize(9);
              pdf.setTextColor(150);
              pdf.text(`Assessment Scenario ${sIdx + 1}`, margin, pageHeight - margin);
            });
          }

          // Add reflection exercise
          if (assessmentData.reflection) {
            pdf.addPage();
            let rY = margin;

            pdf.setFontSize(12);
            pdf.setFont(undefined, "bold");
            pdf.setTextColor(0);
            pdf.text("Reflection Exercise", margin, rY);
            rY += 10;

            pdf.setFontSize(11);
            pdf.setFont(undefined, "normal");
            const promptLines = pdf.splitTextToSize(`Prompt: ${assessmentData.reflection.prompt || ""}`, contentWidth);
            pdf.text(promptLines, margin, rY);
            rY += promptLines.length * 5 + 5;

            const guidanceLines = pdf.splitTextToSize(`Guidance: ${assessmentData.reflection.guidance || ""}`, contentWidth);
            pdf.text(guidanceLines, margin, rY);

            pdf.setFontSize(9);
            pdf.setTextColor(150);
            pdf.text("Reflection", margin, pageHeight - margin);
          }
        }
      } catch (err) {
        console.warn("Could not add assessment to PDF:", err);
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
