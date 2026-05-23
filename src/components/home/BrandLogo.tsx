import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LOGO_URL =
  "https://customer-assets.emergentagent.com/job_design-preview-170/artifacts/7e6vqb4u_image.png";

type Size = "sm" | "md" | "lg" | "xl" | "2xl";
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
  xl: { img: "h-24 w-24", text: "text-5xl" },
  "2xl": { img: "h-32 w-32", text: "text-6xl" },
};

export const BrandLogo = ({ size = "sm", variant = "light", asLink = true, className = "" }: Props) => {
  const sz = SIZES[size];
  const contentColor = variant === "dark" ? "text-white" : "text-[#1e3a5f]";
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

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

  if (!asLink) return inner;

  return (
    <>
      <button
        type="button"
        data-testid="brand-logo"
        onClick={() => setOpen(true)}
        className="inline-flex items-center bg-transparent border-0 p-0 cursor-pointer"
      >
        {inner}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go back to home page?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to go back to the home page? Any unsaved changes on this screen may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOpen(false); navigate("/"); }}>
              Yes, go home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
