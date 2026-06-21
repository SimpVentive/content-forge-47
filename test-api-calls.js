import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://licezkkahseilnmswxbc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpY2V6a2thaHNlaWxubXN3eGJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjQ5ODYsImV4cCI6MjA5MDE0MDk4Nn0.uihvlJcwnwx6TVjn_0zYkz3j-_SeVhgPBZd9cj378jw";
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateTestUsage() {
  console.log("🚀 Generating test API usage data...\n");

  const usageRecords = [
    {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      provider_name: "Anthropic Claude",
      units_used: 1500,
      cost: 1.5,
      reason: "Image narrative generation - 3 scenes",
      course_id: "test-course-001",
      created_at: new Date().toISOString(),
    },
    {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      provider_name: "BFL Flux 2",
      units_used: 3,
      cost: 0.165,
      reason: "Generate 3 narrative scene images",
      course_id: "test-course-001",
      created_at: new Date().toISOString(),
    },
    {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      provider_name: "ElevenLabs",
      units_used: 2500,
      cost: 0.75,
      reason: "Text-to-speech narration for 2 scenes",
      course_id: "test-course-001",
      created_at: new Date().toISOString(),
    },
    {
      user_id: "550e8400-e29b-41d4-a716-446655440001",
      provider_name: "HeyGen",
      units_used: 2,
      cost: 1.0,
      reason: "Avatar video generation - 2 minute video",
      course_id: "test-course-002",
      created_at: new Date().toISOString(),
    },
    {
      user_id: "550e8400-e29b-41d4-a716-446655440001",
      provider_name: "Anthropic Claude",
      units_used: 2000,
      cost: 2.0,
      reason: "Course script writing and editing",
      course_id: "test-course-002",
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      user_id: "550e8400-e29b-41d4-a716-446655440002",
      provider_name: "BFL Flux 2",
      units_used: 5,
      cost: 0.275,
      reason: "Product showcase images",
      course_id: "test-course-003",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  console.log(`📝 Inserting ${usageRecords.length} usage records...\n`);

  for (const record of usageRecords) {
    const { error } = await supabase.from("api_usage_logs").insert(record);
    if (error) {
      console.error(`❌ Failed to insert ${record.provider_name}:`, error);
    } else {
      console.log(
        `✅ ${record.provider_name}: ${record.units_used} units, ₹${record.cost.toFixed(2)}`
      );
    }
  }

  console.log("\n📊 Adding purchase history...\n");

  const purchases = [
    {
      provider_name: "Anthropic Claude",
      purchase_date: "2026-06-15",
      units_purchased: 10000,
      cost_inr: 10.0,
      notes: "Initial purchase - 10K tokens",
    },
    {
      provider_name: "BFL Flux 2",
      purchase_date: "2026-06-10",
      units_purchased: 100,
      cost_inr: 5.5,
      notes: "Batch 1 - 100 images",
    },
    {
      provider_name: "ElevenLabs",
      purchase_date: "2026-06-12",
      units_purchased: 50000,
      cost_inr: 15.0,
      notes: "Text-to-speech characters",
    },
    {
      provider_name: "HeyGen",
      purchase_date: "2026-06-01",
      units_purchased: 10,
      cost_inr: 5.0,
      notes: "Avatar video minutes",
    },
  ];

  for (const purchase of purchases) {
    const { error } = await supabase
      .from("provider_purchases")
      .insert(purchase);
    if (error) {
      console.error(`❌ Failed to insert purchase:`, error);
    } else {
      console.log(
        `✅ Purchase: ${purchase.provider_name} - ${purchase.units_purchased} units for ₹${purchase.cost_inr}`
      );
    }
  }

  console.log("\n💰 Adding billing transactions...\n");

  const transactions = [
    {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      credits_purchased: 50000,
      amount_paid_inr: 50.0,
      status: "paid",
      payment_date: "2026-06-15",
    },
    {
      user_id: "550e8400-e29b-41d4-a716-446655440001",
      credits_purchased: 25000,
      amount_paid_inr: 25.0,
      status: "paid",
      payment_date: "2026-06-10",
    },
  ];

  for (const tx of transactions) {
    const { error } = await supabase.from("billing_transactions").insert(tx);
    if (error) {
      console.error(`❌ Failed to insert transaction:`, error);
    } else {
      console.log(
        `✅ Transaction: User purchased ${tx.credits_purchased} credits for ₹${tx.amount_paid_inr}`
      );
    }
  }

  console.log("\n✨ Test data generation complete!");
  console.log("📊 Navigate to /admin/credits to see the dashboard with real data\n");
}

generateTestUsage().catch(console.error);
