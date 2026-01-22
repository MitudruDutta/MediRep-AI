"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Loader2 } from "lucide-react";
import { identifyPill } from "@/lib/api";
import { PillIdentification } from "@/types";
import Image from "next/image";

export default function PillScanner() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<PillIdentification | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleScan = async () => {
    if (!image) return;

    setIsScanning(true);
    try {
      const response = await identifyPill(image);
      setResult(response);
    } catch (error) {
      console.error("Error scanning pill:", error);
      alert("Failed to identify pill. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="glass-card p-6">
      <h2 className="text-2xl font-bold mb-6">Pill Scanner</h2>

      <div className="space-y-6">
        {!preview ? (
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
            <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Upload an image of a pill to identify it
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
              <Image
                src={preview}
                alt="Pill preview"
                fill
                className="object-contain"
              />
            </div>

            {!result && (
              <div className="flex gap-2">
                <Button onClick={handleScan} disabled={isScanning} className="flex-1">
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    "Scan Pill"
                  )}
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Reset
                </Button>
              </div>
            )}

            {result && (
              <Card className="p-4 border-primary/20">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{result.name}</h3>
                    <p className="text-sm text-muted-foreground">{result.description}</p>
                  </div>
                  <Badge variant="outline">
                    {Math.round(result.confidence * 100)}% confident
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  {result.color && (
                    <div>
                      <p className="text-muted-foreground">Color</p>
                      <p className="font-medium">{result.color}</p>
                    </div>
                  )}
                  {result.shape && (
                    <div>
                      <p className="text-muted-foreground">Shape</p>
                      <p className="font-medium">{result.shape}</p>
                    </div>
                  )}
                  {result.imprint && (
                    <div>
                      <p className="text-muted-foreground">Imprint</p>
                      <p className="font-medium">{result.imprint}</p>
                    </div>
                  )}
                </div>

                <Button onClick={handleReset} variant="outline" className="w-full mt-4">
                  Scan Another
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
