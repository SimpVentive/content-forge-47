import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtNum } from "@/components/admin/format";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ApiUsageLog = Database["public"]["Tables"]["api_usage_logs"]["Row"];
type BillingTransaction = Database["public"]["Tables"]["billing_transactions"]["Row"];

interface UserCredit {
  user: Profile;
  usage: ApiUsageLog[];
  totalCostInr: number;
  remaining: number;
}

const Credits = () => {
  const [users, setUsers] = useState<UserCredit[]>([]);
  const [apiUsageLogs, setApiUsageLogs] = useState<ApiUsageLog[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Load all users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");

      if (usersError) throw usersError;

      // Load API usage logs
      const { data: logsData, error: logsError } = await supabase
        .from("api_usage_logs")
        .select("*")
        .gte("created_at", `${dateFrom}T00:00:00Z`)
        .lte("created_at", `${dateTo}T23:59:59Z`)
        .order("created_at", { ascending: false });

      if (logsError) throw logsError;

      // Load billing transactions
      const { data: txData, error: txError } = await supabase
        .from("billing_transactions")
        .select("*")
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      if (txError) throw txError;

      setTransactions(txData || []);

      // Organize data by user
      const userMap = new Map<string, UserCredit>();
      (usersData || []).forEach((u) => {
        userMap.set(u.id, {
          user: u,
          usage: [],
          totalCostInr: 0,
          remaining: Math.max(0, (u.credits_total ?? 0) - (u.credits_used ?? 0)),
        });
      });

      (logsData || []).forEach((log) => {
        const uc = userMap.get(log.user_id);
        if (uc) {
          uc.usage.push(log);
          uc.totalCostInr += log.cost ?? 0;
        }
      });

      setApiUsageLogs(logsData || []);
      setUsers(Array.from(userMap.values()));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load credits data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [dateFrom, dateTo]);

  const companyStats = useMemo(() => {
    const totalPurchased = transactions.reduce((sum, t) => sum + (t.credits_purchased ?? 0), 0);
    const totalUsed = users.reduce((sum, u) => sum + (u.user.credits_used ?? 0), 0);
    const totalRemaining = users.reduce((sum, u) => sum + u.remaining, 0);
    const totalSpentOnApis = apiUsageLogs.reduce((sum, log) => sum + (log.cost ?? 0), 0);

    const byProvider: Record<string, { units: number; cost: number }> = {};
    apiUsageLogs.forEach((log) => {
      const provider = log.provider_name || "Unknown";
      if (!byProvider[provider]) {
        byProvider[provider] = { units: 0, cost: 0 };
      }
      byProvider[provider].units += log.units_used ?? 0;
      byProvider[provider].cost += log.cost ?? 0;
    });

    const byUser: Record<string, number> = {};
    users.forEach((u) => {
      byUser[u.user.id] = u.totalCostInr;
    });

    return { totalPurchased, totalUsed, totalRemaining, totalSpentOnApis, byProvider, byUser };
  }, [users, apiUsageLogs, transactions]);

  const selectedUserData = selectedUser ? users.find((u) => u.user.id === selectedUser) : null;

  if (loading) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading credits…</div>;
  }

  return (
    <div data-testid="page-admin-credits">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">Credits Management</div>
            <div className="ph-sub">Track purchased credits, user consumption, and API costs</div>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div style={{ marginBottom: "24px", display: "flex", gap: "12px", alignItems: "center" }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>Usage Period:</label>
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

      {/* Company-Level Summary */}
      <div className="metrics">
        <div className="mc">
          <div className="mc-label">Total Credits Purchased</div>
          <div className="mc-val g">{fmtNum(companyStats.totalPurchased)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Total Credits Remaining</div>
          <div className="mc-val">{fmtNum(companyStats.totalRemaining)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Spent on APIs (Period)</div>
          <div className="mc-val a">₹{companyStats.totalSpentOnApis.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Users</div>
          <div className="mc-val">{users.length}</div>
        </div>
      </div>

      {/* Spending by Provider */}
      {Object.keys(companyStats.byProvider).length > 0 && (
        <div className="section" style={{ marginTop: "32px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: "16px" }}>API Spending by Provider (Period)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                  <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>Provider</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Units Used</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Cost (INR)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(companyStats.byProvider).map(([provider, data]) => (
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

      {/* User List */}
      <div className="section" style={{ marginTop: "32px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: "16px" }}>Users & Credit Status</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                <th style={{ padding: "12px", textAlign: "left", fontWeight: 600 }}>User</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Total Credits</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Used</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Remaining</th>
                <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>API Cost (Period)</th>
                <th style={{ padding: "12px", textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((uc) => (
                <tr
                  key={uc.user.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    background: selectedUser === uc.user.id ? "#f0f9f8" : "transparent",
                  }}
                >
                  <td style={{ padding: "12px" }}>
                    <div style={{ fontWeight: 500 }}>{uc.user.full_name || uc.user.email}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{uc.user.email}</div>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>{fmtNum(uc.user.credits_total ?? 0)}</td>
                  <td style={{ padding: "12px", textAlign: "right" }}>{fmtNum(uc.user.credits_used ?? 0)}</td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: 500, color: uc.remaining < 100 ? "#e74c3c" : "#27ae60" }}>
                    {fmtNum(uc.remaining)}
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    ₹{uc.totalCostInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: "12px", textAlign: "center" }}>
                    <button
                      onClick={() => setSelectedUser(selectedUser === uc.user.id ? null : uc.user.id)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        borderRadius: 3,
                        border: "1px solid #0066cc",
                        background: "white",
                        color: "#0066cc",
                        cursor: "pointer",
                      }}
                    >
                      {selectedUser === uc.user.id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected User Details */}
      {selectedUserData && (
        <div className="section" style={{ marginTop: "32px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: "16px" }}>
            Usage Details: {selectedUserData.user.full_name || selectedUserData.user.email}
          </div>
          {selectedUserData.usage.length === 0 ? (
            <div style={{ color: "#999", fontSize: 13, padding: "20px", textAlign: "center" }}>
              No API usage recorded for this period
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ddd", background: "#f9f9f9" }}>
                    <th style={{ padding: "10px", textAlign: "left", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: "10px", textAlign: "left", fontWeight: 600 }}>Provider</th>
                    <th style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>Units</th>
                    <th style={{ padding: "10px", textAlign: "right", fontWeight: 600 }}>Cost (INR)</th>
                    <th style={{ padding: "10px", textAlign: "left", fontWeight: 600 }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedUserData.usage.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: "10px" }}>{log.provider_name}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>{fmtNum(log.units_used ?? 0)}</td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 500 }}>
                        ₹{(log.cost ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: "10px", color: "#666" }}>{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Credits;
