import { Bot, BookOpen, Images, Video, Mic, Package, ShieldCheck, Youtube, type LucideIcon } from "lucide-react";

type Feature = { icon: LucideIcon; title: string; desc: string; badge?: string };

const FEATURES: Feature[] = [
  { icon: Bot, title: "AI-Powered Agents", desc: "Specialist agents collaborate on research, writing, lesson planning, assessments, and more." },
  { icon: BookOpen, title: "Structured E-Learning", desc: "Generate ready-to-publish modules, lesson plans, and assessments from any topic — exportable as SCORM." },
  { icon: Images, title: "Image-Based Flipbooks", desc: "Turn source material into illustrated, scene-by-scene flipbooks — perfect for visual storytelling and microlearning.", badge: "New" },
  { icon: Video, title: "Video Learning", desc: "Produce narrated video lessons with auto-generated visuals, captions, and pacing tuned for retention.", badge: "New" },
  { icon: Youtube, title: "YouTube Integration", desc: "Pull in existing YouTube videos and automatically enrich them into your course content." },
  { icon: Mic, title: "Narration & Voice", desc: "AI-generated narration in 29+ languages with customisable, high-quality voices — on demand per format." },
  { icon: Package, title: "SCORM & HTML Export", desc: "Ship SCORM 1.2 / 2004 packages for any LMS, or standalone HTML flipbooks you can host anywhere." },
  { icon: ShieldCheck, title: "Brand Compliance", desc: "Replace logos, themes, and interactive elements to match your organisation's brand." },
];

export const FeaturesSection = () => (
  <section className="bg-slate-50 py-24" id="features">
    <div className="mx-auto max-w-6xl px-6">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Features</span>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          One pipeline. Three learning formats.
        </h2>
        <p className="mt-3 text-slate-600">
          Pick the format that fits your audience — structured e-learning, image-based flipbooks, or narrated video — all powered by the same agent stack.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4" data-testid="features-grid">
        {FEATURES.map(({ icon: Icon, title, desc, badge }) => (
          <div
            key={title}
            className="group relative rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50"
          >
            {badge && (
              <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                {badge}
              </span>
            )}
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
