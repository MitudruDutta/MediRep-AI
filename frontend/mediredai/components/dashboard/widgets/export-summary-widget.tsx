"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { usePatientContext } from "@/lib/context/PatientContext";
import jsPDF from "jspdf";

export default function ExportSummaryWidget() {
  const { messages } = useChat();
  const { patientContext } = usePatientContext();

  const handleExport = () => {
    const doc = new jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.text("Clinical Consultation Summary", 20, yPosition);
    yPosition += 15;

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
    yPosition += 10;

    // Patient Context
    if (patientContext) {
      doc.setFontSize(14);
      doc.text("Patient Information", 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.text(`Age: ${patientContext.age} years`, 20, yPosition);
      yPosition += 6;
      doc.text(`Sex: ${patientContext.sex}`, 20, yPosition);
      yPosition += 6;

      if (patientContext.conditions.length > 0) {
        doc.text(`Conditions: ${patientContext.conditions.join(", ")}`, 20, yPosition);
        yPosition += 6;
      }

      if (patientContext.currentMeds.length > 0) {
        doc.text(`Current Medications: ${patientContext.currentMeds.join(", ")}`, 20, yPosition);
        yPosition += 6;
      }

      if (patientContext.allergies.length > 0) {
        doc.text(`Allergies: ${patientContext.allergies.join(", ")}`, 20, yPosition);
        yPosition += 6;
      }

      yPosition += 5;
    }

    // Conversation
    if (messages.length > 0) {
      doc.setFontSize(14);
      doc.text("Conversation", 20, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      messages.forEach((message) => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }

        const role = message.role === "user" ? "User" : "Assistant";
        doc.setFont("helvetica", "bold");
        doc.text(`${role}:`, 20, yPosition);
        doc.setFont("helvetica", "normal");
        yPosition += 6;

        const lines = doc.splitTextToSize(message.content, 170);
        lines.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 20, yPosition);
          yPosition += 5;
        });

        yPosition += 3;
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    doc.save(`medirep_summary_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <Card className="glass-card p-6">
      <h2 className="text-2xl font-bold mb-6">Export Summary</h2>

      <div className="space-y-4">
        <p className="text-muted-foreground">
          Export your consultation summary including patient context and conversation history as a PDF document.
        </p>

        <div className="p-4 bg-secondary/20 rounded-lg">
          <h3 className="font-semibold mb-2">Summary includes:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Patient information and context</li>
            <li>Complete conversation history</li>
            <li>Timestamps and citations</li>
            <li>Professional formatting</li>
          </ul>
        </div>

        <Button
          onClick={handleExport}
          disabled={messages.length === 0}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Export as PDF
        </Button>

        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Start a conversation to enable export
          </p>
        )}
      </div>
    </Card>
  );
}
