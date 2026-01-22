"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileJson, FileText, FileSpreadsheet } from "lucide-react";
import { FDAAlert } from "./alert-card";

export interface AlertExportProps {
  alerts: FDAAlert[];
  drugName: string;
  disabled?: boolean;
}

export function AlertExport({ alerts, drugName, disabled }: AlertExportProps) {
  const exportAsJSON = () => {
    try {
      const data = {
        drug_name: drugName,
        alerts,
        timestamp: new Date().toISOString(),
        summary: {
          total: alerts.length,
          recall: alerts.filter((a) => a.severity === "recall").length,
          warning: alerts.filter((a) => a.severity === "warning").length,
          info: alerts.filter((a) => a.severity === "info").length,
        },
      };

      const jsonString = JSON.stringify(data, null, 2);
      downloadFile(jsonString, `fda-alerts-${drugName}.json`, "application/json");
    } catch (error) {
      console.error("Error exporting JSON:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  const exportAsCSV = () => {
    try {
      const headers = ["ID", "Severity", "Title", "Description", "Date", "Lot Numbers"];
      const rows = alerts.map((alert) => [
        alert.id,
        alert.severity,
        `"${alert.title.replace(/"/g, '""')}"`,
        `"${alert.description.replace(/"/g, '""')}"`,
        alert.date || "N/A",
        `"${alert.lot_numbers.join(", ")}"`,
      ]);

      const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      downloadFile(csv, `fda-alerts-${drugName}.csv`, "text/csv");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  const exportAsText = () => {
    try {
      const text = [
        `FDA Safety Alerts for ${drugName}`,
        `Generated: ${new Date().toLocaleString()}`,
        `Total Alerts: ${alerts.length}`,
        "",
        "=" .repeat(80),
        "",
        ...alerts.map((alert, index) => {
          return [
            `Alert ${index + 1}: ${alert.title}`,
            `ID: ${alert.id}`,
            `Severity: ${alert.severity.toUpperCase()}`,
            `Date: ${alert.date || "N/A"}`,
            `Description: ${alert.description}`,
            alert.lot_numbers.length > 0 ? `Lot Numbers: ${alert.lot_numbers.join(", ")}` : "",
            "",
            "-".repeat(80),
            "",
          ]
            .filter(Boolean)
            .join("\n");
        }),
      ].join("\n");

      downloadFile(text, `fda-alerts-${drugName}.txt`, "text/plain");
    } catch (error) {
      console.error("Error exporting text:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportAsJSON}>
          <FileJson className="h-4 w-4 mr-2" />
          JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsText}>
          <FileText className="h-4 w-4 mr-2" />
          Text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
