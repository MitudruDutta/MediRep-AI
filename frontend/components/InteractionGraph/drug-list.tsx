"use client";

import * as React from "react";
import { X, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export interface DrugListProps {
  drugs: string[];
  onRemove: (index: number) => void;
  className?: string;
}

export function DrugList({ drugs, onRemove, className }: DrugListProps) {
  if (drugs.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="rounded-full bg-muted p-4 mb-4">
          <Pill className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No drugs added yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add drugs to check for interactions</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence mode="popLayout">
        {drugs.map((drug, index) => (
          <motion.div
            key={drug}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Pill className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{drug}</p>
                <p className="text-xs text-muted-foreground">Drug #{index + 1}</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
