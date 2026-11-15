"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

// toasts follow the light/dark switch
export function ThemedToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme={theme}
      toastOptions={{ duration: 4000 }}
    />
  );
}
