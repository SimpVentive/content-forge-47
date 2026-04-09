import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Mic, Brain, Film, ShieldCheck, ArrowRight, HelpCircle } from "lucide-react";
import contentForgeLogo from "@/assets/contentforge-logo.png";

const loadedAtLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
}).format(new Date());

const features = [
  { icon: Brain, title: "AI-Powered Agents", desc: "10 specialized agents work together — research, writing, visuals, voice, assessment, and more." },
  { icon: BookOpen, title: "Structured Courses", desc: "Bloom's taxonomy-aligned modules with hooks, body content, and key takeaways." },
  { icon: Film, title: "YouTube Integration", desc: "Find, clip, and embed relevant videos directly into your course timeline." },
  { icon: Mic, title: "Narration & Voice", desc: "AI-generated narration scripts with text-to-speech and sentence highlighting." },
  { icon: ShieldCheck, title: "SCORM Export", desc: "Export LMS-ready SCORM 1.2 packages that work with any learning management system." },
  { icon: Sparkles, title: "Smart Compliance", desc: "Accessibility checks, inclusive language review, and ethics validation built in." },
];

const Welcome = () => {
  const navigate = useNavigate();
  const [introStage, setIntroStage] = useState<"intro" | "settling" | "done">("intro");

  useEffect(() => {
    const settleTimer = window.setTimeout(() => setIntroStage("settling"), 6500);
    const doneTimer = window.setTimeout(() => setIntroStage("done"), 7300);

    return () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <style>
        {`@keyframes logoSurge {
          0%   { opacity: 0; transform: scale(0.18) rotate(-6deg); filter: blur(10px); }
          55%  { opacity: 1; transform: scale(1.13) rotate(1.5deg); filter: blur(0); }
          75%  { transform: scale(0.96) rotate(-0.3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
        }

        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 28px 60px rgba(30, 58, 95, 0.18); }
          50%       { box-shadow: 0 36px 80px rgba(30, 58, 95, 0.38), 0 0 56px rgba(14, 116, 144, 0.25); }
        }

        @keyframes wordmarkExpand {
          0%   { opacity: 0; transform: scale(0.28); letter-spacing: -0.14em; filter: blur(4px); }
          50%  { opacity: 1; transform: scale(1.07); letter-spacing: 0.04em; filter: blur(0); }
          72%  { transform: scale(0.98); letter-spacing: -0.004em; }
          100% { opacity: 1; transform: scale(1); letter-spacing: 0; filter: blur(0); }
        }

        @keyframes taglineReveal {
          0%   { opacity: 0; transform: translateY(12px); }
          100% { opacity: 0.7; transform: translateY(0); }
        }

        @keyframes welcomeStageExit {
          0%   { opacity: 1; }
          100% { opacity: 0; pointer-events: none; }
        }

        @keyframes welcomeHeroReveal {
          0%   { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes welcomeCornerLogo {
          0%   { opacity: 0; transform: translateY(-10px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }`}
      </style>
      {introStage !== "done" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{
            background: "linear-gradient(180deg, #f8fafc 0%, #edf3fb 100%)",
            animation: introStage === "settling" ? "welcomeStageExit 700ms ease forwards" : undefined,
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-8 flex h-36 w-36 items-center justify-center rounded-[34px] border"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(241,245,249,0.97))",
                borderColor: "rgba(148,163,184,0.2)",
                animation: "logoSurge 900ms cubic-bezier(0.34, 1.56, 0.64, 1) both, logoGlow 2.8s ease-in-out 1100ms infinite",
              }}
            >
              <img src={contentForgeLogo} alt="ContentForge" className="h-24 w-24 object-contain" />
            </div>
            <h1
              className="text-[64px] font-[900] tracking-tight leading-none"
              style={{ animation: "wordmarkExpand 1100ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both" }}
            >
              <span className="text-[#1e3a5f]">Content</span>
              <span className="text-[#b8860b]" style={{ textShadow: "0 1px 3px rgba(184,134,11,0.3)" }}>Forge</span>
            </h1>
            <p
              className="mt-5 text-[16px] font-medium tracking-wide"
              style={{ color: "#4a6080", animation: "taglineReveal 700ms ease 1500ms both" }}
            >
              AI-Powered eLearning Course Generator
            </p>
          </div>
        </div>
      )}

      <div
        className="fixed left-4 top-4 z-20"
        style={{ animation: introStage === "done" ? "welcomeCornerLogo 540ms cubic-bezier(0.22, 1, 0.36, 1) both" : undefined, opacity: introStage === "done" ? 1 : 0 }}
      >
        <div
          className="flex h-24 w-24 items-center justify-center rounded-[24px] border shadow-2xl"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.99), rgba(241,245,249,0.97))",
            borderColor: "rgba(148, 163, 184, 0.24)",
            boxShadow: "0 22px 48px rgba(30, 58, 95, 0.18)",
          }}
        >
          <img src={contentForgeLogo} alt="ContentForge" className="h-16 w-16 object-contain" />
        </div>
      </div>
      <div className="fixed right-4 top-4 z-20">
        <div className="rounded-lg border px-3 py-2 text-[11px] font-semibold shadow-md"
          style={{
            background: "rgba(15, 23, 42, 0.88)",
            borderColor: "rgba(148, 163, 184, 0.35)",
            color: "#f8fafc",
            backdropFilter: "blur(10px)",
          }}
        >
          Latest load: {loadedAtLabel}
        </div>
      </div>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
        <div
          className="relative max-w-5xl mx-auto px-6 pt-20 pb-20 text-center"
          style={{ animation: introStage === "done" ? "welcomeHeroReveal 620ms cubic-bezier(0.22, 1, 0.36, 1) both" : undefined, opacity: introStage === "done" ? 1 : 0 }}
        >
          <h1 className="text-[48px] font-[900] tracking-tight leading-tight mb-2">
            <span className="text-[#1e3a5f]">Content</span>
            <span className="text-[#b8860b]" style={{ textShadow: "0 1px 3px rgba(184,134,11,0.3)" }}>Forge</span>
          </h1>
          <p className="text-[18px] text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Transform your raw content into polished, LMS-ready eLearning courses in minutes — powered by a multi-agent AI pipeline.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate("/studio")}
              className="h-14 px-8 rounded-xl text-[16px] font-bold text-primary-foreground bg-primary shadow-lg hover:brightness-110 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Start Creating
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/help")}
              className="h-14 px-8 rounded-xl text-[16px] font-bold text-foreground border-2 border-border hover:border-primary/40 hover:bg-secondary transition-all flex items-center gap-2"
            >
              <HelpCircle className="w-5 h-5" />
              How It Works
            </button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-[24px] font-extrabold text-foreground text-center mb-10">
          Everything you need to build world-class courses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:border-primary/20 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-[15px] font-bold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-secondary/30 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-[24px] font-extrabold text-foreground text-center mb-10">How It Works</h2>
          <div className="flex flex-col md:flex-row gap-6">
            {[
              { step: "1", title: "Upload Your Content", desc: "Paste notes, upload a PDF, or type your course topic. Our Research Agent extracts key themes and learning objectives." },
              { step: "2", title: "Configure & Generate", desc: "Set your course duration, language, level, and assessment preferences. Hit generate and watch 10 AI agents work in parallel." },
              { step: "3", title: "Preview & Export", desc: "Preview the full learner experience with narration, quizzes, and videos. Export as a SCORM package for any LMS." },
            ].map((s, i) => (
              <div key={i} className="flex-1 bg-card rounded-2xl border border-border p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-extrabold text-[18px] flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="text-[15px] font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center text-[12px] text-muted-foreground border-t border-border">
        ContentForge — AI-Powered eLearning Course Generator
      </footer>
    </div>
  );
};

export default Welcome;
