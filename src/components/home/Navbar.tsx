import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "./BrandLogo";

const LINKS: { to: string; label: string; matchPath?: string }[] = [
  { to: "/", label: "Home", matchPath: "/" },
  { to: "/#features", label: "Features" },
  { to: "/#pricing", label: "Pricing" },
];

export const Navbar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, isAuthenticated, signOut } = useAuth();
  const [openMobile, setOpenMobile] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setOpenMenu(false);
    navigate("/");
  };

  const displayName = profile?.full_name || profile?.email || user?.email || "U";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-md" data-testid="main-navbar">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <BrandLogo size="sm" />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.matchPath ? pathname === l.matchPath : false;
            return (
              <Link
                key={l.to}
                to={l.to}
                data-testid={`nav-${l.label.toLowerCase().replace(" ", "-")}`}
                className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "text-indigo-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-indigo-600" />}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <div className="relative">
              <button
                data-testid="user-menu-btn"
                onClick={() => setOpenMenu((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold uppercase text-white">
                  {initial}
                </span>
                <span className="max-w-[120px] truncate">{displayName}</span>
              </button>

              {openMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
                  data-testid="user-menu"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-xs text-slate-500">Signed in as</div>
                    <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
                      {profile?.email || user?.email}
                    </div>
                  </div>
                  <Link
                    to="/new-course"
                    onClick={() => setOpenMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setOpenMenu(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      data-testid="nav-admin"
                    >
                      <ShieldCheck className="h-4 w-4" /> Admin
                    </Link>
                  )}
                  <button
                    data-testid="signout-btn"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="nav-login"
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Login
              </Link>
              <Link
                to="/signup"
                data-testid="nav-signup"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100"
          onClick={() => setOpenMobile((v) => !v)}
          data-testid="mobile-menu-toggle"
          aria-label="Toggle menu"
        >
          {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {openMobile && (
        <div className="border-t border-slate-200 bg-white md:hidden" data-testid="mobile-menu">
          <div className="flex flex-col gap-1 px-4 py-3">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpenMobile(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  l.matchPath && pathname === l.matchPath
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {l.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  to="/new-course"
                  onClick={() => setOpenMobile(false)}
                  className="mt-2 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Go to Dashboard
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpenMobile(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="rounded-lg bg-rose-50 px-3 py-2 text-left text-sm font-medium text-rose-600"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpenMobile(false)}
                  className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-medium text-slate-700"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpenMobile(false)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
