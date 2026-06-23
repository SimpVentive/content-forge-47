import { useState } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { QAIssue, QAResult, QACorrection } from "@/lib/qaService";

interface QAResultsDialogProps {
  open: boolean;
  qaResult: QAResult;
  onApply: () => void;
  onSkip: () => void;
  isApplying?: boolean;
}

const severityConfig = {
  critical: { color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: AlertCircle },
  high: { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", icon: AlertTriangle },
  medium: { color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", icon: Info },
  low: { color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: CheckCircle2 },
};

export function QAResultsDialog({ open, qaResult, onApply, onSkip, isApplying }: QAResultsDialogProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set([0]));

  const toggleIssue = (index: number) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const config = severityConfig[qaResult.overallSeverity];
  const Icon = config.icon;

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.color}`} />
            QA Review Results
          </DialogTitle>
          <DialogDescription>
            {qaResult.issuesFound.length} issue{qaResult.issuesFound.length !== 1 ? "s" : ""} found • Severity:{" "}
            <span className={`font-semibold ${config.color}`}>{qaResult.overallSeverity.toUpperCase()}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Report */}
          <div className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
            <h3 className="font-semibold mb-2 text-sm">Summary</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{qaResult.report}</p>
          </div>

          {/* Issues List */}
          {qaResult.issuesFound.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Issues Found</h3>
              {qaResult.issuesFound.map((issue, idx) => (
                <IssueCard key={idx} issue={issue} index={idx} expanded={expandedIssues.has(idx)} onToggle={toggleIssue} />
              ))}
            </div>
          )}

          {/* Corrections Applied */}
          {qaResult.correctionsApplied.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Proposed Fixes</h3>
              <div className="space-y-2">
                {qaResult.correctionsApplied.map((corr, idx) => (
                  <CorrectionCard key={idx} correction={corr} />
                ))}
              </div>
            </div>
          )}

          {/* No issues message */}
          {qaResult.issuesFound.length === 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-green-900">No issues found</h4>
                <p className="text-sm text-green-700">Your course output passed QA review!</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onSkip} disabled={isApplying}>
            Skip QA Fixes
          </Button>
          <Button onClick={onApply} disabled={isApplying || qaResult.issuesFound.length === 0}>
            {isApplying ? "Applying fixes..." : "Apply Fixes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueCard({ issue, index, expanded, onToggle }: { issue: QAIssue; index: number; expanded: boolean; onToggle: (i: number) => void }) {
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div className={`border rounded-lg overflow-hidden ${config.border}`}>
      <button
        onClick={() => onToggle(index)}
        className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${config.bg}`}
      >
        <Icon className={`w-4 h-4 ${config.color} flex-shrink-0`} />
        <div className="flex-1 text-left">
          <p className="font-semibold text-sm">{issue.category.replace(/_/g, " ")}</p>
          <p className="text-xs text-gray-600">{issue.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="p-3 bg-white border-t border-gray-200 space-y-2">
          {issue.location && (
            <div>
              <p className="text-xs font-semibold text-gray-700">Location:</p>
              <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">{issue.location}</p>
            </div>
          )}

          {issue.examples && issue.examples.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700">Examples:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {issue.examples.map((ex, i) => (
                  <li key={i} className="pl-4 before:content-['•'] before:mr-2">
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CorrectionCard({ correction }: { correction: QACorrection }) {
  return (
    <div className="border border-green-200 bg-green-50 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-green-900">{correction.type.replace(/_/g, " ")}</p>
          <p className="text-sm text-green-800 mt-1">{correction.description}</p>
          {(correction.tokensAdded || correction.tokensRemoved) && (
            <p className="text-xs text-green-700 mt-1">
              {correction.tokensAdded && <span>+{correction.tokensAdded} tokens </span>}
              {correction.tokensRemoved && <span>-{correction.tokensRemoved} tokens</span>}
            </p>
          )}
        </div>
        <span className="text-xs font-medium text-green-700 bg-white px-2 py-1 rounded whitespace-nowrap">{correction.section}</span>
      </div>
    </div>
  );
}
