import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is a credit and how long does it last?",
    a: "1 credit = 1 minute of generated course content. Credits never expire — buy a pack once and use it whenever you need to publish.",
  },
  {
    q: "Which LMS platforms does the SCORM export work with?",
    a: "The output is SCORM 1.2 and SCORM 2004-compliant, plus xAPI/Tin Can compatible. It works with Moodle, Cornerstone, SuccessFactors, Docebo, Talent LMS, and any modern LMS that accepts standard SCORM packages.",
  },
  {
    q: "What input formats can I upload?",
    a: "PDFs, Word documents, PowerPoint files, plain text, and YouTube URLs. The pipeline ingests, transcribes (where needed), and structures the source material into modules, lessons, and assessments.",
  },
  {
    q: "Can I bring my own brand — colours, logos, voice?",
    a: "Yes. Theme tokens, logo, and interactive element library can be configured per project. Voice cloning and per-lesson narrator selection are supported as well.",
  },
  {
    q: "Do I get a GST invoice?",
    a: "Yes — every credit purchase generates a GST-compliant invoice automatically, emailed within 24 hours. India-focused billing is built in.",
  },
];

export const FAQSection = () => (
  <section className="bg-white py-24" id="faq">
    <div className="mx-auto max-w-3xl px-6">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">FAQ</span>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Common questions</h2>
        <p className="mt-3 text-slate-600">Quick answers about credits, exports, and how the pipeline works.</p>
      </div>

      <Accordion type="single" collapsible className="mt-10 space-y-3" data-testid="faq-list">
        {FAQS.map((f, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="rounded-xl border border-slate-200 bg-white px-5 data-[state=open]:border-indigo-200 data-[state=open]:shadow-sm"
          >
            <AccordionTrigger className="text-left text-base font-semibold text-slate-900 hover:no-underline">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-slate-600">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);
