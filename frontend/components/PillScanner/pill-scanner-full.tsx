"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scan, BarChart3, HelpCircle, History } from "lucide-react";
import PillScanner from "./index";
import PillScannerStats from "./pill-scanner-stats";
import PillScannerHelp from "./pill-scanner-help";
import PillExamples from "./pill-examples";
import PillScanHistory from "./pill-scan-history";

export default function PillScannerFull() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pill Scanner</h1>
        <p className="text-muted-foreground">
          AI-powered pill identification using visual recognition and database matching
        </p>
      </div>

      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="scanner" className="gap-2">
            <Scan className="h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="help" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Help
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scanner" className="mt-6">
          <PillScanner />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <PillScanHistory />
        </TabsContent>

        <TabsContent value="stats" className="mt-6 space-y-6">
          <PillScannerStats />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Technology Stack</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="font-medium">Gemini Vision AI</p>
                    <p className="text-sm text-muted-foreground">
                      Advanced OCR and visual feature extraction
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="font-medium">Turso Database</p>
                    <p className="text-sm text-muted-foreground">
                      250K+ Indian drug records with text search
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="font-medium">Qdrant Vector DB</p>
                    <p className="text-sm text-muted-foreground">
                      Semantic similarity search for visual matching
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div>
                    <p className="font-medium">Sentence Transformers</p>
                    <p className="text-sm text-muted-foreground">
                      all-MiniLM-L6-v2 model for embeddings
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Search Strategy</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Text Search</p>
                    <p className="text-sm text-muted-foreground">
                      Direct matching on imprint text in Turso database
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Vector Search</p>
                    <p className="text-sm text-muted-foreground">
                      Semantic similarity on combined features in Qdrant
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Score Ranking</p>
                    <p className="text-sm text-muted-foreground">
                      Results sorted by confidence with top 5 matches
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="help" className="mt-6 space-y-6">
          <PillScannerHelp />
          <PillExamples />
        </TabsContent>
      </Tabs>
    </div>
  );
}
