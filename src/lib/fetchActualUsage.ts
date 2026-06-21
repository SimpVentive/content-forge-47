import { supabase } from "./supabase";

interface ProviderUsageData {
  provider: string;
  used: number;
  total: number;
  remaining: number;
  lastUpdated: string;
}

// Fetch ElevenLabs subscription data
async function fetchElevenLabsUsage(apiKey: string): Promise<ProviderUsageData | null> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });
    const data = await res.json();
    return {
      provider: "ElevenLabs",
      used: data.character_count || 0,
      total: data.character_limit || 0,
      remaining: (data.character_limit || 0) - (data.character_count || 0),
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to fetch ElevenLabs usage:", err);
    return null;
  }
}

// Fetch HeyGen account info
async function fetchHeyGenUsage(apiKey: string): Promise<ProviderUsageData | null> {
  try {
    const res = await fetch("https://api.heygen.com/v1/account", {
      headers: { "x-api-key": apiKey },
    });
    const data = await res.json();
    // HeyGen typically shows remaining credits/minutes
    const used = data.credits_used || 0;
    const total = (data.credits_used || 0) + (data.credits_remaining || 0);
    return {
      provider: "HeyGen",
      used,
      total,
      remaining: data.credits_remaining || 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to fetch HeyGen usage:", err);
    return null;
  }
}

// Fetch Anthropic usage (if available through their API)
async function fetchAnthropicUsage(apiKey: string): Promise<ProviderUsageData | null> {
  try {
    // Anthropic doesn't expose usage directly via API
    // Usage comes from response headers in each API call
    console.log("Anthropic usage tracked per-request via API responses");
    return null;
  } catch (err) {
    console.error("Failed to fetch Anthropic usage:", err);
    return null;
  }
}

// Fetch BFL Flux 2 credits (if available)
async function fetchBFLUsage(apiKey: string): Promise<ProviderUsageData | null> {
  try {
    // BFL doesn't have a direct usage endpoint
    // Credits are deducted per-image generation
    console.log("BFL usage tracked per-request via API responses");
    return null;
  } catch (err) {
    console.error("Failed to fetch BFL usage:", err);
    return null;
  }
}

export async function fetchAllProviderUsage() {
  console.log("🔄 Fetching actual usage from all API providers...\n");

  // Get all configured providers
  const { data: providers } = await supabase
    .from("provider_configs")
    .select("*")
    .eq("is_active", true);

  if (!providers) {
    console.log("No active providers found");
    return;
  }

  const usageData: ProviderUsageData[] = [];

  for (const provider of providers) {
    console.log(`📊 Fetching ${provider.provider_name}...`);

    let usage: ProviderUsageData | null = null;

    // Decrypt the API key (you'll need to handle this)
    // For now, we'll fetch from environment or provider config
    const apiKey = provider.api_key_encrypted;

    switch (provider.provider_name.toLowerCase()) {
      case "elevenlabs":
        usage = await fetchElevenLabsUsage(apiKey);
        break;
      case "heygen":
        usage = await fetchHeyGenUsage(apiKey);
        break;
      case "anthropic claude":
      case "claude":
        usage = await fetchAnthropicUsage(apiKey);
        break;
      case "bfl flux 2":
      case "bfl":
        usage = await fetchBFLUsage(apiKey);
        break;
    }

    if (usage) {
      usageData.push(usage);
      console.log(
        `✅ ${usage.provider}: ${usage.remaining} / ${usage.total} remaining\n`
      );
    }
  }

  console.log("📝 Usage data fetched:");
  console.log(JSON.stringify(usageData, null, 2));

  return usageData;
}

// Log usage to database
export async function logProviderUsage(usageData: ProviderUsageData) {
  const { error } = await supabase.from("api_usage_logs").insert({
    provider_name: usageData.provider,
    units_used: usageData.used,
    cost: 0, // Will be calculated based on rates
    reason: `Usage snapshot - ${usageData.remaining}/${usageData.total} remaining`,
    created_at: usageData.lastUpdated,
  });

  if (error) {
    console.error(`Failed to log ${usageData.provider} usage:`, error);
  }
}
