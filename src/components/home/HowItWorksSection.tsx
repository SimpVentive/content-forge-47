import { UploadCloud, Settings2, Eye, type LucideIcon } from "lucide-react";

type Step = { n: string; icon: LucideIcon; title: string; desc: string };

const STEPS: Step[] = [
  { n: "01", icon: UploadCloud, title: "Upload your content", desc: "Drop in a PDF, DOC, or raw notes. Our AI agents analyse it, identify key themes, and outline learning objectives." },
  { n: "02", icon: Settings2, title: "Configure & generate", desc: "Pick course structure, narration voice, and assessment style. The multi-agent pipeline builds your course." },
  { n: "03", icon: Eye, title: "Preview & export", desc: "Review in the editor, tweak as needed, and export as a polished SCORM package — ready for any LMS." },
];

export const HowItWorksSection = () => (
  <section className="bg-white py-24" id="how-it-works">
    <div className="mx-auto max-w-6xl px-6">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">How it works</span>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          From file to published course — in three steps
        </h2>
      </div>

      <div className="relative mt-12 grid gap-6 md:grid-cols-3" data-testid="steps-grid">
        <div
          aria-hidden
          className="pointer-events-none absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-transparent via-indigo-200 to-transparent md:block"
        />
        {STEPS.map(({ n, icon: Icon, title, desc }) => (
          <div key={n} className="relative rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-mono text-sm font-semibold text-indigo-600">{n}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
