import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { fmtDateTime, relativeTime } from "@/components/admin/format";
import type { Database } from "@/integrations/supabase/types";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Row = Conversation & { profile: Pick<Profile, "email" | "full_name" | "organization_name"> | null };

type Tab = "all" | "open" | "resolved";

const initialsOf = (name: string | null | undefined, email: string) => {
  const src = (name && name.trim()) || email;
  return src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const Conversations = () => {
  const [convos, setConvos] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("*, profile:profiles!conversations_user_id_fkey(email,full_name,organization_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error(error);
      toast.error("Failed to load conversations");
      setConvos([]);
    } else {
      const rows = (data ?? []) as unknown as Row[];
      setConvos(rows);
      setSelected((curr) => {
        if (!curr) return rows[0] ?? null;
        return rows.find((r) => r.id === curr.id) ?? rows[0] ?? null;
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return convos.filter((c) => {
      if (tab === "open" && c.status !== "open") return false;
      if (tab === "resolved" && c.status !== "resolved") return false;
      if (s) {
        const hay = `${c.subject} ${c.profile?.email ?? ""} ${c.profile?.full_name ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [convos, tab, search]);

  const openCount = useMemo(() => convos.filter((c) => c.status === "open").length, [convos]);

  const toggleResolved = async (c: Row) => {
    setUpdating(true);
    const next = c.status === "open" ? "resolved" : "open";
    const { error } = await supabase.from("conversations").update({ status: next }).eq("id", c.id);
    setUpdating(false);
    if (error) {
      toast.error("Failed to update conversation");
      return;
    }
    toast.success(next === "resolved" ? "Marked resolved" : "Reopened");
    void load();
  };

  if (loading) {
    return <div style={{ color: "var(--txt2)", fontSize: 13 }}>Loading conversations…</div>;
  }

  return (
    <div data-testid="page-admin-conversations">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">Support conversations</div>
            <div className="ph-sub">User-initiated tickets and messages</div>
          </div>
        </div>
      </div>
      <div className="comms-layout">
        <div className="comms-list">
          <div className="comms-list-head">
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--txt0)" }}>Conversations</span>
            {openCount > 0 && <span className="badge b-red">{openCount} open</span>}
          </div>
          <div className="comms-search">
            <input
              className="inp inp-full"
              type="text"
              placeholder="Search subject or user…"
              style={{ fontSize: 12, padding: "6px 10px" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="comms-tabs">
            {(["all", "open", "resolved"] as Tab[]).map((t) => (
              <button
                key={t}
                className={"comms-tab" + (tab === t ? " active" : "")}
                onClick={() => setTab(t)}
              >
                {t === "all" ? "All" : t === "open" ? "Open" : "Resolved"}
              </button>
            ))}
          </div>
          <div className="convo-list">
            {filtered.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--txt2)", fontSize: 12 }}>
                No conversations
              </div>
            ) : (
              filtered.map((c) => {
                const active = selected?.id === c.id;
                const email = c.profile?.email ?? "—";
                const display = c.profile?.full_name || email;
                return (
                  <div
                    key={c.id}
                    className={"convo-item" + (active ? " active" : "")}
                    onClick={() => setSelected(c)}
                  >
                    {c.status === "open" ? <div className="unread-dot" /> : <div style={{ width: 7, flexShrink: 0 }} />}
                    <div className="convo-avatar" style={{ background: "var(--purple-l)", color: "var(--purple-d)" }}>
                      {initialsOf(c.profile?.full_name, email)}
                    </div>
                    <div className="convo-info">
                      <div className="convo-name">
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {display}
                        </span>
                        <span className="convo-time">{relativeTime(c.created_at)}</span>
                      </div>
                      <div className="convo-preview">{c.subject}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="chat-panel">
          {selected ? (
            <>
              <div className="chat-head">
                <div className="chat-user-info">
                  <div className="convo-avatar" style={{ background: "var(--purple-l)", color: "var(--purple-d)", fontSize: 13 }}>
                    {initialsOf(selected.profile?.full_name, selected.profile?.email ?? "")}
                  </div>
                  <div>
                    <div className="chat-user-name">{selected.profile?.full_name || selected.profile?.email || "—"}</div>
                    <div className="chat-user-sub">
                      <span
                        className={
                          "status-dot " + (selected.status === "open" ? "sd-a" : "sd-g")
                        }
                      />
                      {selected.status === "open" ? "Open" : "Resolved"}
                      {selected.profile?.email ? ` · ${selected.profile.email}` : ""}
                    </div>
                  </div>
                </div>
                <div className="chat-actions">
                  <button
                    className={selected.status === "open" ? "btn btn-primary" : "btn"}
                    disabled={updating}
                    onClick={() => void toggleResolved(selected)}
                  >
                    {selected.status === "open" ? "Mark resolved" : "Reopen"}
                  </button>
                </div>
              </div>
              <div style={{ padding: 16, color: "var(--txt0)" }}>
                <div style={{ fontSize: 12, color: "var(--txt2)", marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{selected.subject}</div>
                <div style={{ fontSize: 12, color: "var(--txt2)" }}>Created</div>
                <div style={{ fontSize: 13 }}>{fmtDateTime(selected.created_at)}</div>
              </div>
              <div className="chat-messages">
                {/* TODO: wire to a `messages` table once it exists; conversations table currently has no message rows */}
                <div style={{ color: "var(--txt2)", fontSize: 12, textAlign: "center", margin: "auto" }}>
                  Message thread not wired yet.
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--txt2)",
                fontSize: 13,
              }}
            >
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Conversations;
