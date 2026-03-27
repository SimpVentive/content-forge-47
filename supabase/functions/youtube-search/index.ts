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
    const { modules, courseTitle, language, level } = await req.json();
    const apiKey = Deno.env.get("Youtube_Learning");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "YOUTUBE_API_KEY not configured", missing_key: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const mod of modules) {
      const query = `${mod} ${courseTitle} ${language || ""} ${level || ""}`.trim();
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("key", apiKey);
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", "8");
      searchUrl.searchParams.set("order", "relevance");
      searchUrl.searchParams.set("videoEmbeddable", "true");
      searchUrl.searchParams.set("safeSearch", "strict");
      if (language && language !== "English") {
        const langMap: Record<string, string> = { Hindi: "hi", Tamil: "ta", Telugu: "te", Kannada: "kn", Malayalam: "ml", Bengali: "bn", Marathi: "mr", Gujarati: "gu", Punjabi: "pa", Urdu: "ur" };
        if (langMap[language]) searchUrl.searchParams.set("relevanceLanguage", langMap[language]);
      }

      const searchRes = await fetch(searchUrl.toString());
      const searchData = await searchRes.json();

      if (searchData.error) {
        if (searchData.error.errors?.[0]?.reason === "quotaExceeded") {
          return new Response(
            JSON.stringify({ error: "YouTube quota exceeded", quota_exceeded: true }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(searchData.error.message);
      }

      const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).filter(Boolean);
      
      if (videoIds.length === 0) {
        results.push({ module_title: mod, videos: [] });
        continue;
      }

      // Fetch stats
      const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      statsUrl.searchParams.set("key", apiKey);
      statsUrl.searchParams.set("id", videoIds.join(","));
      statsUrl.searchParams.set("part", "statistics,contentDetails");

      const statsRes = await fetch(statsUrl.toString());
      const statsData = await statsRes.json();

      const statsMap: Record<string, any> = {};
      for (const item of (statsData.items || [])) {
        statsMap[item.id] = {
          viewCount: item.statistics?.viewCount || "0",
          likeCount: item.statistics?.likeCount || "0",
          duration: item.contentDetails?.duration || "PT0S",
        };
      }

      const videos = (searchData.items || []).map((item: any) => {
        const stats = statsMap[item.id.videoId] || {};
        return {
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          viewCount: stats.viewCount || "0",
          likeCount: stats.likeCount || "0",
          duration: stats.duration || "PT0S",
          description: (item.snippet.description || "").slice(0, 120),
        };
      });

      results.push({ module_title: mod, videos });
    }

    return new Response(
      JSON.stringify({ modules: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
