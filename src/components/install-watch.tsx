"use client";

import { useEffect } from "react";
import { startInstallWatch } from "@/lib/install-client";

export function InstallWatch() {
  useEffect(() => startInstallWatch(), []);
  return null;
}
