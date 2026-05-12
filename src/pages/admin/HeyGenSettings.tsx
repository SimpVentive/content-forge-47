import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ExternalLink } from "lucide-react";

interface HeyGenConfig {
  apiKey: string;
  accountId: string;
  defaultAvatar: "rachel" | "josh" | "anna";
  defaultVideoQuality: "720p" | "1080p" | "4k";
  costPerMinute: number;
}

const HeyGenSettings = () => {
  const [config, setConfig] = useState<HeyGenConfig>({
    apiKey: "",
    accountId: "",
    defaultAvatar: "rachel",
    defaultVideoQuality: "1080p",
    costPerMinute: 5,
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        // In real implementation, fetch from backend
        const stored = localStorage.getItem("heygenSettings");
        if (stored) {
          setConfig(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Failed to load HeyGen settings:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleTestConnection = async () => {
    if (!config.apiKey || !config.accountId) {
      toast.error("Please fill in API Key and Account ID before testing");
      return;
    }

    setTesting(true);
    try {
      // In real implementation, call backend endpoint
      // const response = await fetch('/api/admin/heygen/test', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ apiKey: config.apiKey, accountId: config.accountId })
      // });

      // Simulate test for now
      await new Promise(r => setTimeout(r, 2000));

      toast.success("✓ HeyGen API connected successfully");
    } catch (err) {
      toast.error(`✗ Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config.apiKey || !config.accountId || !config.costPerMinute) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // In real implementation, save to backend
      // const response = await fetch('/api/admin/settings/heygen', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(config)
      // });

      localStorage.setItem("heygenSettings", JSON.stringify(config));
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(`Failed to save settings: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setConfig({
      apiKey: "",
      accountId: "",
      defaultAvatar: "rachel",
      defaultVideoQuality: "1080p",
      costPerMinute: 5,
    });
  };

  if (loading && !config.apiKey) {
    return (
      <div style={{ color: "var(--txt2)", fontSize: 13 }}>
        Loading HeyGen settings…
      </div>
    );
  }

  return (
    <div data-testid="page-heygen-settings">
      <div className="ph">
        <div className="ph-top">
          <div>
            <div className="ph-title">Video Generation Settings</div>
            <div className="ph-sub">Configure HeyGen for video course generation</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">HeyGen Configuration</span>
        </div>

        <div style={{ padding: 24 }}>
          <form className="space-y-6">
            {/* API Key */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--txt1)", marginBottom: 8 }}>
                HeyGen API Key
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="sk-****..."
                  className="inp"
                  style={{ width: "100%", paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--txt2)",
                    fontSize: 12,
                  }}
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <p style={{ fontSize: 12, color: "var(--txt2)", marginTop: 4 }}>
                Get your API key from{" "}
                <a href="https://www.heygen.com/api" target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  heygen.com/api <ExternalLink size={12} />
                </a>
              </p>
            </div>

            {/* Account ID */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--txt1)", marginBottom: 8 }}>
                HeyGen Account ID
              </label>
              <input
                type="text"
                value={config.accountId}
                onChange={(e) => setConfig({ ...config, accountId: e.target.value })}
                placeholder="Enter your HeyGen account ID"
                className="inp"
                style={{ width: "100%" }}
              />
              <p style={{ fontSize: 12, color: "var(--txt2)", marginTop: 4 }}>
                Found in your HeyGen account dashboard
              </p>
            </div>

            {/* Default Avatar */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--txt1)", marginBottom: 8 }}>
                Default Avatar for Video Courses
              </label>
              <select
                value={config.defaultAvatar}
                onChange={(e) => setConfig({ ...config, defaultAvatar: e.target.value as any })}
                className="inp"
                style={{ width: "100%" }}
              >
                <option value="rachel">Rachel (Female, Professional)</option>
                <option value="josh">Josh (Male, Professional)</option>
                <option value="anna">Anna (Female, Friendly)</option>
              </select>
              <p style={{ fontSize: 12, color: "var(--txt2)", marginTop: 4 }}>
                Users can override this in VideoSetup
              </p>
            </div>

            {/* Video Quality */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--txt1)", marginBottom: 8 }}>
                Default Video Quality
              </label>
              <select
                value={config.defaultVideoQuality}
                onChange={(e) => setConfig({ ...config, defaultVideoQuality: e.target.value as any })}
                className="inp"
                style={{ width: "100%" }}
              >
                <option value="720p">720p (Fast)</option>
                <option value="1080p">1080p (Standard)</option>
                <option value="4k">4K (Premium)</option>
              </select>
              <p style={{ fontSize: 12, color: "var(--txt2)", marginTop: 4 }}>
                Higher quality = longer generation time
              </p>
            </div>

            {/* Cost Per Minute */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--txt1)", marginBottom: 8 }}>
                Cost per video minute (credits)
              </label>
              <input
                type="number"
                value={config.costPerMinute}
                onChange={(e) => setConfig({ ...config, costPerMinute: parseFloat(e.target.value) || 0 })}
                placeholder="e.g., 5"
                className="inp"
                style={{ width: "100%" }}
                min="1"
                step="0.5"
              />
              <p style={{ fontSize: 12, color: "var(--txt2)", marginTop: 4 }}>
                Used for billing calculation. Adjust based on HeyGen pricing
              </p>
            </div>

            {/* Test Connection */}
            <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                  height: 44,
                  backgroundColor: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: testing ? "not-allowed" : "pointer",
                  opacity: testing ? 0.7 : 1,
                }}
              >
                {testing && <Loader2 size={16} className="animate-spin" />}
                {testing ? "Testing..." : "Test HeyGen Connection"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: 12,
          paddingTop: 20,
          paddingBottom: 20,
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          onClick={handleReset}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary"
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default HeyGenSettings;
