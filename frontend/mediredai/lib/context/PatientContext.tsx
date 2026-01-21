"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { PatientContext as PatientContextType } from "@/types";

interface PatientContextState {
  patientContext: PatientContextType | null;
  setPatientContext: (context: PatientContextType | null) => void;
  isActive: boolean;
}

const PatientContext = createContext<PatientContextState | undefined>(undefined);

export function PatientContextProvider({ children }: { children: ReactNode }) {
  const [patientContext, setPatientContextState] = useState<PatientContextType | null>(null);

  const setPatientContext = (context: PatientContextType | null) => {
    setPatientContextState(context);
  };

  const isActive = patientContext !== null;

  return (
    <PatientContext.Provider value={{ patientContext, setPatientContext, isActive }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatientContext() {
  const context = useContext(PatientContext);
  if (context === undefined) {
    throw new Error("usePatientContext must be used within a PatientContextProvider");
  }
  return context;
}
