import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface InsufficientCreditsModalProps {
  open: boolean;
  requiredCredits: number;
  onClose: () => void;
}

export const InsufficientCreditsModal = ({ open, requiredCredits, onClose }: InsufficientCreditsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Not enough credits
          </DialogTitle>
          <DialogDescription>
            You need <span className="font-semibold text-slate-900">{requiredCredits} credits</span> to generate this course, but you don't have enough.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">
            Buy more credits now and they'll be available instantly. 1 credit = 1 minute of generated content.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Link to="/#pricing" className="flex-1">
              <Button className="w-full" onClick={onClose}>
                Buy Credits
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
