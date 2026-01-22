"use client";

import { Button } from "@/components/ui/button";
import { Download, FileJson, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PatientContext } from "@/types";

interface PatientExportProps {
  patientContext: PatientContext | null;
}

export function PatientExport({ patientContext }: PatientExportProps) {
  const exportAsJSON = () => {
    if (!patientContext) return;

    const data = {
      patientContext,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `patient-context-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsText = () => {
    if (!patientContext) return;

    const lines = [
      "PATIENT CONTEXT SUMMARY",
      "=".repeat(50),
      "",
      "Demographics:",
      `  Age: ${patientContext.age} years`,
      `  Sex: ${patientContext.sex}`,
      "",
      "Medical Conditions:",
      patientContext.conditions.length > 0
        ? patientContext.conditions.map((c) => `  - ${c}`).join("\n")
        : "  None recorded",
      "",
      "Current Medications:",
      patientContext.currentMeds.length > 0
        ? patientContext.currentMeds.map((m) => `  - ${m}`).join("\n")
        : "  None recorded",
      "",
      "Allergies:",
      patientContext.allergies.length > 0
        ? patientContext.allergies.map((a) => `  - ${a}`).join("\n")
        : "  None recorded",
      "",
      "=".repeat(50),
      `Exported: ${new Date().toLocaleString()}`,
    ];

    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `patient-context-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!patientContext}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportAsJSON}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsText}>
          <FileText className="h-4 w-4 mr-2" />
          Export as Text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
