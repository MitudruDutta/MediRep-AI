"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Activity, Pill, AlertTriangle, TrendingUp } from "lucide-react";
import { PatientContext } from "@/types";

interface PatientStatsProps {
  patientContext: PatientContext;
}

export function PatientStats({ patientContext }: PatientStatsProps) {
  const stats = [
    {
      label: "Medical Conditions",
      value: patientContext.conditions.length,
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900",
    },
    {
      label: "Current Medications",
      value: patientContext.currentMeds.length,
      icon: Pill,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900",
    },
    {
      label: "Known Allergies",
      value: patientContext.allergies.length,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900",
    },
    {
      label: "Risk Factors",
      value: patientContext.conditions.length + patientContext.allergies.length,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
