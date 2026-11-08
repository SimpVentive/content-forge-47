import React from "react";
import { X } from "lucide-react";

interface SOPFormatDialogProps {
  open: boolean;
  /** True when the content looks like an SOP; otherwise the generic wording is shown. */
  detected?: boolean;
  onFormatSelect: (format: "learning-course" | "work-instruction") => void;
}

export const SOPFormatDialog: React.FC<SOPFormatDialogProps> = ({ open, detected = true, onFormatSelect }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-[24px] font-bold text-foreground">
            {detected ? "We Detected an SOP" : "Choose Content Format"}
          </h2>
          <p className="text-[14px] text-muted-foreground mt-2">
            {detected
              ? "How would you like to create content from this Standard Operating Procedure?"
              : "How would you like to create content from this material?"}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {/* Learning Course */}
          <button
            onClick={() => onFormatSelect("learning-course")}
            type="button"
            className="w-full p-4 rounded-xl border-2 border-blue-600 bg-blue-50 hover:bg-blue-100 transition-all text-left"
          >
            <div className="flex items-start gap-3">
              <div className="text-[20px] mt-1">📚</div>
              <div>
                <p className="font-semibold text-[14px] text-foreground">Learning Course</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Complete with theory, visuals & assessment
                </p>
              </div>
            </div>
          </button>

          {/* Work Instruction */}
          <button
            onClick={() => onFormatSelect("work-instruction")}
            type="button"
            className="w-full p-4 rounded-xl border-2 border-border hover:border-primary bg-card hover:bg-secondary transition-all text-left"
          >
            <div className="flex items-start gap-3">
              <div className="text-[20px] mt-1">⚙️</div>
              <div>
                <p className="font-semibold text-[14px] text-foreground">Work Instruction</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Bare-bones steps for frontline operators
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="text-[12px] text-muted-foreground text-center">
          You can change this later in course settings
        </p>
      </div>
    </div>
  );
};
