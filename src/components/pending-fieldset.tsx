"use client";

import { useFormStatus } from "react-dom";
import React from "react";

export function PendingFieldset({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className={className}>
      {children}
    </fieldset>
  );
}
