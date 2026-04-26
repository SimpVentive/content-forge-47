import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mime types Gemini can ingest directly via image_url (PDFs + images)
const GEMINI_SUPPORTED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Strip XML tags and decode common entities
function stripXml(xml: string): string {
  // Insert spaces between adjacent tags so words don't smush
  const text = xml
    .replace(/<\/(a:p|w:p|a:br|w:br|a:tab)>/g, "$&\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractFromZipXml(
  bytes: Uint8Array,
  matcher: (path: string) => boolean,
  sortFn?: (a: string, b: string) => number,
): Promise<string> {
  // Use Deno's built-in via a minimal unzip — fall back to fflate from esm.sh
  const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.2");
  const files = unzipSync(bytes);
  const paths = Object.keys(files).filter(matcher);
  if (sortFn) paths.sort(sortFn);
  const parts: string[] = [];
  for (const p of paths) {
    const xml = strFromU8(files[p]);
    const text = stripXml(xml);
    if (text) parts.push(text);
  }
  return parts.join("\n\n");
}

async function extractPptx(bytes: Uint8Array): Promise<string> {
  return extractFromZipXml(
    bytes,
    (p) => /^ppt\/slides\/slide\d+\.xml$/.test(p),
    (a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return na - nb;
    },
  );
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  return extractFromZipXml(bytes, (p) => p === "word/document.xml");
}

async function extractXlsx(bytes: Uint8Array): Promise<string> {
  // Pull shared strings + sheet cell text
  const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.2");
  const files = unzipSync(bytes);
  const parts: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    parts.push(stripXml(strFromU8(files["xl/sharedStrings.xml"])));
  }
  for (const p of Object.keys(files)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(p)) {
      parts.push(stripXml(strFromU8(files[p])));
    }
  }
  return parts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, fileName, mimeType } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!fileBase64 || !fileName) {
      throw new Error("Missing fileBase64 or fileName");
    }

    const lowerName = (fileName as string).toLowerCase();

    // === Office formats: parse ZIP/XML directly ===
    if (lowerName.endsWith(".pptx") || lowerName.endsWith(".docx") || lowerName.endsWith(".xlsx")) {
      try {
        const bytes = base64ToUint8Array(fileBase64);
        let text = "";
        if (lowerName.endsWith(".pptx")) text = await extractPptx(bytes);
        else if (lowerName.endsWith(".docx")) text = await extractDocx(bytes);
        else text = await extractXlsx(bytes);

        if (!text || text.length < 10) {
          return new Response(JSON.stringify({
            text: "",
            unsupported: true,
            message: `Could not extract readable text from ${fileName}. Please paste the key content manually.`,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ text }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Office extract error:", e);
        return new Response(JSON.stringify({
          text: "",
          unsupported: true,
          message: `Failed to read ${fileName}. Please paste the content manually.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // === Legacy .ppt/.doc/.xls — not supported ===
    if (lowerName.endsWith(".ppt") || lowerName.endsWith(".doc") || lowerName.endsWith(".xls")) {
      return new Response(JSON.stringify({
        text: "",
        unsupported: true,
        message: `Legacy ${fileName.split(".").pop()?.toUpperCase()} files aren't supported. Please save as .pptx/.docx/.xlsx and re-upload, or paste content directly.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === PDF / images via Gemini multimodal ===
    const isGeminiSupported = GEMINI_SUPPORTED.some((t) => mimeType?.startsWith(t));
    if (!isGeminiSupported) {
      return new Response(JSON.stringify({
        text: "",
        unsupported: true,
        message: `Cannot extract text from ${fileName} automatically. Please paste content directly.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!apiKey) throw new Error("LOVABLE_API_KEY is not set");

    if (fileBase64.length > 10_000_000) {
      return new Response(JSON.stringify({
        text: "",
        unsupported: true,
        message: `File is too large for automatic extraction. Please paste the key content manually.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a document content extractor. Extract ALL text content from the uploaded document. Preserve the structure — headings, bullet points, numbered lists, tables (as markdown). Output ONLY the extracted text, no commentary.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract all text content from this ${fileName} file. Return the full text content preserving structure.` },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", errText);
      throw new Error("Failed to extract document text");
    }

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Failed to parse AI response, length:", rawText.length);
      const contentMatch = rawText.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (contentMatch) {
        return new Response(JSON.stringify({ text: contentMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to parse AI response - document may be too large.");
    }
    const text = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("extract-document error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
