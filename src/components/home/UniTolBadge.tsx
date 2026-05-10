const UTS_LOGO =
  "https://customer-assets.emergentagent.com/job_design-preview-170/artifacts/0ypv4cme_uts.png";

type Props = {
  tone?: "light" | "dark";
  className?: string;
};

export const UniTolBadge = ({ tone = "light", className = "" }: Props) => {
  const wrap =
    tone === "light"
      ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
      : "bg-white/10 border border-white/20 text-white backdrop-blur hover:bg-white/15";

  return (
    <a
      href="https://www.unitol.in"
      target="_blank"
      rel="noopener noreferrer"
      data-testid="unitol-badge"
      className={`inline-flex items-center gap-2.5 rounded-full px-3 py-1.5 transition-colors ${wrap} ${className}`}
    >
      <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-black">
        <img src={UTS_LOGO} alt="UTS" className="h-full w-full object-contain" loading="lazy" />
      </span>
      <span className="text-xs font-medium">
        An offering of <span className="font-semibold">UniTol Training Solutions Pvt Ltd</span>
      </span>
    </a>
  );
};
