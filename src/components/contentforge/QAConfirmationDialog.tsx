import { CheckCircle2, AlertCircle } from "lucide-react";

interface QAConfirmationDialogProps {
  open: boolean;
  onProceedWithQA: () => void;
  onProceedWithout: () => void;
  isLoading?: boolean;
}

export function QAConfirmationDialog({
  open,
  onProceedWithQA,
  onProceedWithout,
  isLoading = false,
}: QAConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-[500px] max-w-[92vw] rounded-2xl bg-white shadow-2xl overflow-hidden animate-fade-in border border-blue-200">
        {/* Header */}
        <div className="h-2 w-full bg-gradient-to-r from-primary via-blue-500 to-primary" />

        <div className="px-8 pt-7 pb-6">
          {/* Icon and Title */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shrink-0 shadow-lg">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-[20px] font-extrabold text-foreground">Final Quality Check</h2>
          </div>

          {/* Message */}
          <p className="text-[14px] text-foreground mb-6 leading-relaxed">
            Your course output has been generated successfully!
          </p>

          {/* Features List */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-[13px] font-bold text-blue-900 mb-3">Would you like us to perform a final quality check?</p>
            <ul className="space-y-2 text-[12px] text-blue-800">
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Validate image-narrative-topic alignment</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Check for missing content or steps</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Ensure visual consistency throughout</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Auto-fix identified issues</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <span>Store findings for algorithm learning</span>
              </li>
            </ul>
          </div>

          {/* Note */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 mb-6">
            <p className="text-[12px] text-amber-800 leading-relaxed">
              <span className="font-bold">📝 Note:</span> All findings and corrections will be stored to continuously improve our AI generation engine.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onProceedWithout}
              disabled={isLoading}
              className="h-11 px-6 rounded-lg text-[13px] font-bold border-2 border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              No, Skip Check
            </button>
            <button
              onClick={onProceedWithQA}
              disabled={isLoading}
              className="h-11 px-6 rounded-lg text-[13px] font-bold bg-gradient-to-r from-primary to-blue-600 text-white hover:brightness-110 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="inline-block animate-spin">⟳</span>
                  Running Check...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Yes, Run Final Check
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
