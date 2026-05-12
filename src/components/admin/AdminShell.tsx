import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import "./admin.css";

type NavItem = { to: string; end?: boolean; name: string; tid: string; icon: JSX.Element };
type NavSection = { label: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        to: "/admin",
        end: true,
        name: "Dashboard",
        tid: "nav-dashboard",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        ),
      },
      {
        to: "/admin/users",
        name: "Users",
        tid: "nav-users",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 12c0-2.21 2.24-4 5-4s5 1.79 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Financials",
    items: [
      {
        to: "/admin/billing",
        name: "Billing",
        tid: "nav-billing",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1 6h12" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        to: "/admin/providers",
        name: "API providers",
        tid: "nav-providers",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="8" y="4" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 7h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        to: "/admin/settings",
        name: "Video Settings",
        tid: "nav-settings",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 1v2M7 11v2M13 7h-2M3 7H1M11.1 2.9L9.7 4.3M4.3 9.7L2.9 11.1M11.1 11.1L9.7 9.7M4.3 4.3L2.9 2.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        to: "/admin/conversations",
        name: "Conversations",
        tid: "nav-conversations",
        icon: (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 2h12v8H8l-3 3v-3H1V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
];

const Clock = () => {
  const [t, setT] = useState(() => new Date().toLocaleTimeString("en-IN", { hour12: false }));
  useEffect(() => {
    const i = setInterval(() => setT(new Date().toLocaleTimeString("en-IN", { hour12: false })), 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="topbar-time">{t}</span>;
};

const initialsFrom = (name: string | null | undefined, email: string | null | undefined) => {
  const source = (name ?? email ?? "SA").trim();
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const AdminShell = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = initialsFrom(profile?.full_name, profile?.email);

  return (
    <div className="cf-admin">
      <header className="topbar">
        <div className="logo">
          Content<span className="logo-accent">Forge</span>
          <div className="logo-sep" />
          <span className="logo-sub">Admin Console</span>
        </div>
        <div className="topbar-right">
          <Clock />
          <span className="pill pill-green">Admin</span>
          <button
            className="avatar"
            title="Sign out"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
          >
            {initials}
          </button>
        </div>
      </header>
      <div className="shell">
        <nav className="sidebar">
          {NAV.map((sec) => (
            <div className="nav-section" key={sec.label}>
              <div className="nav-label">{sec.label}</div>
              {sec.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  data-testid={it.tid}
                  className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
                >
                  <div className="nav-icon">{it.icon}</div>
                  {it.name}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <main className="main">
          <div className="content">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
