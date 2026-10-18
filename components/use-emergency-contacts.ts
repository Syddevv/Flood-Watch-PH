"use client";

import { useEffect, useState } from "react";

import type { PublicEmergencyContact } from "@/lib/types";

export function useEmergencyContacts() {
  const [contacts, setContacts] = useState<PublicEmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/emergency-contacts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load emergency contacts.");
        setContacts(payload.data.contacts);
      })
      .catch((cause) => { if (!controller.signal.aborted) { setContacts([]); setError(cause instanceof Error ? cause.message : "Unable to load emergency contacts."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey]);

  const refresh = () => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); };
  return { contacts, loading, error, refresh };
}
