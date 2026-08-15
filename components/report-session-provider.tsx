"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { bootstrapReportSession } from "@/lib/report-session-client";

const ReportSessionContext = createContext(false);

export function ReportSessionProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void bootstrapReportSession()
      .catch((error: unknown) => {
        console.error("Failed to initialize the report session.", error);
      })
      .finally(() => setIsReady(true));
  }, []);

  return (
    <ReportSessionContext.Provider value={isReady}>
      {children}
    </ReportSessionContext.Provider>
  );
}

export function useReportSessionReady() {
  return useContext(ReportSessionContext);
}
