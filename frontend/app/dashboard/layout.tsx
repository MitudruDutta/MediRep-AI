import { PatientContextProvider } from "@/lib/context/PatientContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PatientContextProvider>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </PatientContextProvider>
  );
}
