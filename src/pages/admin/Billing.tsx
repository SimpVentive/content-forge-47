import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtINR, fmtNum, fmtDateTime } from "@/components/admin/format";
import type { Database } from "@/integrations/supabase/types";

type Tx = Database["public"]["Tables"]["billing_transactions"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type TxWithProfile = Tx & { profile: Pick<Profile, "email" | "full_name" | "organization_name"> | null };

type StatusFilter = "all" | "paid" | "created" | "failed";

const Billing = () => {
  const [txs, setTxs] = useState<TxWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("billing_transactions")
      .select("*, profile:profiles!billing_transactions_user_id_fkey(email,full_name,organization_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error(error);
      toast.error("Failed to load billing transactions");
      setTxs([]);
    } else {
      setTxs((data ?? []) as unknown as TxWithProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const paid = txs.filter((t) => t.status === "paid");
    const monthRevenue = paid
      .filter((t) => new Date(t.created_at) >= monthStart)
      .reduce((s, t) => s + (t.amount_inr ?? 0), 0);
    const totalRevenue = paid.reduce((s, t) => s + (t.amount_inr ?? 0), 0);
    const creditsSold = paid.reduce((s, t) => s + (t.credits_purchased ?? 0), 0);
    const failed = txs.filter((t) => t.status === "failed").length;
    const pending = txs.filter((t) => t.status === "created").length;
    return { monthRevenue, totalRevenue, creditsSold, failed, pending, count: txs.length };
  }, [txs]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return txs.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (s) {
        const haystack = `${t.profile?.email ?? ""} ${t.profile?.full_name ?? ""} ${
          t.profile?.organization_name ?? ""
        } ${t.razorpay_order_id ?? ""} ${t.razorpay_payment_id ?? ""}`.toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [txs, statusFilter, search]);

  if (loading) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading transactions…</div>;
  }

  return (
    <div data-testid="page-admin-billing">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">Billing &amp; transactions</div>
            <div className="ph-sub">Razorpay payments and credit purchases</div>
          </div>
        </div>
      </div>

      <div className="metrics">
        <div className="mc">
          <div className="mc-label">Revenue (this month)</div>
          <div className="mc-val g">{fmtINR(stats.monthRevenue)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Revenue (all-time)</div>
          <div className="mc-val">{fmtINR(stats.totalRevenue)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Credits sold</div>
          <div className="mc-val">{fmtNum(stats.creditsSold)}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Pending</div>
          <div className="mc-val a">{stats.pending}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Failed</div>
          <div className="mc-val r">{stats.failed}</div>
        </div>
      </div>

      <div className="search-row">
        <input
          className="inp"
          type="text"
          placeholder="Search user, email, order or payment id…"
          style={{ maxWidth: 360, flex: 1 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["all", "paid", "created", "failed"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            className={"filter-chip" + (statusFilter === s ? " on" : "")}
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Recent transactions</span>
          <span className="card-sub">{filtered.length} shown</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "20%" }}>Date</th>
                <th style={{ width: "26%" }}>User</th>
                <th style={{ width: "12%" }}>Amount</th>
                <th style={{ width: "12%" }}>Credits</th>
                <th style={{ width: "20%" }}>Razorpay payment id</th>
                <th style={{ width: "10%" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--txt2)", padding: "2rem" }}>
                    No transactions match filters
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const badge =
                    t.status === "paid" ? (
                      <span className="badge b-green">Paid</span>
                    ) : t.status === "failed" ? (
                      <span className="badge b-red">Failed</span>
                    ) : (
                      <span className="badge b-amber">Pending</span>
                    );
                  return (
                    <tr key={t.id}>
                      <td className="td-mono">{fmtDateTime(t.created_at)}</td>
                      <td>
                        {t.profile?.full_name || t.profile?.email || "—"}
                        <div className="td-muted">{t.profile?.email ?? ""}</div>
                      </td>
                      <td className="td-mono">{fmtINR(t.amount_inr)}</td>
                      <td className="td-mono">{fmtNum(t.credits_purchased)}</td>
                      <td className="td-mono">{t.razorpay_payment_id || "—"}</td>
                      <td>{badge}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Billing;
