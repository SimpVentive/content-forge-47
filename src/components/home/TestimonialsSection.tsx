type Testimonial = { quote: string; author: string; role: string };

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Adani partnered with UniTol in designing the Training Needs Identification process — covering 3,800+ executives — and rolling it out on their L-Kurve platform. The team ensured completion within the stipulated time. We would surely recommend them.",
    author: "Milind Dave",
    role: "Senior Manager – HR, Adani Transmission",
  },
  {
    quote:
      "We evaluated different TMS solutions and finally decided to work with UniTol and their L-Kurve platform. We named it 'Gurukul' and migrated all workflows to that platform. Strongly recommended.",
    author: "Babita R Singh",
    role: "AGM HR, Polycab",
  },
  {
    quote:
      "UniTol has been one of our partners for three years in technical and functional training. Excellent Pan-India trainers who facilitate in many regional languages. More experimental than theoretical.",
    author: "Mona Khurana",
    role: "HeidelbergCement India Ltd.",
  },
];

export const TestimonialsSection = () => (
  <section className="bg-slate-50 py-20" id="testimonials">
    <div className="mx-auto max-w-6xl px-6">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">In their words</span>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">What clients say</h2>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <figure key={i} className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-3xl font-serif text-indigo-300">&ldquo;</div>
            <blockquote className="mt-2 text-sm leading-relaxed text-slate-700">{t.quote}</blockquote>
            <figcaption className="mt-5 border-t border-slate-100 pt-4">
              <div className="text-sm font-semibold text-slate-900">{t.author}</div>
              <div className="text-xs text-slate-500">{t.role}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
);
