import { Link } from "react-router-dom";
import { Twitter, Linkedin, Github, Mail } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

const UTS_LOGO =
  "https://customer-assets.emergentagent.com/job_design-preview-170/artifacts/0ypv4cme_uts.png";

const COLS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Home", to: "/" },
      { label: "Features", to: "/#features" },
      { label: "Pricing", to: "/#pricing" },
      { label: "Forge", to: "/forge" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", to: "/#about" },
      { label: "Careers", to: "#" },
      { label: "Contact", to: "#" },
      { label: "Press", to: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", to: "/help" },
      { label: "API reference", to: "#" },
      { label: "Changelog", to: "#" },
      { label: "Support", to: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", to: "#" },
      { label: "Privacy", to: "#" },
      { label: "Refund policy", to: "#" },
      { label: "GST / tax", to: "#" },
    ],
  },
];

export const Footer = () => (
  <footer className="border-t border-slate-200 bg-white" data-testid="site-footer">
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="grid gap-10 md:grid-cols-6">
        <div className="md:col-span-2">
          <BrandLogo size="md" />
          <p className="mt-4 max-w-xs text-sm text-slate-600">
            Transform your raw content into published, LMS-ready eLearning courses in minutes — powered by a multi-agent AI pipeline.
          </p>
          <div className="mt-6 flex items-center gap-3">
            {[Twitter, Linkedin, Github, Mail].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-indigo-600 hover:text-indigo-600"
                data-testid={`social-${i}`}
                aria-label="Social link"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {COLS.map((col) => (
          <div key={col.title}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-900">{col.title}</div>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-slate-600 transition-colors hover:text-indigo-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 border-t border-slate-200 pt-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <a
            href="https://www.unitol.in"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-unitol"
            className="group inline-flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3 transition-colors hover:border-amber-200 hover:bg-amber-50/30"
          >
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
              <img src={UTS_LOGO} alt="UTS" className="h-10 w-10 object-contain" loading="lazy" />
            </span>
            <span className="leading-tight">
              <span className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">An offering of</span>
              <span className="block text-sm font-bold text-[#1e3a5f]">UniTol Training Solutions Pvt Ltd</span>
              <span className="mt-0.5 block text-xs font-medium text-amber-600">www.UniTol.in</span>
            </span>
          </a>
          <div className="text-right text-xs text-slate-500">
            <p>© {new Date().getFullYear()} ContentForge. All rights reserved.</p>
            <p className="mt-1">Made in India · GST-compliant billing · Powered by Razorpay</p>
          </div>
        </div>
      </div>
    </div>
  </footer>
);
