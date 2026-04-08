import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Mime types that Gemini can process via multimodal (image_url)
const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileBase64, fileName, mimeType } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not set");
    }

    if (!fileBase64 || !fileName) {
      throw new Error("Missing fileBase64 or fileName");
    }

    // Check if the mime type is supported for multimodal extraction
    const isSupported = SUPPORTED_MIME_TYPES.some(t => mimeType?.startsWith(t));

    if (!isSupported) {
      // For unsupported binary formats (DOCX, PPTX, XLSX), return a helpful message
      return new Response(JSON.stringify({
        text: "",
        unsupported: true,
        message: `Cannot extract text from ${fileName} automatically. Please copy and paste the content directly.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit payload size — base64 over ~10MB is risky for edge functions
    if (fileBase64.length > 10_000_000) {
      return new Response(JSON.stringify({
        text: "",
        unsupported: true,
        message: `File is too large for automatic extraction. Please paste the key content manually.`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Gemini's multimodal capability to extract text from PDF/images
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
            content: "You are a document content extractor. Extract ALL text content from the uploaded document. Preserve the structure — headings, bullet points, numbered lists, tables (as markdown). Output ONLY the extracted text, no commentary."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all text content from this ${fileName} file. Return the full text content preserving structure.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${fileBase64}`
                }
              }
            ]
          }
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
      console.error("Failed to parse AI response, length:", rawText.length, "preview:", rawText.substring(0, 200));
      // If we got partial text, try to extract useful content anyway
      if (rawText.length > 0) {
        // Try to find the content field in the partial JSON
        const contentMatch = rawText.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (contentMatch) {
          return new Response(JSON.stringify({ text: contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      throw new Error("Failed to parse AI response - document may be too large. Try a smaller file or paste content manually.");
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
