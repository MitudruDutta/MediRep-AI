"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, FileDown } from "lucide-react";
import { toast } from "sonner";
import {
  ExportFormatSelector,
  ExportPreview,
  ExportHistory,
  ExportStats,
  ExportOptions,
  ExportSummaryCard,
} from "@/components/ExportSummary";
import { ExportFormat } from "@/components/ExportSummary/export-format-selector";
import { ExportOptionsData } from "@/components/ExportSummary/export-options";
import { ExportHistoryItem } from "@/components/ExportSummary/export-history";
import { DrugInteraction, FDAAlert } from "@/types";

export default function ExportSummaryWidget() {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("json");
  const [isLoading, setIsLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  
  const [exportOptions, setExportOptions] = useState<ExportOptionsData>({
    includeDrugInfo: true,
    includeInteractions: true,
    includeAlerts: true,
    includeSavedDrugs: true,
    includeTimestamp: true,
    includeMetadata: true,
  });

  // Sample data - in real app, fetch from API
  const [exportData, setExportData] = useState({
    drugs: [
      { name: "Aspirin", generic_name: "Acetylsalicylic acid", manufacturer: "Bayer" },
      { name: "Warfarin", generic_name: "Warfarin sodium", manufacturer: "Bristol-Myers Squibb" },
      { name: "Lisinopril", generic_name: "Lisinopril", manufacturer: "Merck" },
    ],
    interactions: [
      {
        drug1: "Aspirin",
        drug2: "Warfarin",
        severity: "major" as const,
        description: "Increased risk of bleeding when used together",
        recommendation: "Monitor closely and adjust dosage as needed",
      },
      {
        drug1: "Aspirin",
        drug2: "Lisinopril",
        severity: "moderate" as const,
        description: "May reduce effectiveness of blood pressure medication",
        recommendation: "Monitor blood pressure regularly",
      },
    ] as DrugInteraction[],
    alerts: [
      {
        id: "1",
        severity: "warning" as const,
        title: "Aspirin - Bleeding Risk",
        description: "FDA warns about increased bleeding risk in elderly patients",
        date: "2024-01-15",
      },
    ] as FDAAlert[],
    savedDrugs: [
      { drug_name: "Aspirin", notes: "Take with food" },
      { drug_name: "Warfarin", notes: "Regular INR monitoring required" },
    ],
  });

  useEffect(() => {
    // Load export history from localStorage
    const savedHistory = localStorage.getItem("exportHistory");
    if (savedHistory) {
      setExportHistory(JSON.parse(savedHistory));
    }
  }, []);

  const handleExport = () => {
    setIsLoading(true);
    
    try {
      const filteredData: any = {};

      if (exportOptions.includeDrugInfo) {
        filteredData.drugs = exportData.drugs;
      }
      if (exportOptions.includeInteractions) {
        filteredData.interactions = exportData.interactions;
      }
      if (exportOptions.includeAlerts) {
        filteredData.alerts = exportData.alerts;
      }
      if (exportOptions.includeSavedDrugs) {
        filteredData.savedDrugs = exportData.savedDrugs;
      }
      if (exportOptions.includeTimestamp) {
        filteredData.timestamp = new Date().toISOString();
      }
      if (exportOptions.includeMetadata) {
        filteredData.metadata = {
          totalDrugs: exportData.drugs.length,
          totalInteractions: exportData.interactions.length,
          totalAlerts: exportData.alerts.length,
          exportFormat: selectedFormat,
        };
      }

      let content = "";
      let mimeType = "";
      let extension = "";

      switch (selectedFormat) {
        case "json":
          content = JSON.stringify(filteredData, null, 2);
          mimeType = "application/json";
          extension = "json";
          break;
        case "csv":
          content = generateCSV(filteredData);
          mimeType = "text/csv";
          extension = "csv";
          break;
        case "xml":
          content = generateXML(filteredData);
          mimeType = "application/xml";
          extension = "xml";
          break;
        case "pdf":
          toast.error("PDF export not yet implemented");
          setIsLoading(false);
          return;
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `drug-export-${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Add to history
      const newHistoryItem: ExportHistoryItem = {
        id: Date.now().toString(),
        format: selectedFormat,
        timestamp: new Date().toISOString(),
        size: `${(blob.size / 1024).toFixed(2)} KB`,
        itemCount: Object.keys(filteredData).length,
      };

      const updatedHistory = [newHistoryItem, ...exportHistory].slice(0, 10);
      setExportHistory(updatedHistory);
      localStorage.setItem("exportHistory", JSON.stringify(updatedHistory));

      toast.success(`Export completed successfully as ${selectedFormat.toUpperCase()}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setIsLoading(false);
    }
  };

  const generateCSV = (data: any) => {
    let csv = "";
    
    if (data.drugs) {
      csv += "Drug Name,Generic Name,Manufacturer\n";
      data.drugs.forEach((drug: any) => {
        csv += `"${drug.name || ""}","${drug.generic_name || ""}","${drug.manufacturer || ""}"\n`;
      });
      csv += "\n";
    }

    if (data.interactions) {
      csv += "Drug 1,Drug 2,Severity,Description,Recommendation\n";
      data.interactions.forEach((interaction: any) => {
        csv += `"${interaction.drug1}","${interaction.drug2}","${interaction.severity}","${interaction.description}","${interaction.recommendation || ""}"\n`;
      });
      csv += "\n";
    }

    if (data.alerts) {
      csv += "Alert ID,Severity,Title,Description,Date\n";
      data.alerts.forEach((alert: any) => {
        csv += `"${alert.id}","${alert.severity}","${alert.title}","${alert.description}","${alert.date || ""}"\n`;
      });
    }

    return csv;
  };

  const generateXML = (data: any) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<export>\n';
    
    if (data.drugs) {
      xml += '  <drugs>\n';
      data.drugs.forEach((drug: any) => {
        xml += `    <drug>\n`;
        xml += `      <name>${escapeXml(drug.name || "")}</name>\n`;
        xml += `      <generic_name>${escapeXml(drug.generic_name || "")}</generic_name>\n`;
        xml += `      <manufacturer>${escapeXml(drug.manufacturer || "")}</manufacturer>\n`;
        xml += `    </drug>\n`;
      });
      xml += '  </drugs>\n';
    }

    if (data.interactions) {
      xml += '  <interactions>\n';
      data.interactions.forEach((interaction: any) => {
        xml += `    <interaction severity="${interaction.severity}">\n`;
        xml += `      <drug1>${escapeXml(interaction.drug1)}</drug1>\n`;
        xml += `      <drug2>${escapeXml(interaction.drug2)}</drug2>\n`;
        xml += `      <description>${escapeXml(interaction.description)}</description>\n`;
        xml += `    </interaction>\n`;
      });
      xml += '  </interactions>\n';
    }

    if (data.timestamp) {
      xml += `  <timestamp>${data.timestamp}</timestamp>\n`;
    }

    xml += '</export>';
    return xml;
  };

  const escapeXml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  const handleDownloadHistory = (id: string) => {
    toast.info("Re-downloading previous export...");
    // In real app, retrieve and download the saved export
  };

  const handleDeleteHistory = (id: string) => {
    const updatedHistory = exportHistory.filter(item => item.id !== id);
    setExportHistory(updatedHistory);
    localStorage.setItem("exportHistory", JSON.stringify(updatedHistory));
    toast.success("Export deleted from history");
  };

  const stats = {
    drugCount: exportData.drugs.length,
    interactionCount: exportData.interactions.length,
    alertCount: exportData.alerts.length,
    savedDrugCount: exportData.savedDrugs.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Export Summary</h2>
          <p className="text-muted-foreground mt-1">
            Export drug data, interactions, and alerts in multiple formats
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button 
            size="sm" 
            onClick={handleExport}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <ExportStats {...stats} />

      {/* Format Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Export Format</CardTitle>
        </CardHeader>
        <CardContent>
          <ExportFormatSelector
            selectedFormat={selectedFormat}
            onFormatChange={setSelectedFormat}
          />
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Options & Summary */}
        <div className="space-y-6">
          <ExportOptions
            options={exportOptions}
            onOptionsChange={setExportOptions}
          />
          
          <ExportSummaryCard
            drugs={exportData.drugs.map(d => d.name)}
            interactions={exportData.interactions}
            alerts={exportData.alerts}
          />
        </div>

        {/* Middle Column - Preview */}
        <div className="lg:col-span-2">
          <ExportPreview
            format={selectedFormat}
            options={exportOptions}
            data={exportData}
          />
        </div>
      </div>

      {/* Export History */}
      <ExportHistory
        history={exportHistory}
        onDownload={handleDownloadHistory}
        onDelete={handleDeleteHistory}
      />
    </div>
  );
}
