import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/components/admin/format";
import type { Database, Json } from "@/integrations/supabase/types";

type ProviderRow = Database["public"]["Tables"]["provider_configs"]["Row"];

type FormState = {
  provider_name: string;
  api_key: string;
  is_active: boolean;
  notes: string;
  base_url: string;
  unit_rate: string;
  unit_description: string;
  units_purchased: string;
  cost_paid: string;
};

const EMPTY: FormState = {
  provider_name: "",
  api_key: "",
  is_active: true,
  notes: "",
  base_url: "",
  unit_rate: "",
  unit_description: "",
  units_purchased: "",
  cost_paid: ""
};

const readConfig = (cfg: Json | null): { notes: string; base_url: string } => {
  if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
    return {
      notes: typeof cfg.notes === "string" ? cfg.notes : "",
      base_url: typeof cfg.base_url === "string" ? cfg.base_url : "",
    };
  }
  return { notes: "", base_url: "" };
};

const maskKey = (encrypted: string): string => {
  if (!encrypted) return "—";
  if (encrypted.length <= 8) return "••••";
  return `••••${encrypted.slice(-4)}`;
};

const Providers = () => {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showKey, setShowKey] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("provider_configs")
      .select("*")
      .order("provider_name", { ascending: true });
    if (error) {
      console.error(error);
      toast.error("Failed to load providers");
      setProviders([]);
    } else {
      setProviders(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowDrawer(true);
    setShowKey(false);
  };

  const openEdit = (p: ProviderRow) => {
    const { notes, base_url } = readConfig(p.config_json);
    setEditingId(p.id);
    setForm({
      provider_name: p.provider_name,
      api_key: "",
      is_active: p.is_active,
      notes,
      base_url,
    });
    setShowDrawer(true);
    setShowKey(false);
  };

  const save = async () => {
    if (!form.provider_name.trim()) {
      toast.error("Provider name is required");
      return;
    }
    const config_json: Json = { notes: form.notes, base_url: form.base_url };
    try {
      if (editingId) {
        const update: Database["public"]["Tables"]["provider_configs"]["Update"] = {
          provider_name: form.provider_name,
          is_active: form.is_active,
          config_json,
        };
        if (form.api_key) update.api_key_encrypted = form.api_key;
        const { error } = await supabase.from("provider_configs").update(update).eq("id", editingId);
        if (error) throw error;
        toast.success(`Provider updated: ${form.provider_name}`);
      } else {
        if (!form.api_key.trim()) {
          toast.error("API key is required for a new provider");
          return;
        }
        const { error } = await supabase.from("provider_configs").insert({
          provider_name: form.provider_name,
          api_key_encrypted: form.api_key,
          is_active: form.is_active,
          config_json,
        });
        if (error) throw error;
        toast.success(`Provider added: ${form.provider_name}`);
      }

      // Save unit rate if provided
      if (form.unit_rate) {
        const unitRate = parseFloat(form.unit_rate);
        const { error: rateError } = await supabase.from("api_provider_rates").upsert({
          provider_name: form.provider_name,
          cost_per_unit: unitRate,
          unit_description: form.unit_description || "unit",
          currency: "INR",
        }, { onConflict: "provider_name" });
        if (rateError) {
          console.error("Failed to save rate:", rateError);
          toast.warning("Provider saved, but rate update failed");
        }
      }

      // Log purchase if provided
      if (form.units_purchased && form.cost_paid) {
        const unitsPurchased = parseInt(form.units_purchased, 10);
        const costInr = parseFloat(form.cost_paid);
        if (unitsPurchased > 0 && costInr > 0) {
          const { error: purchaseError } = await supabase.from("provider_purchases").insert({
            provider_name: form.provider_name,
            purchase_date: new Date().toISOString().split("T")[0],
            units_purchased: unitsPurchased,
            cost_inr: costInr,
            notes: `Initial purchase via provider setup`,
          });
          if (purchaseError) {
            console.error("Failed to log purchase:", purchaseError);
            toast.warning("Provider saved, but purchase log failed");
          }
        }
      }

      setShowDrawer(false);
      void load();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save provider");
    }
  };

  const toggleStatus = async (p: ProviderRow) => {
    const { error } = await supabase
      .from("provider_configs")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    toast.success(`${p.provider_name} ${!p.is_active ? "enabled" : "disabled"}`);
    void load();
  };

  if (loading) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading providers…</div>;
  }

  return (
    <div data-testid="page-admin-providers">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">API providers</div>
            <div className="ph-sub">Manage third-party API keys and configuration</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-primary" onClick={openAdd}>
              + Add provider
            </button>
          </div>
        </div>
      </div>

      <div className="metrics" style={{ marginBottom: "1.25rem" }}>
        <div className="mc">
          <div className="mc-label">Total providers</div>
          <div className="mc-val">{providers.length}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Active</div>
          <div className="mc-val g">{providers.filter((p) => p.is_active).length}</div>
        </div>
        <div className="mc">
          <div className="mc-label">Inactive</div>
          <div className="mc-val r">{providers.filter((p) => !p.is_active).length}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 12,
          marginBottom: "1.25rem",
        }}
      >
        {providers.length === 0 ? (
          <div style={{ color: "var(--txt2)", fontSize: 13, gridColumn: "1 / -1", padding: "2rem", textAlign: "center" }}>
            No providers configured yet.
          </div>
        ) : (
          providers.map((p) => {
            const { notes, base_url } = readConfig(p.config_json);
            const badge = p.is_active ? (
              <span className="badge b-green">Active</span>
            ) : (
              <span className="badge b-gray">Inactive</span>
            );
            return (
              <div
                key={p.id}
                style={{
                  background: "var(--bg0)",
                  border: "0.5px solid var(--bdr0)",
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "0.5px solid var(--bdr0)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--txt0)" }}>{p.provider_name}</div>
                    <div style={{ fontSize: 11, color: "var(--txt2)" }}>
                      Updated {fmtDateTime(p.updated_at)}
                    </div>
                  </div>
                  {badge}
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <div
                    style={{
                      background: "var(--bg1)",
                      borderRadius: "var(--r-md)",
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 12,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "var(--txt2)" }}>KEY</span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11,
                        color: "var(--txt1)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {maskKey(p.api_key_encrypted)}
                    </span>
                  </div>
                  {base_url && (
                    <div style={{ fontSize: 11.5, color: "var(--txt1)", marginBottom: 8, wordBreak: "break-all" }}>
                      {base_url}
                    </div>
                  )}
                  {notes && (
                    <div style={{ fontSize: 11.5, color: "var(--txt1)", marginBottom: 12 }}>{notes}</div>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" style={{ flex: 1, fontSize: 12 }} onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    {p.is_active ? (
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 12 }}
                        onClick={() => void toggleStatus(p)}
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12 }}
                        onClick={() => void toggleStatus(p)}
                      >
                        Enable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showDrawer && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDrawer(false);
          }}
        >
          <div className="modal-card">
            <div className="modal-head">
              <span className="modal-title">
                {editingId ? `Edit ${form.provider_name}` : "Add API provider"}
              </span>
              <button className="btn" style={{ padding: "4px 10px" }} onClick={() => setShowDrawer(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div>
                <div className="field-label">Provider name</div>
                <input
                  className="inp inp-full"
                  placeholder="e.g. anthropic, openai, elevenlabs…"
                  value={form.provider_name}
                  onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
                />
              </div>
              <div>
                <div className="field-label">
                  API key{" "}
                  <span className="field-hint">
                    {editingId ? "(leave blank to keep current)" : "(stored encrypted)"}
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    className="inp inp-full inp-mono"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-…"
                    style={{ paddingRight: 40 }}
                    value={form.api_key}
                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((s) => !s)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "var(--txt2)",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    👁
                  </button>
                </div>
              </div>
              <div>
                <div className="field-label">
                  Base URL <span className="field-hint">(optional)</span>
                </div>
                <input
                  className="inp inp-full"
                  placeholder="https://api.provider.com/v1"
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                />
              </div>
              {/* Pricing Section */}
              <div style={{ borderTop: "1px solid #ddd", paddingTop: 16, marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#0f172a" }}>Pricing & Usage</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div className="field-label">Unit Rate (₹)</div>
                    <input
                      className="inp inp-full"
                      type="number"
                      placeholder="0.055"
                      step="0.0001"
                      value={form.unit_rate}
                      onChange={(e) => setForm({ ...form, unit_rate: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="field-label">Unit Description</div>
                    <input
                      className="inp inp-full"
                      placeholder="e.g. per image, per token"
                      value={form.unit_description}
                      onChange={(e) => setForm({ ...form, unit_description: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div className="field-label">Units Purchased</div>
                    <input
                      className="inp inp-full"
                      type="number"
                      placeholder="1000"
                      value={form.units_purchased}
                      onChange={(e) => setForm({ ...form, units_purchased: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="field-label">Cost Paid (₹)</div>
                    <input
                      className="inp inp-full"
                      type="number"
                      placeholder="55.00"
                      step="0.01"
                      value={form.cost_paid}
                      onChange={(e) => setForm({ ...form, cost_paid: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="field-label">Notes</div>
                <textarea
                  className="inp inp-full"
                  rows={2}
                  placeholder="Tier, rate limits, owner…"
                  style={{ resize: "vertical", lineHeight: 1.5 }}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className={"tog" + (form.is_active ? " on" : "")}
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  aria-label="toggle active"
                />
                <span style={{ fontSize: 12, color: "var(--txt1)" }}>
                  {form.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, paddingTop: 4, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setShowDrawer(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => void save()}>
                  Save provider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Providers;
