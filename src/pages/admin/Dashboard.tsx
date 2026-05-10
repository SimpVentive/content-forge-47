import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtINR, fmtNum } from "@/components/admin/format";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type Stats = {
  activeUsers: number;
  totalUsers: number;
  creditsSold: number;
  creditsConsumed: number;
  creditsRemaining: number;
  openTickets: number;
  topUsers: Profile[];
  monthRevenue: number;
};

const Dashboard = () => {
  const nav = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [profilesRes, txRes, ticketsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("billing_transactions").select("amount_inr,credits_purchased,status,created_at"),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (txRes.error) throw txRes.error;

      const profiles = profilesRes.data ?? [];
      const tx = txRes.data ?? [];

      const activeUsers = profiles.filter((p) => p.status === "active").length;
      const creditsSold = tx
        .filter((t) => t.status === "paid")
        .reduce((sum, t) => sum + (t.credits_purchased ?? 0), 0);
      const creditsConsumed = profiles.reduce((sum, p) => sum + (p.credits_used ?? 0), 0);
      const creditsRemaining = profiles.reduce(
        (sum, p) => sum + Math.max(0, (p.credits_total ?? 0) - (p.credits_used ?? 0)),
        0,
      );
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthRevenue = tx
        .filter((t) => t.status === "paid" && new Date(t.created_at) >= monthStart)
        .reduce((sum, t) => sum + (t.amount_inr ?? 0), 0);
      const topUsers = [...profiles].sort((a, b) => (b.credits_used ?? 0) - (a.credits_used ?? 0)).slice(0, 5);

      setStats({
        activeUsers,
        totalUsers: profiles.length,
        creditsSold,
        creditsConsumed,
        creditsRemaining,
        openTickets: ticketsRes.count ?? 0,
        topUsers,
        monthRevenue,
      });
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading || !stats) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading dashboard…</div>;
  }

  const utilisation =
    stats.creditsConsumed + stats.creditsRemaining > 0
      ? Math.round(
          (stats.creditsConsumed / (stats.creditsConsumed + stats.creditsRemaining)) * 100,
        )
      : 0;

  return (
    <div data-testid="page-admin-dashboard">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">Platform overview</div>
            <div className="ph-sub">Live data from Supabase</div>
          </div>
          <div className="ph-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                void load();
                toast.success("Dashboard refreshed");
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="metrics">
        <div className="mc">
          <div className="mc-label">Total users</div>
          <div className="mc-val">{fmtNum(stats.totalUsers)}</div>
          <div className="mc-delta">{fmtNum(stats.activeUsers)} active</div>
        </div>
        <div className="mc">
          <div className="mc-label">Revenue (this month)</div>
          <div className="mc-val g">{fmtINR(stats.monthRevenue)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Credits sold</div>
          <div className="mc-val g">{fmtNum(stats.creditsSold)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Credits consumed</div>
          <div className="mc-val">{fmtNum(stats.creditsConsumed)}</div>
          <div className="mc-delta">{utilisation}% utilisation</div>
        </div>
        <div className="mc">
          {/* TODO: wire to real agent cost telemetry once available */}
          <div className="mc-label">Agent cost</div>
          <div className="mc-val a">—</div>
          <div className="mc-delta">Not tracked yet</div>
        </div>
        <div className="mc">
          <div className="mc-label">Open tickets</div>
          <div className="mc-val r">{fmtNum(stats.openTickets)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Top users by credit usage</span>
          <button className="link-btn" onClick={() => nav("/admin/users")}>
            View all →
          </button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "32%" }}>User</th>
                <th style={{ width: "14%" }}>Plan</th>
                <th style={{ width: "14%" }}>Used</th>
                <th style={{ width: "14%" }}>Remaining</th>
                <th style={{ width: "16%" }}>Usage</th>
                <th style={{ width: "10%" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.topUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--txt2)", padding: "2rem" }}>
                    No users yet
                  </td>
                </tr>
              ) : (
                stats.topUsers.map((u) => {
                  const used = u.credits_used ?? 0;
                  const total = u.credits_total ?? 0;
                  const remaining = Math.max(0, total - used);
                  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                  const bc = pct > 85 ? "r" : pct > 60 ? "a" : "";
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.full_name || u.email}
                        <div className="td-muted">{u.email}</div>
                      </td>
                      <td>
                        <span className="badge b-gray">{u.plan}</span>
                      </td>
                      <td>{fmtNum(used)}</td>
                      <td>{fmtNum(remaining)}</td>
                      <td>
                        <div className="bar-wrap">
                          <div className="bar-track">
                            <div className={"bar-fill " + bc} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="bar-pct">{pct}%</span>
                        </div>
                      </td>
                      <td>
                        {u.status === "active" ? (
                          <span className="badge b-green">Active</span>
                        ) : (
                          <span className="badge b-red">{u.status}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Agent health</span>
          </div>
          {/* TODO: wire to real agent health telemetry (latency, error rate) */}
          <div style={{ padding: 16, color: "var(--txt2)", fontSize: 12 }}>
            Agent health telemetry not wired yet.
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <span className="card-title">API costs</span>
          </div>
          {/* TODO: wire to real provider cost data once tracked */}
          <div style={{ padding: 16, color: "var(--txt2)", fontSize: 12 }}>
            Provider cost tracking not wired yet.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
