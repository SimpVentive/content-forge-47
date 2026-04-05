import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Upload, Settings, Play, Sparkles, Film, Mic, ClipboardCheck, Package, Download, HelpCircle, ChevronRight } from "lucide-react";
import contentForgeLogo from "@/assets/contentforge-logo.png";

const sections = [
  {
    icon: Upload,
    title: "1. Getting Started — Upload Your Content",
    content: [
      "Enter a course title in the left sidebar.",
      "Paste your raw content, notes, or key points into the text area. You can also upload a PDF or Word document — the system will extract the text automatically.",
      "The system estimates the ideal course duration based on your content length. You'll see this estimate when you configure course parameters.",
    ],
  },
  {
    icon: Settings,
    title: "2. Configure Course Parameters",
    content: [
      "Click 'Generate Course' to open the parameters dialog.",
      "Choose your course duration (5, 10, 15, 20, or 30 minutes).",
      "Select language, difficulty level (beginner to advanced), and tone (professional, conversational, academic, casual).",
      "Toggle assessment on/off and choose narration voice style.",
      "If your selected duration differs significantly from the estimated time, you'll receive a helpful recommendation.",
    ],
  },
  {
    icon: Sparkles,
    title: "3. The AI Agent Pipeline",
    content: [
      "Once you confirm, 10 specialized AI agents work in sequence:",
      "• Research Agent — Extracts key themes and learning objectives",
      "• Content Architect — Structures modules using Bloom's taxonomy",
      "• Writer Agent — Creates instructional scripts with hooks and takeaways",
      "• Visual Design Agent — Plans slide layouts, diagrams, and infographics",
      "• Animation Agent — Adds motion graphics and interaction cues",
      "• YouTube Agent — Finds relevant videos for each module topic",
      "• Compliance Agent — Checks accessibility and inclusive language",
      "• Assessment Agent — Builds MCQs, scenarios, and reflection exercises",
      "• Voice Agent — Generates narration scripts with pacing cues",
      "• Assembly Agent — Produces the final SCORM-ready course package",
    ],
  },
  {
    icon: Film,
    title: "4. YouTube Video Integration",
    content: [
      "After the pipeline runs, a video workflow dialog appears automatically.",
      "The YouTube Agent finds top videos for each module topic.",
      "You can search for additional videos, set clip ranges (start/end times), and give custom names.",
      "Choose 'Insert Now' to place videos into specific modules immediately, or 'Place Later' to assign them in the Learner Preview.",
      "In the Learner Preview, use the 'Place Videos' button to drag-and-drop clips into your course timeline.",
    ],
  },
  {
    icon: BookOpen,
    title: "5. Reviewing Course Output",
    content: [
      "The right panel shows your generated content across multiple tabs:",
      "• Outline — Full course structure with modules and topics",
      "• Videos — Browse and manage inserted YouTube clips",
      "• Script — Narration scripts with voice cues (PAUSE, EMPHASIZE, etc.)",
      "• Assessment — MCQs, scenario-based questions, and reflection prompts",
      "• Package — SCORM manifest, deployment checklist, and QA summary",
    ],
  },
  {
    icon: Play,
    title: "6. Learner Preview",
    content: [
      "Click 'Preview as Learner' to see the full student experience.",
      "Navigate through slides with forward/back arrows or keyboard shortcuts.",
      "Play narration audio — sentences are highlighted inline as they're read aloud.",
      "Use the toolbar to toggle highlighting on/off and choose highlight colors (Yellow, Mint, or Sky).",
      "Infographic cards appear at the start of each module for visual context.",
      "Embedded YouTube videos play inline at their assigned positions.",
    ],
  },
  {
    icon: Mic,
    title: "7. Narration & Audio",
    content: [
      "The Voice Agent generates narration scripts with pacing cues like [PAUSE], [EMPHASIZE], [SLOW DOWN].",
      "Click the play button on any slide to hear AI-generated text-to-speech.",
      "Enable sentence highlighting to follow along as the narration plays.",
      "Choose from three highlight color palettes in the preview toolbar.",
    ],
  },
  {
    icon: Download,
    title: "8. Exporting Your Course",
    content: [
      "Once all content is generated and videos are placed, go to the Package tab.",
      "Click 'Export SCORM Package' to download a SCORM 1.2-compliant ZIP file.",
      "The ZIP contains: imsmanifest.xml, SCORM API wrapper, and one HTML page per module.",
      "Each module page includes: content, topic chips, quiz questions with scoring, navigation, and progress tracking.",
      "Upload the ZIP to any LMS (Moodle, Canvas, Blackboard, etc.) to deploy your course.",
    ],
  },
  {
    icon: HelpCircle,
    title: "Tips & Best Practices",
    content: [
      "• Start with well-organized notes — the AI works best with clear source material.",
      "• Keep course duration realistic for the amount of content you provide.",
      "• Review and edit generated scripts before final export.",
      "• Use the compliance report to fix accessibility issues.",
      "• Test your SCORM package in a sandbox LMS before deploying to learners.",
      "• You can re-run individual agents by toggling them in the pipeline view.",
    ],
  },
];

const Help = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="h-9 px-4 rounded-xl text-[13px] font-bold text-foreground border border-border hover:bg-secondary transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <img src={contentForgeLogo} alt="" className="w-7 h-7" />
            <span className="text-[15px] font-extrabold text-foreground">ContentForge Help</span>
          </div>
          <button
            onClick={() => navigate("/studio")}
            className="h-9 px-4 rounded-xl text-[13px] font-bold text-primary-foreground bg-primary hover:brightness-110 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Open Studio
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="text-center mb-12">
          <h1 className="text-[32px] font-[900] text-foreground mb-3">How to Use ContentForge</h1>
          <p className="text-[15px] text-muted-foreground max-w-lg mx-auto leading-relaxed">
            A step-by-step guide to creating professional eLearning courses with our AI-powered platform.
          </p>
        </div>

        {/* Quick nav */}
        <div className="bg-secondary/40 rounded-2xl border border-border p-5 mb-10">
          <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Quick Navigation</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {sections.map((s, i) => (
              <a
                key={i}
                href={`#section-${i}`}
                className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 py-1"
              >
                <ChevronRight className="w-3 h-3 text-primary" />
                {s.title.replace(/^\d+\.\s*/, "")}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, i) => (
            <div key={i} id={`section-${i}`} className="bg-card rounded-2xl border border-border p-6 scroll-mt-20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <section.icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-[17px] font-extrabold text-foreground">{section.title}</h2>
              </div>
              <div className="space-y-2 pl-[52px]">
                {section.content.map((line, j) => (
                  <p key={j} className={`text-[14px] leading-relaxed ${line.startsWith("•") ? "text-foreground/80 pl-2" : "text-muted-foreground"}`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center text-[12px] text-muted-foreground border-t border-border mt-10">
        ContentForge — AI-Powered eLearning Course Generator
      </footer>
    </div>
  );
};

export default Help;
