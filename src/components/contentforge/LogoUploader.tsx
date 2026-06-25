import React, { useRef, useState } from "react";
import { Upload, X, Check } from "lucide-react";

interface LogoUploaderProps {
  logoDataUrl?: string;
  onLogoChange: (dataUrl: string | null) => void;
}

export const LogoUploader: React.FC<LogoUploaderProps> = ({ logoDataUrl, onLogoChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG, JPG, SVG)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Logo file must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onLogoChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  return (
    <div>
      <label className="text-[14px] font-semibold text-foreground mb-2 block">Company Logo</label>
      <p className="text-[12px] text-muted-foreground mb-3">PNG, JPG, or SVG (max 2MB). Will appear on first page & as footer on others.</p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      {logoDataUrl ? (
        <div className="border-[1.5px] border-border rounded-xl p-4 bg-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logoDataUrl} alt="Company logo" className="h-16 w-16 object-contain rounded-lg border border-border" />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-foreground">Logo uploaded</p>
              <p className="text-[12px] text-muted-foreground">Will appear on all outputs</p>
            </div>
          </div>
          <button
            onClick={() => onLogoChange(null)}
            type="button"
            className="p-2 hover:bg-secondary rounded-lg transition-all"
            title="Remove logo"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsHovering(true);
          }}
          onDragLeave={() => setIsHovering(false)}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
            isHovering
              ? "border-primary bg-primary/[0.04]"
              : "border-primary/25 hover:bg-primary/[0.04] hover:border-primary"
          }`}
          style={{
            boxShadow: isHovering
              ? "0 2px 0 rgba(0,0,0,0.04), 0 4px 10px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)"
              : "0 2px 0 rgba(0,0,0,0.04), 0 4px 10px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-[13px] font-semibold text-foreground">Drop logo here</p>
          <span className="text-primary text-[12px] font-semibold underline underline-offset-2">or browse</span>
        </div>
      )}
    </div>
  );
};
