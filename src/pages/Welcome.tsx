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
  { icon: Brain, title: "AI-Powered Agents", desc: "10 specialized agents work together - research, writing, visuals, voice, assessment, and more." },
  { icon: BookOpen, title: "Structured Courses", desc: "Bloom's taxonomy-aligned modules with hooks, body content, and key takeaways." },
  { icon: Film, title: "YouTube Integration", desc: "Find, clip, and embed relevant videos directly into your course timeline." },
  { icon: Mic, title: "Narration & Voice", desc: "AI-generated narration scripts with text-to-speech and sentence highlighting." },
  { icon: ShieldCheck, title: "SCORM Export", desc: "Export LMS-ready SCORM 1.2 packages that work with any learning management system." },
  { icon: Sparkles, title: "Smart Compliance", desc: "Accessibility checks, inclusive language review, and ethics validation built in." },
];

const Welcome = () => {
  const navigate = useNavigate();
  const [introStage, setIntroStage] = useState<"intro" | "settling" | "done">("intro");
  const [isLeavingPage, setIsLeavingPage] = useState(false);
  const displayFont = '"Manrope", "Plus Jakarta Sans", sans-serif';

  const handleNavigate = (path: string) => {
    if (isLeavingPage) return;
    setIsLeavingPage(true);
    window.setTimeout(() => navigate(path), 560);
  };

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
          0%   { opacity: 0; transform: scale(0.22) rotate(-5deg) translateY(24px); filter: blur(12px); }
          52%  { opacity: 1; transform: scale(1.18) rotate(1deg) translateY(0); filter: blur(0); }
          76%  { transform: scale(0.98) rotate(-0.3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 30px 70px rgba(30, 58, 95, 0.16), inset 0 1px 0 rgba(255,255,255,0.6); }
          50%       { box-shadow: 0 42px 100px rgba(30, 58, 95, 0.28), 0 0 72px rgba(14, 116, 144, 0.18), inset 0 1px 0 rgba(255,255,255,0.78); }
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

        @keyframes wordmarkSheen {
          0%, 18% { background-position: 0% 50%; }
          52% { background-position: 100% 50%; }
          100% { background-position: 100% 50%; }
        }

        @keyframes welcomeStageExit {
          0%   { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
          100% { opacity: 0; transform: translateX(-14vw) scale(0.985); filter: blur(6px); pointer-events: none; }
        }

        @keyframes welcomeHeroReveal {
          0%   { opacity: 0; transform: translateX(7vw) translateY(10px) scale(0.985); }
          100% { opacity: 1; transform: translateX(0) translateY(0) scale(1); }
        }

        @keyframes welcomeCornerLogo {
          0%   { opacity: 0; transform: translateY(-10px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes heroLogoReveal {
          0% { opacity: 0; transform: scale(0.86) translateY(20px); filter: blur(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }

        @keyframes welcomePageExit {
          0% { opacity: 1; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(-10vw) scale(0.992); }
        }

        @keyframes wordmarkExit {
          0% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-56px); }
        }`}
      </style>
      {introStage !== "done" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{
            background: "#F8FAFC",
            animation: introStage === "settling" ? "welcomeStageExit 700ms ease forwards" : undefined,
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-9"
              style={{
                animation: "logoSurge 900ms cubic-bezier(0.34, 1.56, 0.64, 1) both, logoFloat 4.2s ease-in-out 1300ms infinite",
              }}
            >
              <img
                src={contentForgeLogo}
                alt="ContentForge"
                className="h-52 w-52 object-contain"
                style={{ filter: "drop-shadow(0 18px 40px rgba(30,58,95,0.18))" }}
              />
            </div>
            <h1
              className="text-[64px] font-[900] tracking-tight leading-none"
              style={{
                animation: `${introStage === "settling" ? "wordmarkExit 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards" : "wordmarkExpand 1100ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both"}`,
                fontFamily: displayFont,
              }}
            >
              <span className="text-[#1e3a5f]">Content</span>
              <span
                className="text-[#b8860b]"
                style={{
                  textShadow: "0 1px 3px rgba(184,134,11,0.3)",
                  backgroundImage: "linear-gradient(135deg, #b8860b 0%, #daa520 40%, #ffd700 60%, #b8860b 100%)",
                  backgroundSize: "220% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: "wordmarkSheen 3.6s ease-in-out 1.2s infinite",
                }}
              >
                Forge
              </span>
            </h1>
            <p
              className="mt-5 text-[17px] font-semibold tracking-[0.02em]"
              style={{ color: "#4a6080", animation: `${introStage === "settling" ? "wordmarkExit 760ms ease forwards" : "taglineReveal 700ms ease 1500ms both"}` }}
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
        <img src={contentForgeLogo} alt="ContentForge" className="h-20 w-20 object-contain" style={{ filter: "drop-shadow(0 8px 20px rgba(30,58,95,0.16))" }} />
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
      <div
        className="fixed inset-x-0 bottom-0 z-[100] border-t-2 shadow-[0_-8px_22px_rgba(15,23,42,0.12)]"
        style={{
          background: "rgba(255, 255, 255, 0.98)",
          borderColor: "#cbd5e1",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-3 sm:flex-row sm:justify-center sm:gap-5">
          <img
            src="/unitol-logo.png"
            alt="UniTol Training Solutions Pvt Ltd"
            className="h-14 w-auto object-contain sm:h-16"
            loading="lazy"
          />
          <div className="flex flex-col items-center sm:items-start">
            <p className="text-[11px] font-medium tracking-wide" style={{ color: "#4a6080" }}>
              This is an offering from
            </p>
            <p className="text-[16px] font-extrabold leading-tight" style={{ color: "#1e3a5f" }}>
              UniTol Training Solutions Pvt Ltd&nbsp;
              <span className="text-[14px] font-semibold" style={{ color: "#4a6080" }}>
                (www.UniTol.in)
              </span>
            </p>
          </div>
        </div>
      </div>
      {/* Hero */}
      <div
        className="relative overflow-hidden pb-20"
        style={{ animation: isLeavingPage ? "welcomePageExit 560ms cubic-bezier(0.22, 1, 0.36, 1) forwards" : undefined }}
      >
        <div className="absolute inset-0 bg-slate-100/70" />
        <div className="absolute inset-x-0 top-0 h-[420px] opacity-90"
          style={{ background: "rgba(151,193,219,0.16)" }}
        />
        <div
          className="relative max-w-5xl mx-auto px-6 pt-20 pb-20 text-center"
          style={{ animation: introStage === "done" ? "welcomeHeroReveal 620ms cubic-bezier(0.22, 1, 0.36, 1) both" : undefined, opacity: introStage === "done" ? 1 : 0 }}
        >
          <div className="mb-8 flex justify-center" style={{ animation: introStage === "done" ? "heroLogoReveal 720ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both" : undefined }}>
            <img
              src={contentForgeLogo}
              alt="ContentForge"
              className="h-44 w-44 object-contain md:h-52 md:w-52"
              style={{ filter: "drop-shadow(0 20px 40px rgba(30,58,95,0.18))" }}
            />
          </div>
          <h1 className="mb-3 text-[52px] font-[900] leading-[1.02] tracking-tight md:text-[58px]"
            style={{
              fontFamily: displayFont,
              animation: isLeavingPage ? "wordmarkExit 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards" : undefined,
            }}>
            <span className="text-[#1e3a5f]">Content</span>
            <span
              className="text-[#b8860b]"
              style={{
                textShadow: "0 1px 3px rgba(184,134,11,0.3)",
                backgroundImage: "#B45309",
                backgroundSize: "220% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "wordmarkSheen 4.6s ease-in-out 1.4s infinite",
              }}
            >
              Forge
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-[20px] font-medium leading-[1.75]"
            style={{ color: "#536a87" }}>
            Transform your raw content into polished, LMS-ready eLearning courses in minutes - powered by a multi-agent AI pipeline.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleNavigate("/studio")}
              className="h-14 rounded-xl bg-primary px-8 text-[16px] font-extrabold text-primary-foreground shadow-lg transition-all hover:brightness-110 flex items-center gap-2"
              style={{ fontFamily: displayFont }}
              disabled={isLeavingPage}
            >
              <Sparkles className="w-5 h-5" />
              Start Creating
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleNavigate("/help")}
              className="h-14 rounded-xl border-2 border-border px-8 text-[16px] font-extrabold text-foreground transition-all hover:border-primary/40 hover:bg-secondary flex items-center gap-2"
              style={{ fontFamily: displayFont }}
              disabled={isLeavingPage}
            >
              <HelpCircle className="w-5 h-5" />
              How It Works
            </button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="mb-10 text-center text-[28px] font-extrabold text-foreground md:text-[32px]"
          style={{ fontFamily: displayFont }}>
          Everything you need to build world-class courses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg hover:border-primary/20 transition-all group">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="mb-2 text-[18px] font-extrabold text-foreground"
                style={{ fontFamily: displayFont }}>{f.title}</h3>
              <p className="text-[15px] leading-[1.8]"
                style={{ color: "#5d7089" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-secondary/30 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="mb-10 text-center text-[28px] font-extrabold text-foreground md:text-[32px]"
            style={{ fontFamily: displayFont }}>How It Works</h2>
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
                <h3 className="mb-2 text-[18px] font-extrabold text-foreground"
                  style={{ fontFamily: displayFont }}>{s.title}</h3>
                <p className="text-[15px] leading-[1.8]"
                  style={{ color: "#5d7089" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Welcome;

