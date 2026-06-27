import React, { useState } from "react";
import { X, Search, BookOpen, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqItems: FAQItem[] = [
  {
    category: "Getting Started",
    question: "How do I create my first course?",
    answer: "Navigate to the 'New Course' option on the dashboard. Choose your learning type (static, video, or image-based), upload your content (PDF, text, or notes), configure the course parameters (duration, language, difficulty level), and click 'Proceed to Generation'. The AI agents will handle the rest!",
  },
  {
    category: "Getting Started",
    question: "What formats can I upload?",
    answer: "You can paste text directly, upload PDF files, Word documents, or PowerPoint presentations. The system will automatically extract the content and use it to generate your course.",
  },
  {
    category: "Credits & Billing",
    question: "What are credits and how do they work?",
    answer: "Credits are units used to generate courses. Each minute of generated content costs 1 credit. For example, a 10-minute course uses 10 credits. You can purchase credit packages from the Upgrade section on your dashboard.",
  },
  {
    category: "Credits & Billing",
    question: "Do my credits expire?",
    answer: "No! Your credits never expire. You can use them anytime without worrying about losing them.",
  },
  {
    category: "Course Generation",
    question: "How long does it take to generate a course?",
    answer: "Course generation typically takes 5-15 minutes depending on the course length and complexity. You'll see a 'Generation Complete' notification when your course is ready to preview.",
  },
  {
    category: "Course Generation",
    question: "Can I stop the generation process?",
    answer: "Yes! You can click the 'Stop Generation' button on the Creation tab at any time. This will halt the pipeline and return you to the setup so you can make adjustments.",
  },
  {
    category: "Voice & Audio",
    question: "How do I enable or disable voice narration?",
    answer: "On the course overview (first) slide, you'll see 'Voice Over available for this module' with a Turn On/Off button. Your choice applies to the entire course. You don't need to change it on every slide.",
  },
  {
    category: "Voice & Audio",
    question: "What languages are supported for narration?",
    answer: "We support 30+ languages including English, Spanish, French, German, Mandarin, Japanese, Hindi, Arabic, and many more. You can select your preferred language on the course setup screen.",
  },
  {
    category: "Learner Preview",
    question: "What is the Learner Preview?",
    answer: "The Learner Preview is an interactive preview where you can see exactly how learners will experience your course. You can take assessments, read content, listen to narration, and view all course materials exactly as they'll appear in the final output.",
  },
  {
    category: "Output Formats",
    question: "What output formats are available?",
    answer: "ContentForge supports SCORM 1.2, SCORM 2004, HTML flipbook, PDF, and more. Each format is optimized for different LMS platforms and use cases.",
  },
  {
    category: "Quality & Assessment",
    question: "How are assessments created?",
    answer: "The Assessment Agent automatically generates multiple choice questions, scenario-based questions, and reflection exercises based on your course content. You can review and modify these in the Learner Preview.",
  },
  {
    category: "Quality & Assessment",
    question: "What is the QA (Quality Assurance) engine?",
    answer: "After generation completes, the QA engine validates your course for quality, consistency, and alignment with your source material. It identifies potential issues and suggests fixes. You can review and apply changes before finalizing.",
  },
];

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"docs" | "faq">("docs");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredFAQ = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const faqByCategory = filteredFAQ.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, FAQItem[]>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-teal-600" />
            Help & Support
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200 px-6 bg-slate-50">
          <button
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "docs"
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-2" />
            Documentation
          </button>
          <button
            onClick={() => setActiveTab("faq")}
            className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === "faq"
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <HelpCircle className="w-4 h-4 inline mr-2" />
            FAQ
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "docs" ? (
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  📖 <strong>Getting Started?</strong> Check the documentation below for step-by-step guides on creating, generating, and publishing your courses.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-900">📚 Documentation</h3>
                <p className="text-sm text-slate-600">
                  ContentForge uses AI agents to transform your raw content into professional, LMS-ready courses in minutes. Here's how it works:
                </p>

                <div className="space-y-3">
                  <div className="border-l-4 border-teal-600 pl-4 py-2">
                    <h4 className="font-semibold text-slate-900">1. Upload Your Content</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Paste text, upload a PDF, Word document, or PowerPoint presentation. The system extracts and analyzes your content.
                    </p>
                  </div>

                  <div className="border-l-4 border-teal-600 pl-4 py-2">
                    <h4 className="font-semibold text-slate-900">2. Configure Parameters</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Set course duration, language, difficulty level, and tone. Choose whether to include assessments and narration.
                    </p>
                  </div>

                  <div className="border-l-4 border-teal-600 pl-4 py-2">
                    <h4 className="font-semibold text-slate-900">3. AI Pipeline Generates</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      10 specialized agents work in sequence: Research, Architecture, Writing, Visuals, Animation, Videos, Compliance, Assessment, Voice, and Assembly.
                    </p>
                  </div>

                  <div className="border-l-4 border-teal-600 pl-4 py-2">
                    <h4 className="font-semibold text-slate-900">4. Quality Assurance</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Review your course in the Learner Preview. The QA engine validates content quality, consistency, and alignment.
                    </p>
                  </div>

                  <div className="border-l-4 border-teal-600 pl-4 py-2">
                    <h4 className="font-semibold text-slate-900">5. Export & Publish</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Export as SCORM, HTML, PDF, or other formats. Upload directly to your LMS or share with learners.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 mt-4">
                  <p className="text-xs text-slate-600">
                    <strong>💡 Tip:</strong> Enable voice narration on the first slide to add professional audio throughout your course. You control it once for the entire course.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-50"
                />
              </div>

              {/* FAQ Items by Category */}
              <div className="space-y-6">
                {Object.entries(faqByCategory).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="font-semibold text-slate-900 text-sm uppercase tracking-wide mb-3">
                      {category}
                    </h3>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() =>
                            setExpandedFAQ(
                              expandedFAQ === `${category}-${idx}` ? null : `${category}-${idx}`
                            )
                          }
                          className="w-full text-left p-4 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50 transition-all"
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="font-semibold text-slate-900 text-sm pr-4">
                              {item.question}
                            </h4>
                            {expandedFAQ === `${category}-${idx}` ? (
                              <ChevronUp className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                            )}
                          </div>

                          {expandedFAQ === `${category}-${idx}` && (
                            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                              {item.answer}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredFAQ.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-600">
                      No FAQs match your search. Try different keywords!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          <p className="text-xs text-slate-600">
            Can't find what you're looking for? Email us at <span className="font-semibold">support@contentforge.ai</span>
          </p>
        </div>
      </div>
    </div>
  );
};
