import { Link } from "react-router-dom";
import {
  ArrowRight, Sparkles, CheckCircle2, FileText, GraduationCap, Play, MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { UniTolBadge } from "./UniTolBadge";

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
    <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
    <div className="mt-0.5 truncate text-xs font-medium text-slate-700">{value}</div>
  </div>
);

const MODULES = [
  { n: "01", title: "Welcome & overview", active: false, time: "4 min" },
  { n: "02", title: "Core concepts", active: true, time: "9 min" },
  { n: "03", title: "Real-world examples", active: false, time: "7 min" },
  { n: "04", title: "Knowledge check", active: false, time: "5 min" },
  { n: "05", title: "Wrap-up & SCORM", active: false, time: "3 min" },
];

export const Hero = () => {
  const { isAuthenticated } = useAuth();
  const primaryCta = isAuthenticated
    ? { to: "/dashboard", label: "Create Course" }
    : { to: "/signup", label: "Start Creating" };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/60 via-white to-white">
      <div
        aria-hidden
        className="absolute inset-0 -z-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(226 232 240) 1px, transparent 1px), linear-gradient(to bottom, rgb(226 232 240) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at top, black 40%, transparent 75%)",
        }}
      />
      <div aria-hidden className="absolute -top-24 right-[-10%] h-[460px] w-[460px] rounded-full bg-indigo-400/15 blur-3xl" />
      <div aria-hidden className="absolute top-32 left-[-8%] h-[360px] w-[360px] rounded-full bg-cyan-400/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-medium text-indigo-700 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Multi-agent AI pipeline · LMS-ready SCORM output
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 md:text-6xl">
            Turn raw content into <br />
            <span className="relative inline-block">
              <span className="relative z-10 text-amber-500">world-class courses</span>
              <span aria-hidden className="absolute inset-x-0 -bottom-1 h-3 rounded-full bg-amber-100/70" />
            </span>
            <br />in minutes.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            ContentForge transforms PDFs, notes, and videos into polished, LMS-ready eLearning courses — complete with narration, assessments, and SCORM packaging.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={primaryCta.to}
              data-testid="hero-cta-primary"
              className="group inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#162a45] hover:shadow-lg"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              data-testid="hero-cta-secondary"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              See how it works
            </a>
          </div>

          <div className="mt-8 flex justify-center">
            <UniTolBadge tone="light" />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> No subscription</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Credits never expire</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> SCORM 1.2 & 2004</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Multi-language narration</span>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl" data-testid="hero-preview">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-3 truncate font-mono text-[11px] text-slate-400">
                contentforge.app / editor / onboarding-101
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Generated
              </span>
            </div>

            <div className="grid grid-cols-12 gap-0">
              <aside className="col-span-4 border-r border-slate-100 bg-slate-50/50 p-5 lg:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Modules</span>
                  <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <ul className="space-y-1.5">
                  {MODULES.map((m) => (
                    <li
                      key={m.n}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        m.active ? "bg-amber-50 text-[#1e3a5f] ring-1 ring-amber-200" : "text-slate-600 hover:bg-white"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold ${
                          m.active ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {m.n}
                      </span>
                      <span className="flex-1 truncate text-left">{m.title}</span>
                      <span className="text-[10px] text-slate-400">{m.time}</span>
                    </li>
                  ))}
                </ul>
              </aside>

              <section className="col-span-8 p-6 lg:col-span-9">
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <FileText className="h-3.5 w-3.5" /> Lesson 02 · Core concepts
                </div>
                <h3 className="mt-2 text-xl font-semibold text-[#1e3a5f]">
                  Three principles every learner should know
                </h3>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-[#1e3a5f] to-[#162a45]">
                  <div className="flex h-44 items-center justify-center p-6 text-center">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Sparkles className="h-3 w-3" /> AI-generated slide
                      </span>
                      <h4 className="mt-3 text-lg font-semibold text-white">
                        Principle 01 — <span className="text-amber-400">Start with why</span>
                      </h4>
                      <p className="mx-auto mt-1 max-w-sm text-xs text-indigo-100">
                        Anchor every lesson to a learning objective. The agent extracts these from your source material automatically.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-t border-white/10 bg-black/20 px-4 py-2.5">
                    <button className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[#1e3a5f]" aria-label="Play">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </button>
                    <div className="flex-1">
                      <div className="h-1 rounded-full bg-white/10">
                        <div className="h-1 w-1/3 rounded-full bg-amber-400" />
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-indigo-200">02:14 / 09:00</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <Meta label="Narration" value="Indian English · Female" />
                  <Meta label="Assessment" value="3 MCQs generated" />
                  <Meta label="Format" value="SCORM 2004 ready" />
                </div>
              </section>
            </div>
          </div>

          <div className="absolute -bottom-4 right-6 hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-md md:inline-flex">
            <GraduationCap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-700">
              Generated in <span className="font-semibold text-[#1e3a5f]">6 min 12 sec</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
