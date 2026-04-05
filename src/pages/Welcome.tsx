import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Mic, Brain, Film, ShieldCheck, ArrowRight, HelpCircle } from "lucide-react";
import contentForgeLogo from "@/assets/contentforge-logo.png";

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-card shadow-xl flex items-center justify-center">
              <img src={contentForgeLogo} alt="ContentForge" className="w-14 h-14 object-contain" />
            </div>
          </div>
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
