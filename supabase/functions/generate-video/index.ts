import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { narratives, courseTitle } = await req.json();

    if (!narratives || !Array.isArray(narratives) || narratives.length === 0) {
      return new Response(
        JSON.stringify({ error: "No narratives provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Video generation is complex and requires FFmpeg on the server
    // For now, return a message about the limitation
    return new Response(
      JSON.stringify({
        success: false,
        error: "Video export requires server-side FFmpeg processing. This feature is available via manual export or scheduled processing.",
        workaround: "Use Interactive HTML export and convert to video using your preferred video editor, or schedule async video generation."
      }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Video generation error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
