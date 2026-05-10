import { Link } from "react-router-dom";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_design-preview-170/artifacts/7e6vqb4u_image.png";

type Size = "sm" | "md" | "lg";
type Variant = "light" | "dark";

type Props = {
  size?: Size;
  variant?: Variant;
  asLink?: boolean;
  className?: string;
};

const SIZES: Record<Size, { img: string; text: string }> = {
  sm: { img: "h-12 w-12", text: "text-2xl" },
  md: { img: "h-14 w-14", text: "text-3xl" },
  lg: { img: "h-16 w-16", text: "text-4xl" },
};

export const BrandLogo = ({ size = "sm", variant = "light", asLink = true, className = "" }: Props) => {
  const sz = SIZES[size];
  const contentColor = variant === "dark" ? "text-white" : "text-[#1e3a5f]";

  const inner = (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className={`${sz.img} flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-slate-200`}>
        <img src={LOGO_URL} alt="ContentForge logo" className="h-full w-full object-contain" loading="eager" />
      </span>
      <span className={`${sz.text} font-bold tracking-tight leading-none`}>
        <span className={contentColor}>Content</span>
        <span className="text-amber-500">Forge</span>
      </span>
    </span>
  );

  return asLink ? (
    <Link to="/" data-testid="brand-logo" className="inline-flex items-center">
      {inner}
    </Link>
  ) : (
    inner
  );
};
