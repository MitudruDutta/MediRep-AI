"use client";

import * as React from "react";
import { AlertCard, FDAAlert } from "./alert-card";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface AlertListProps {
  alerts: FDAAlert[];
  className?: string;
  emptyMessage?: string;
}

export function AlertList({ alerts, className, emptyMessage }: AlertListProps) {
  if (alerts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={cn("flex flex-col items-center justify-center py-12 text-center", className)}
      >
        <div className="rounded-full bg-green-500/10 p-6 mb-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Alerts Found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {emptyMessage || "No FDA alerts or recalls found for this drug. This is good news!"}
        </p>
      </motion.div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <AnimatePresence mode="popLayout">
        {alerts.map((alert, index) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{
              duration: 0.3,
              delay: index * 0.08,
              ease: "easeOut"
            }}
          >
            <AlertCard alert={alert} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
