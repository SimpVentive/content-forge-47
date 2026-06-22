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
import { AlertCircle } from "lucide-react";
import { CreditEstimate } from "@/lib/creditEstimator";

interface CreditConfirmationModalProps {
  open: boolean;
  estimate: CreditEstimate | null;
  availableCredits: number;
  onConfirm: () => void;
  onCancel: () => void;
  onPurchase?: () => void;
  isLoading?: boolean;
}

export const CreditConfirmationModal: React.FC<CreditConfirmationModalProps> = ({
  open,
  estimate,
  availableCredits,
  onConfirm,
  onCancel,
  onPurchase,
  isLoading = false,
}) => {
  if (!estimate) return null;

  const hasEnoughCredits = estimate.totalCredits <= availableCredits;
  const shortfall = estimate.totalCredits - availableCredits;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Generation</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Credits Required */}
          <div className="space-y-2">
            <p className="text-sm text-foreground/70">The course to be generated will require</p>
            <p className="text-3xl font-bold text-blue-600">{estimate.totalCredits} Credits</p>
          </div>

          {/* Current Balance */}
          <div className="space-y-2">
            <p className="text-sm text-foreground/70">You currently have a balance of</p>
            <p className="text-3xl font-bold text-slate-700">{availableCredits} Credits</p>
          </div>

          {/* Insufficient Credits Warning */}
          {!hasEnoughCredits && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                You need <span className="font-bold">{shortfall} more credits</span> to generate this course.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {hasEnoughCredits ? (
            <>
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
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "Generating..." : "Generate"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={onPurchase}
                disabled={isLoading}
                className="flex-1"
              >
                Purchase Credits
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
