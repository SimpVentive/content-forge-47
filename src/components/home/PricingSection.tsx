import { Check, Shield, FileText, Loader2, Info, Image as ImageIcon, BookOpen, Video } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/edgeFunctions";

type Pack = {
  id: string;
  name: string;
  credits: number;
  priceInr: number;
  perCredit: number;
  tag: string | null;
  blurb: string;
  includes: { image: string; elearning: string; video: string };
};

const PACKS: Pack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    priceInr: 249,
    perCredit: 2.49,
    tag: null,
    blurb: "Kick the tyres and ship your first course.",
    includes: { image: "10 image-based lessons", elearning: "5 min of e-learning", video: "1 min of video" },
  },
  {
    id: "growth",
    name: "Growth",
    credits: 500,
    priceInr: 999,
    perCredit: 2.0,
    tag: "Best value",
    blurb: "For teams shipping courses every month.",
    includes: { image: "50 image-based lessons", elearning: "25 min of e-learning", video: "5 min of video" },
  },
  {
    id: "studio",
    name: "Studio",
    credits: 1000,
    priceInr: 1899,
    perCredit: 1.89,
    tag: null,
    blurb: "For studios producing at scale across formats.",
    includes: { image: "100 image-based lessons", elearning: "50 min of e-learning", video: "10 min of video" },
  },
];

export const PricingSection = () => {
  const { isAuthenticated, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [processingPack, setProcessingPack] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleBuy = async (pack: Pack) => {
    if (!isAuthenticated) {
      navigate("/signup");
      return;
    }

    setProcessingPack(pack.id);
    try {
      const orderRes = await createRazorpayOrder(pack.credits, pack.price, `order-${Date.now()}`);

      const rzp = (window as any).Razorpay;
      if (!rzp) {
        throw new Error("Razorpay not loaded");
      }

      new rzp({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        order_id: orderRes.order_id,
        handler: async (response: any) => {
          try {
            await verifyRazorpayPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            await refreshProfile();
            toast.success(`${pack.credits} credits added! Check your account.`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Payment verification failed");
          }
        },
        prefill: { contact: "" },
      }).open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
    } finally {
      setProcessingPack(null);
    }
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
                  onClick={() => void handleBuy(pack)}
                  disabled={processingPack !== null}
                  className={`mt-auto w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    isHighlight ? "bg-indigo-600 text-white hover:bg-indigo-700 disabled:hover:bg-indigo-600" : "bg-slate-900 text-white hover:bg-slate-800 disabled:hover:bg-slate-900"
                  }`}
                >
                  {processingPack === pack.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Buy now"
                  )}
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
