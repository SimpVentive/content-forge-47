/**
 * ValidationModal - Displays SCORM validation results to the user
 * Shows pre-export and post-export validation gates with actionable feedback
 */

import React from "react";
import { AlertTriangle, CheckCircle, AlertCircle, Info, X } from "lucide-react";
import type { ValidationReport } from "@/lib/scormValidator";
import type { PackageValidationReport } from "@/lib/scormPackageValidator";

export interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed?: () => void;
  validationReport?: ValidationReport;
  packageReport?: PackageValidationReport;
  stage: "pre-export" | "post-export";
  isLoading?: boolean;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  validationReport,
  packageReport,
  stage,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const report = stage === "pre-export" ? validationReport : packageReport;
  if (!report) return null;

  const isPreExport = stage === "pre-export";
  const canProceed =
    isPreExport && report.overallStatus !== "failed"
      ? true
      : !isPreExport && "isValid" in report
        ? report.isValid
        : false;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            {isPreExport ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <CheckCircle className="w-6 h-6" />
            )}
            <div>
              <h2 className="text-xl font-bold">
                {isPreExport ? "Pre-Export Validation" : "Package Verification"}
              </h2>
              <p className="text-sm text-slate-300">
                {isPreExport
                  ? "Checking course structure and content..."
                  : "Validating SCORM package structure..."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Validation Status
              </p>
              <div className="flex items-center gap-2">
                {report.overallStatus === "passed" ||
                ("isValid" in report && report.isValid) ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-bold text-green-700">All checks passed</span>
                  </>
                ) : report.overallStatus === "warning" ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="font-bold text-yellow-700">Warnings detected</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="font-bold text-red-700">Issues found</span>
                  </>
                )}
              </div>
            </div>

            {/* Score */}
            {isPreExport && "overallStatus" in report && (
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-600 mb-1">Quality Score</p>
                <p className="text-3xl font-bold text-indigo-600">
                  {Math.round(
                    (report.passedChecks / (report.totalChecks || 1)) * 100
                  )}%
                </p>
              </div>
            )}

            {!isPreExport && "fileSize" in report && (
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-600 mb-1">Package Size</p>
                <p className="text-lg font-bold text-slate-900">
                  {(report.fileSize / (1024 * 1024)).toFixed(1)}MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Issues */}
        <div className="px-6 py-4 space-y-4">
          {/* Critical Issues */}
          {isPreExport && "summary" in report && report.summary.criticalIssues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-700">
                  {report.summary.criticalIssues.length} Critical Issue
                  {report.summary.criticalIssues.length !== 1 ? "s" : ""}
                </h3>
              </div>
              <div className="space-y-2 ml-7">
                {report.summary.criticalIssues.map((issue, idx) => (
                  <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                    <p className="font-semibold text-red-900 text-sm">{issue.message}</p>
                    {issue.details && (
                      <p className="text-xs text-red-700 mt-1">{issue.details}</p>
                    )}
                    {issue.suggestion && (
                      <p className="text-xs text-red-600 mt-1 font-semibold">
                        💡 {issue.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isPreExport && "summary" in report && report.summary.critical > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-700">
                  {report.summary.critical} Critical Issue{report.summary.critical !== 1 ? "s" : ""}
                </h3>
              </div>
              <div className="space-y-2 ml-7">
                {report.checks
                  .filter((c) => !c.passed && c.severity === "critical")
                  .map((check, idx) => (
                    <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                      <p className="font-semibold text-red-900 text-sm">{check.check}</p>
                      {check.details && (
                        <p className="text-xs text-red-700 mt-1">{check.details}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {isPreExport && "summary" in report && report.summary.warnings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <h3 className="font-bold text-yellow-700">
                  {report.summary.warnings.length} Warning{report.summary.warnings.length !== 1 ? "s" : ""}
                </h3>
              </div>
              <div className="space-y-2 ml-7">
                {report.summary.warnings.map((warning, idx) => (
                  <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                    <p className="font-semibold text-yellow-900 text-sm">{warning.message}</p>
                    {warning.details && (
                      <p className="text-xs text-yellow-700 mt-1">{warning.details}</p>
                    )}
                    {warning.suggestion && (
                      <p className="text-xs text-yellow-600 mt-1 font-semibold">
                        💡 {warning.suggestion}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isPreExport && "summary" in report && report.summary.warnings > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <h3 className="font-bold text-yellow-700">
                  {report.summary.warnings} Warning{report.summary.warnings !== 1 ? "s" : ""}
                </h3>
              </div>
              <div className="space-y-2 ml-7">
                {report.checks
                  .filter((c) => !c.passed && c.severity === "warning")
                  .map((check, idx) => (
                    <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                      <p className="font-semibold text-yellow-900 text-sm">{check.check}</p>
                      {check.details && (
                        <p className="text-xs text-yellow-700 mt-1">{check.details}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Passed Checks Summary */}
          {((isPreExport && "summary" in report && report.summary.infos.length > 0) ||
            (!isPreExport && "summary" in report && report.summary.passed > 0)) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-green-700">
                  {isPreExport
                    ? report.summary.infos.length
                    : (report as PackageValidationReport).summary.passed}{" "}
                  Check{isPreExport ? (report.summary.infos.length !== 1 ? "s" : "") : ((report as PackageValidationReport).summary.passed !== 1 ? "s" : "")} Passed
                </h3>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex gap-2 items-start">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-900 mb-2">Recommendations</p>
                  <ul className="space-y-1">
                    {report.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-blue-800">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg font-semibold transition-colors"
          >
            {isPreExport ? (canProceed ? "Review Issues" : "Close") : "Close"}
          </button>

          {canProceed && onProceed && (
            <button
              onClick={onProceed}
              disabled={isLoading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {isPreExport ? "Generating Package..." : "Finalizing..."}
                </>
              ) : isPreExport ? (
                "Proceed to Export"
              ) : (
                "Done"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationModal;
