import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Zap,
  Image as ImageIcon,
  Film,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { CreditEstimate, getCreditAmountColor, getCreditBreakdownText } from "@/lib/creditEstimator";

interface CreditConfirmationModalProps {
  open: boolean;
  estimate: CreditEstimate | null;
  availableCredits: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const LEARNING_TYPE_CONFIG = {
  image: {
    icon: ImageIcon,
    label: "Image-Based (Flipbook)",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  video: {
    icon: Film,
    label: "Video Learning (HeyGen)",
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200",
  },
  static: {
    icon: BookOpen,
    label: "E-Learning (SCORM)",
    color: "text-slate-600",
    bg: "bg-slate-50 border-slate-200",
  },
};

export const CreditConfirmationModal: React.FC<CreditConfirmationModalProps> = ({
  open,
  estimate,
  availableCredits,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!estimate) return null;

  const config = LEARNING_TYPE_CONFIG[estimate.learningType];
  const Icon = config.icon;
  const hasEnoughCredits = estimate.totalCredits <= availableCredits;
  const remainingCredits = availableCredits - estimate.totalCredits;
  const amountColor = getCreditAmountColor(estimate.totalCredits);
  const breakdownText = getCreditBreakdownText(estimate);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Icon className={`w-5 h-5 ${config.color}`} />
            <DialogTitle>Confirm Credit Usage</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Review the estimated credits before starting generation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Learning Type */}
          <div className={`border rounded-lg p-3 ${config.bg}`}>
            <p className="text-sm font-semibold text-foreground">{config.label}</p>
            <p className="text-xs text-foreground/70 mt-1">{estimate.summary}</p>
          </div>

          {/* Credit Breakdown */}
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Credit Breakdown
            </p>
            <pre className="text-xs text-foreground/70 font-mono whitespace-pre-wrap">
              {breakdownText}
            </pre>
          </div>

          {/* Total & Balance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background border rounded-lg p-3">
              <p className="text-xs text-foreground/60">Credits to Use</p>
              <p className={`text-xl font-bold ${amountColor}`}>
                {estimate.totalCredits}
              </p>
            </div>
            <div className="bg-background border rounded-lg p-3">
              <p className="text-xs text-foreground/60">Available Credits</p>
              <p className="text-xl font-bold text-slate-600">{availableCredits}</p>
            </div>
          </div>

          {/* Remaining Balance & Warning */}
          <div className="space-y-2">
            {hasEnoughCredits ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <ArrowRight className="w-4 h-4" />
                <span>
                  Remaining: <span className="font-bold">{remainingCredits} credits</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4" />
                <span>
                  Insufficient credits. Need{" "}
                  <span className="font-bold">
                    {estimate.totalCredits - availableCredits} more
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Info Text */}
          <p className="text-xs text-foreground/60 text-center">
            This is an estimate. Actual usage may vary based on iterations and complexity.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!hasEnoughCredits || isLoading}
            className="flex-1"
          >
            {isLoading ? "Processing..." : "Confirm & Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
