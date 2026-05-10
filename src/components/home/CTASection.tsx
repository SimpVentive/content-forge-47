import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const CTASection = () => {
  const { isAuthenticated } = useAuth();
  const primaryCta = isAuthenticated
    ? { to: "/forge", label: "Go to Dashboard" }
    : { to: "/signup", label: "Get started" };

  return (
    <section className="pb-24 pt-4">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 px-8 py-16 text-center md:px-16">
          <div aria-hidden className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div aria-hidden className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />

          <span className="relative inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100 backdrop-blur">
            1 credit = 1 minute of content
          </span>
          <h2 className="relative mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Ready to forge your first course?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-indigo-100">
            Pick a credit pack, upload your material, and let the agents do the heavy lifting. Your first course goes live today.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={primaryCta.to}
              data-testid="cta-primary"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#pricing"
              data-testid="cta-pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
            >
              View pricing
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
