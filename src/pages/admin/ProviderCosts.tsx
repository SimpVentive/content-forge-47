import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/components/admin/format";
import type { Database } from "@/integrations/supabase/types";

type ProviderRate = Database["public"]["Tables"]["api_provider_rates"]["Row"];
type ProviderPurchase = Database["public"]["Tables"]["provider_purchases"]["Row"];

const ProviderCosts = () => {
  const [rates, setRates] = useState<ProviderRate[]>([]);
  const [purchases, setPurchases] = useState<ProviderPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const load = async () => {
    setLoading(true);
    try {
      // Load provider rates
      const { data: ratesData, error: ratesError } = await supabase
        .from("api_provider_rates")
        .select("*")
        .order("provider_name");

      if (ratesError) throw ratesError;
      setRates(ratesData || []);

      // Load purchase history
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("provider_purchases")
        .select("*")
        .gte("purchase_date", dateFrom)
        .lte("purchase_date", dateTo)
        .order("purchase_date", { ascending: false });

      if (purchasesError) throw purchasesError;
      setPurchases(purchasesData || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load provider costs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalCost = purchases.reduce((sum, p) => sum + (p.cost_inr ?? 0), 0);
    const totalUnits = purchases.reduce((sum, p) => sum + (p.units_purchased ?? 0), 0);
    const byProvider: Record<string, { cost: number; units: number }> = {};

    purchases.forEach((p) => {
      const provider = p.provider_name || "Unknown";
      if (!byProvider[provider]) {
        byProvider[provider] = { cost: 0, units: 0 };
      }
      byProvider[provider].cost += p.cost_inr ?? 0;
      byProvider[provider].units += p.units_purchased ?? 0;
    });

    return { totalCost, totalUnits, byProvider };
  }, [purchases]);

  if (loading) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading provider costs…</div>;
  }

  return (
    <div data-testid="page-admin-provider-costs">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">API Provider Costs</div>
            <div className="ph-sub">Track API provider rates, spending, and purchases</div>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div style={{ marginBottom: "24px", display: "flex", gap: "12px", alignItems: "center" }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Period:</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{ padding: "6px 8px", fontSize: 13, borderRadius: 4, border: "1px solid #ddd" }}
        />
        <span style={{ fontSize: 13, color: "#999" }}>to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{ padding: "6px 8px", fontSize: 13, borderRadius: 4, border: "1px solid #ddd" }}
        />
      </div>

      {/* Summary Stats */}
      <div className="metrics">
        <div className="mc">
          <div className="mc-label">Total Spending (Period)</div>
          <div className="mc-val">₹{stats.totalCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Total Units Purchased</div>
          <div className="mc-val">{fmtNum(stats.totalUnits)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Providers</div>
          <div className="mc-val">{rates.length}</div>
        </div>
      </div>

      {/* Provider Rates Table */}
      <div className="section" style={{ marginTop: "32px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: "16px" }}>Provider Rates</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Provider</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Cost</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Unit</th>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px" }}>{rate.provider_name}</td>
                  <td style={{ padding: "12px" }}>
                    ${parseFloat(String(rate.cost_per_unit || 0)).toFixed(6)}
                  </td>
                  <td style={{ padding: "12px" }}>{rate.unit_description}</td>
                  <td style={{ padding: "12px", color: "#666" }}>{rate.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spending by Provider */}
      {Object.keys(stats.byProvider).length > 0 && (
        <div className="section" style={{ marginTop: "32px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: "16px" }}>Spending by Provider (Period)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Units</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Spending</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byProvider).map(([provider, data]) => (
                  <tr key={provider} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px" }}>{provider}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{fmtNum(data.units)}</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>
                      ₹{data.cost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase History */}
      <div className="section" style={{ marginTop: "32px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: "16px" }}>Purchase History</div>
        {purchases.length === 0 ? (
          <div style={{ color: "#999", fontSize: 13, padding: "20px", textAlign: "center" }}>
            No purchases recorded for this period
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Date</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Units</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Cost (INR)</th>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px" }}>{new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td style={{ padding: "12px" }}>{p.provider_name}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{fmtNum(p.units_purchased || 0)}</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>
                      ₹{(p.cost_inr || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "12px", color: "#666" }}>{p.notes}</td>
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

export default ProviderCosts;
