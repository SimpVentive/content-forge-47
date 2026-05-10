import { Bot, BookOpen, Youtube, Mic, Package, ShieldCheck, type LucideIcon } from "lucide-react";

type Feature = { icon: LucideIcon; title: string; desc: string };

const FEATURES: Feature[] = [
  { icon: Bot, title: "AI-Powered Agents", desc: "Specialist agents collaborate on research, writing, lesson planning, assessments, and more." },
  { icon: BookOpen, title: "Structured Courses", desc: "Generate ready-to-publish course structures, lesson plans, and assessment questions from any topic." },
  { icon: Youtube, title: "YouTube Integration", desc: "Pull in existing YouTube videos and automatically enrich them into your course content." },
  { icon: Mic, title: "Narration & Voice", desc: "AI-generated narration in multiple languages with customisable, high-quality voices." },
  { icon: Package, title: "SCORM Export", desc: "Export LMS-ready SCORM 1.2 / SCORM 2004 packages that work with any learning management system." },
  { icon: ShieldCheck, title: "Brand Compliance", desc: "Replace logos, themes, and interactive elements to match your organisation's brand." },
];

export const FeaturesSection = () => (
  <section className="bg-slate-50 py-24" id="features">
    <div className="mx-auto max-w-6xl px-6">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Features</span>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          Everything you need to build world-class courses
        </h2>
        <p className="mt-3 text-slate-600">
          Six building blocks that handle every part of course production — from raw material to LMS-ready deliverable.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="features-grid">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
