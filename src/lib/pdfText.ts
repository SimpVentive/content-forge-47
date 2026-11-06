// Reads the text layer of a PDF in the browser. Large PDFs (many pages, images)
// cannot reliably be sent to the extraction service, so text PDFs are read locally.
export async function extractPdfTextInBrowser(file: File | ArrayBuffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      line += item.str ?? "";
      if (item.hasEOL) { lines.push(line); line = ""; } else if (item.str) line += " ";
    }
    if (line.trim()) lines.push(line);
    const pageText = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
    if (pageText) pages.push(pageText);
    page.cleanup();
  }
  await pdf.destroy();
  return { text: pages.join("\n\n"), pages: pdf.numPages };
}
