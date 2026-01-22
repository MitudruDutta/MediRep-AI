"use client";

import { useCallback } from "react";
import { Camera, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PillUploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function PillUploadZone({ onFileSelect, disabled }: PillUploadZoneProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={cn(
        "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
        disabled ? "border-muted bg-muted/20 cursor-not-allowed" : "border-border hover:border-primary/50 cursor-pointer"
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Camera className="h-16 w-16 text-muted-foreground" />
          <ImageIcon className="h-6 w-6 text-primary absolute -bottom-1 -right-1" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Upload Pill Image</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Take a clear photo of the pill on a white background with good lighting.
            Make sure any text or imprint is visible.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => document.getElementById("pill-file-input")?.click()}
            disabled={disabled}
          >
            <Upload className="h-4 w-4 mr-2" />
            Choose File
          </Button>
          <Button
            variant="outline"
            onClick={() => document.getElementById("pill-file-input")?.click()}
            disabled={disabled}
          >
            <Camera className="h-4 w-4 mr-2" />
            Take Photo
          </Button>
        </div>

        <input
          id="pill-file-input"
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />

        <p className="text-xs text-muted-foreground">
          Supports JPEG and PNG (max 10MB)
        </p>
      </div>
    </div>
  );
}
