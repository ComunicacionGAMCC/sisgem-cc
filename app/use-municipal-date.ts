"use client";

import { useEffect, useState } from "react";
import { getMunicipalIsoDate } from "../lib/municipal-date";

export function useMunicipalDate() {
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setDate(getMunicipalIsoDate());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return date;
}
