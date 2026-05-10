import { Check, Shield, FileText } from "lucide-react";
import { toast } from "sonner";

type Pack = { id: string; credits: number; price: number; perCredit: number; tag: string | null };

const PACKS: Pack[] = [
  { id: "p10", credits: 10, price: 4990, perCredit: 499, tag: null },
  { id: "p50", credits: 50, price: 24950, perCredit: 499, tag: "Best value" },
  { id: "p200", credits: 200, price: 99800, perCredit: 499, tag: null },
  { id: "p500", credits: 500, price: 249500, perCredit: 499, tag: null },
];

export const PricingSection = () => {
  const handleBuy = (pack: Pack) => {
    toast("Coming soon", {
      description: `${pack.credits} credits for ₹${pack.price.toLocaleString("en-IN")} — payments will be live shortly.`,
    });
  };

  return (
    <section className="bg-slate-50 py-24" id="pricing">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Pricing
          </span>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
            Create e-learning in minutes
          </h2>
          <p className="mt-3 text-slate-600">
            <span className="font-semibold text-slate-900">1 credit = 1 minute</span> of generated content. No subscriptions. Credits never expire.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4" data-testid="pack-grid">
          {PACKS.map((pack) => {
            const isHighlight = pack.tag === "Best value";
            return (
              <div
                key={pack.id}
                data-testid={`pack-card-${pack.credits}`}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-lg ${
                  isHighlight ? "border-indigo-600 shadow-md ring-2 ring-indigo-600/10" : "border-slate-200"
                }`}
              >
                {pack.tag && (
                  <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                    {pack.tag}
                  </span>
                )}
                <div className="mb-6">
                  <div className="text-sm font-medium text-slate-500">{pack.credits} Credits</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-slate-900">
                      ₹{pack.price.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">₹{pack.perCredit} / credit</div>
                </div>

                <button
                  data-testid={`buy-now-${pack.credits}`}
                  onClick={() => handleBuy(pack)}
                  className={`mt-auto w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                    isHighlight ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  Buy now
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50">
              <Shield className="h-4 w-4 text-cyan-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">UPI / Cards supported</div>
              <div className="text-xs text-slate-500">Razorpay · 256-bit secure</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
              <Check className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">Instant credit delivery</div>
              <div className="text-xs text-slate-500">Available in seconds after payment</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
              <FileText className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">GST invoice available</div>
              <div className="text-xs text-slate-500">Auto-emailed within 24h</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
