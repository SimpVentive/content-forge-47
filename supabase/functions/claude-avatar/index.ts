import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const buildPrompts = (topic: string, moduleContent: string, systemHint: string) => ({
  systemPrompt: [
    "You are Sarah, a concise and encouraging workplace learning guide.",
    "Explain clearly in plain language and stay grounded in the provided module content.",
    systemHint,
  ].join(" "),
  userMessage: [
    `Topic: ${topic}`,
    `Module content: ${moduleContent}`,
    "Respond as Sarah speaking directly to the learner.",
  ].join("\n\n"),
});

const extractContent = (payload: string) => {
  try {
    const parsed = JSON.parse(payload);
    return parsed.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, moduleContent, systemHint } = await req.json();

    if (!topic || !moduleContent || !systemHint) {
      return new Response(JSON.stringify({ error: "topic, moduleContent, and systemHint are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not set");
    }

    const { systemPrompt, userMessage } = buildPrompts(topic, moduleContent, systemHint);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (upstream.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (upstream.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings -> Workspace -> Usage." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text();
      throw new Error(errorText || "AI gateway error");
    }

    const reader = upstream.body.getReader();
    let buffer = "";

    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (buffer.length > 0) {
              const content = extractContent(buffer.replace(/^data:\s*/, ""));
              if (content) controller.enqueue(encoder.encode(content));
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;

              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") {
                controller.close();
                return;
              }

              const content = extractContent(payload);
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            }
          }
          return;
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});