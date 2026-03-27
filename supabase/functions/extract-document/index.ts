import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Use Gemini's multimodal capability to extract text from the document
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
      const errData = await response.json();
      throw new Error(errData.error?.message || "Failed to extract document text");
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
