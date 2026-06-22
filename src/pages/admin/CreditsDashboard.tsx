import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/components/admin/format";
import { fetchProviderUsage } from "@/lib/edgeFunctions";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ApiUsageLog = Database["public"]["Tables"]["api_usage_logs"]["Row"];
type ProviderRate = Database["public"]["Tables"]["api_provider_rates"]["Row"];
type BillingTransaction = Database["public"]["Tables"]["billing_transactions"]["Row"];
type ProviderPurchase = Database["public"]["Tables"]["provider_purchases"]["Row"];

const CreditsDashboard = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [apiUsageLogs, setApiUsageLogs] = useState<ApiUsageLog[]>([]);
  const [providerRates, setProviderRates] = useState<ProviderRate[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [providerPurchases, setProviderPurchases] = useState<ProviderPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingUsage, setFetchingUsage] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [usersData, logsData, ratesData, txData, purchasesData] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("api_usage_logs").select("*").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("api_provider_rates").select("*").order("provider_name"),
        supabase.from("billing_transactions").select("*").eq("status", "paid"),
        supabase.from("provider_purchases").select("*").order("purchase_date", { ascending: false }),
      ]);

      setUsers(usersData.data || []);
      setApiUsageLogs(logsData.data || []);
      setProviderRates(ratesData.data || []);
      setTransactions(txData.data || []);
      setProviderPurchases(purchasesData.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleFetchProviderUsage = async () => {
    setFetchingUsage(true);
    try {
      const result = await fetchProviderUsage();
      toast.success(`✅ Fetched usage from ${(result as any)?.usageCount || 0} providers`);
      // Reload data to show new usage
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch provider usage");
    } finally {
      setFetchingUsage(false);
    }
  };

  const stats = useMemo(() => {
    const totalPurchased = transactions.reduce((sum, t) => sum + (t.credits_purchased ?? 0), 0);
    const totalUsed = users.reduce((sum, u) => sum + (u.credits_used ?? 0), 0);
    const totalRemaining = users.reduce((sum, u) => sum + Math.max(0, (u.credits_total ?? 0) - (u.credits_used ?? 0)), 0);
    const monthSpent = apiUsageLogs.reduce((sum, log) => sum + (log.cost ?? 0), 0);

    const topUsers = [...users]
      .map((u) => ({
        user: u,
        spent: apiUsageLogs.filter((log) => log.user_id === u.id).reduce((sum, log) => sum + (log.cost ?? 0), 0),
      }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);

    const byProvider: Record<string, { cost: number; count: number }> = {};
    apiUsageLogs.forEach((log) => {
      const provider = log.provider_name || "Unknown";
      if (!byProvider[provider]) {
        byProvider[provider] = { cost: 0, count: 0 };
      }
      byProvider[provider].cost += log.cost ?? 0;
      byProvider[provider].count += 1;
    });

    const topProvider = Object.entries(byProvider).sort((a, b) => b[1].cost - a[1].cost)[0];

    return { totalPurchased, totalUsed, totalRemaining, monthSpent, topUsers, byProvider, topProvider };
  }, [users, transactions, apiUsageLogs, providerPurchases]);

  if (loading) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading dashboard…</div>;
  }

  const remainingPercent = stats.totalPurchased > 0 ? (stats.totalRemaining / stats.totalPurchased) * 100 : 0;
  const isLow = remainingPercent < 20;

  return (
    <div data-testid="page-admin-credits-dashboard">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">Credits Dashboard</div>
            <div className="ph-sub">Overview of your API credits, spending, and usage</div>
          </div>
          <div className="ph-actions">
            <button
              className="btn btn-primary"
              onClick={() => void handleFetchProviderUsage()}
              disabled={fetchingUsage}
              style={{ opacity: fetchingUsage ? 0.6 : 1 }}
            >
              {fetchingUsage ? "⏳ Fetching..." : "🔄 Fetch Real Usage"}
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics - Top Row */}
      <div className="metrics">
        <div className="mc">
          <div className="mc-label">Total Credits Purchased</div>
          <div className="mc-val g">{fmtNum(stats.totalPurchased)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Credits Remaining</div>
          <div className={`mc-val ${isLow ? "a" : ""}`}>{fmtNum(stats.totalRemaining)}</div>
          <div style={{ fontSize: 11, color: isLow ? "#e74c3c" : "#27ae60", marginTop: 4 }}>
            {remainingPercent.toFixed(0)}% remaining
          </div>
        </div>
        <div className="mc">
          <div className="mc-label">Spending (30 Days)</div>
          <div className="mc-val">₹{stats.monthSpent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Total Users</div>
          <div className="mc-val">{users.length}</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginTop: 32, marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Credit Balance</span>
          <span style={{ fontSize: 12, color: "#666" }}>
            {fmtNum(stats.totalRemaining)} / {fmtNum(stats.totalPurchased)}
          </span>
        </div>
        <div style={{ height: 12, background: "#e8eef9", borderRadius: 6, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(remainingPercent, 100)}%`,
              background: isLow ? "#e74c3c" : "#27ae60",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        {isLow && (
          <div style={{ fontSize: 12, color: "#e74c3c", marginTop: 8, fontWeight: 500 }}>
            ⚠️ Credits running low. Consider purchasing more soon.
          </div>
        )}
      </div>

      {/* Provider Grid */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#0f172a" }}>API Providers</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {providerRates.map((rate) => {
            const spent = stats.byProvider[rate.provider_name]?.cost || 0;
            const count = stats.byProvider[rate.provider_name]?.count || 0;
            return (
              <div
                key={rate.id}
                style={{
                  padding: 16,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: "white",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#0066cc";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,102,204,0.1)";
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#ddd";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#0f172a" }}>
                  {rate.provider_name}
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ color: "#666", marginBottom: 2 }}>Rate</div>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>
                      ₹{parseFloat(String(rate.cost_per_unit || 0)).toFixed(6)} {rate.unit_description}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#666", marginBottom: 2 }}>Usage (30d)</div>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>
                      {count} calls • ₹{spent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Users */}
      <div className="section" style={{ marginTop: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#0f172a" }}>Top Consumers (30 Days)</div>
        {stats.topUsers.length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, padding: "20px", textAlign: "center" }}>
            No usage recorded yet
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>User</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Credits Used</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>API Cost (₹)</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.topUsers.map((tu, idx) => (
                  <tr key={tu.user.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px" }}>
                      <div style={{ fontWeight: 500 }}>{tu.user.full_name || tu.user.email}</div>
                      <div style={{ fontSize: 11, color: "#999" }}>{tu.user.email}</div>
                    </td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{fmtNum(tu.user.credits_used ?? 0)}</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>
                      ₹{tu.spent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#666" }}>
                      {stats.monthSpent > 0 ? ((tu.spent / stats.monthSpent) * 100).toFixed(1) : "0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Provider */}
      {stats.topProvider && (
        <div className="section" style={{ marginTop: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#0f172a" }}>
            Top Spending Provider (30 Days)
          </div>
          <div style={{ padding: 20, background: "#f9f9f9", borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{stats.topProvider[0]}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>API Calls</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
                  {stats.topProvider[1].count}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>Cost</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
                  ₹{stats.topProvider[1].cost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>% of Total Spend</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
                  {stats.monthSpent > 0 ? ((stats.topProvider[1].cost / stats.monthSpent) * 100).toFixed(1) : "0"}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spending by Provider */}
      <div className="section" style={{ marginTop: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#0f172a" }}>Spending by Provider (30 Days)</div>
        {Object.entries(stats.byProvider).length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, padding: "20px", textAlign: "center" }}>
            No API usage recorded yet
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>API Calls</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Cost (₹)</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byProvider)
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([provider, data]) => (
                    <tr key={provider} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "12px", fontWeight: 500 }}>{provider}</td>
                      <td style={{ padding: "12px", textAlign: "right", color: "#666" }}>{data.count}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>
                        ₹{data.cost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", color: "#666" }}>
                        {stats.monthSpent > 0 ? ((data.cost / stats.monthSpent) * 100).toFixed(1) : "0"}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Purchase History */}
      <div className="section" style={{ marginTop: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#0f172a" }}>Purchase History</div>
        {providerPurchases.length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, padding: "20px", textAlign: "center" }}>
            No purchases recorded yet
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Units</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Cost (₹)</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {providerPurchases.map((purchase) => (
                  <tr key={purchase.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px", color: "#666" }}>
                      {purchase.purchase_date ? new Date(purchase.purchase_date).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td style={{ padding: "12px", fontWeight: 500 }}>{purchase.provider_name}</td>
                    <td style={{ padding: "12px", textAlign: "right", color: "#666" }}>{fmtNum(purchase.units_purchased ?? 0)}</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>
                      ₹{(purchase.cost_inr ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "12px", color: "#999", fontSize: 12 }}>{purchase.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditsDashboard;
