import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtNum, fmtDate } from "@/components/admin/format";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "active", label: "Active only" },
  { key: "low", label: "Low credits" },
  { key: "stopped", label: "Stopped" },
  { key: "individual", label: "Individual" },
  { key: "organization", label: "Organization" },
];

type ChipKey = "active" | "low" | "stopped" | "individual" | "organization";

const Users = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [chips, setChips] = useState<Partial<Record<ChipKey, boolean>>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Failed to load users");
      setUsers([]);
    } else {
      setUsers(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleChip = (k: ChipKey) => setChips((c) => ({ ...c, [k]: !c[k] }));

  const toggleAccess = async (u: Profile) => {
    const next = u.status === "active" ? "stopped" : "active";
    const { error } = await supabase.from("profiles").update({ status: next }).eq("id", u.id);
    if (error) {
      toast.error("Failed to update access");
      return;
    }
    toast.success(next === "active" ? `Access restored for ${u.email}` : `Access stopped for ${u.email}`);
    void load();
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return users.filter((u) => {
      if (s) {
        const haystack = `${u.full_name ?? ""} ${u.email} ${u.organization_name ?? ""}`.toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      const remaining = Math.max(0, (u.credits_total ?? 0) - (u.credits_used ?? 0));
      if (chips.active && u.status !== "active") return false;
      if (chips.low && remaining > 20) return false;
      if (chips.stopped && u.status === "active") return false;
      if (chips.individual && u.account_type !== "individual") return false;
      if (chips.organization && u.account_type !== "organization") return false;
      return true;
    });
  }, [users, search, chips]);

  const stats = useMemo(
    () => ({
      total: users.length,
      ind: users.filter((u) => u.account_type === "individual").length,
      org: users.filter((u) => u.account_type === "organization").length,
      active: users.filter((u) => u.status === "active").length,
      atRisk: users.filter((u) => {
        const remaining = Math.max(0, (u.credits_total ?? 0) - (u.credits_used ?? 0));
        return u.status !== "active" || remaining <= 20;
      }).length,
    }),
    [users],
  );

  if (loading) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading users…</div>;
  }

  return (
    <div data-testid="page-admin-users">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">User management</div>
            <div className="ph-sub">Monitor usage, manage credits, and control access</div>
          </div>
        </div>
      </div>

      <div className="search-row">
        <input
          className="inp"
          type="text"
          placeholder="Search name, email, organization…"
          style={{ maxWidth: 320, flex: 1 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {CHIPS.map((c) => (
          <button
            key={c.key}
            className={"filter-chip" + (chips[c.key] ? " on" : "")}
            onClick={() => toggleChip(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="metrics" style={{ marginBottom: "1rem" }}>
        <div className="mc">
          <div className="mc-label">Total users</div>
          <div className="mc-val">{stats.total}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Individual</div>
          <div className="mc-val" style={{ color: "var(--blue)" }}>{stats.ind}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Organization</div>
          <div className="mc-val p">{stats.org}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Active</div>
          <div className="mc-val g">{stats.active}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Low / stopped</div>
          <div className="mc-val r">{stats.atRisk}</div>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "22%" }}>User</th>
                <th style={{ width: "10%" }}>Type</th>
                <th style={{ width: "16%" }}>Organization</th>
                <th style={{ width: "8%" }}>Plan</th>
                <th style={{ width: "9%" }}>Credits left</th>
                <th style={{ width: "9%" }}>Used</th>
                <th style={{ width: "12%" }}>Joined</th>
                <th style={{ width: "9%" }}>Status</th>
                <th style={{ width: "5%" }}>Access</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--txt2)", padding: "2rem" }}>
                    No users match filters
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const used = u.credits_used ?? 0;
                  const remaining = Math.max(0, (u.credits_total ?? 0) - used);
                  const isStopped = u.status !== "active";
                  const lowCredits = remaining <= 20 && !isStopped;
                  const sb = isStopped ? (
                    <span className="badge b-red">Stopped</span>
                  ) : lowCredits ? (
                    <span className="badge b-amber">Low</span>
                  ) : (
                    <span className="badge b-green">Active</span>
                  );
                  const typeBadge =
                    u.account_type === "organization" ? (
                      <span className="badge b-purple">Org</span>
                    ) : (
                      <span className="badge b-blue">Indiv</span>
                    );
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.full_name || u.email}
                        <div className="td-muted">{u.email}</div>
                      </td>
                      <td>{typeBadge}</td>
                      <td style={{ fontSize: 12, color: "var(--txt1)" }}>
                        {u.organization_name || <span style={{ color: "var(--txt3)" }}>—</span>}
                      </td>
                      <td>
                        <span className="badge b-gray">{u.plan}</span>
                      </td>
                      <td>{fmtNum(remaining)}</td>
                      <td>{fmtNum(used)}</td>
                      <td className="td-mono">{fmtDate(u.created_at)}</td>
                      <td>{sb}</td>
                      <td>
                        <button
                          className={"tog" + (!isStopped ? " on" : "")}
                          onClick={() => void toggleAccess(u)}
                          aria-label="toggle access"
                        />
                      </td>
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

export default Users;
