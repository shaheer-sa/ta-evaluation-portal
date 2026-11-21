import type { MetadataRoute } from "next";

// lets TAMS be installed ("Add to Home Screen"), which iPhones need for push notifications
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TAMS",
    short_name: "TAMS",
    description: "Teaching Assistant Management System",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF7F0",
    theme_color: "#0A2947",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
