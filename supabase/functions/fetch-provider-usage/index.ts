import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProviderUsageData {
  provider: string;
  used: number;
  total: number;
  remaining: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all active providers
    const { data: providers, error: providerError } = await supabase
      .from("provider_configs")
      .select("*")
      .eq("is_active", true);

    if (providerError) throw providerError;

    const usageData: ProviderUsageData[] = [];
    const results: string[] = [];

    for (const provider of providers || []) {
      results.push(`\n📊 Fetching ${provider.provider_name}...`);

      switch (provider.provider_name.toLowerCase()) {
        case "elevenlabs": {
          try {
            const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
              headers: { "xi-api-key": provider.api_key_encrypted },
            });
            const data = await res.json();
            const usage: ProviderUsageData = {
              provider: "ElevenLabs",
              used: data.character_count || 0,
              total: data.character_limit || 0,
              remaining: (data.character_limit || 0) - (data.character_count || 0),
            };
            usageData.push(usage);
            results.push(
              `✅ ElevenLabs: ${usage.remaining} / ${usage.total} characters remaining`
            );
          } catch (err) {
            results.push(`❌ ElevenLabs error: ${err}`);
          }
          break;
        }

        case "heygen": {
          try {
            const res = await fetch("https://api.heygen.com/v1/account", {
              headers: { "x-api-key": provider.api_key_encrypted },
            });
            const data = await res.json();
            const usage: ProviderUsageData = {
              provider: "HeyGen",
              used: data.credits_used || 0,
              total: (data.credits_used || 0) + (data.credits_remaining || 0),
              remaining: data.credits_remaining || 0,
            };
            usageData.push(usage);
            results.push(
              `✅ HeyGen: ${usage.remaining} minutes remaining`
            );
          } catch (err) {
            results.push(`❌ HeyGen error: ${err}`);
          }
          break;
        }

        default:
          results.push(`⏭️  ${provider.provider_name}: Usage tracked per-request`);
      }
    }

    // Log the snapshot
    for (const usage of usageData) {
      const { error } = await supabase.from("api_usage_logs").insert({
        provider_name: usage.provider,
        units_used: usage.used,
        cost: 0,
        reason: `Usage snapshot - ${usage.remaining}/${usage.total} remaining`,
        created_at: new Date().toISOString(),
      });

      if (error) {
        results.push(`❌ Failed to log ${usage.provider}: ${error.message}`);
      } else {
        results.push(`💾 Logged ${usage.provider} usage snapshot`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Provider usage fetched successfully",
        results: results.join("\n"),
        usageCount: usageData.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
