import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

// lets TAMS be installed ("Add to Home Screen"), which iPhones need for push notifications
export default function manifest(): MetadataRoute.Manifest {
  return {
    // fixed id: the browser always sees the same app, so it can't be installed twice
    id: "/",
    name: "TAMS",
    short_name: "TAMS",
    description: "Teaching Assistant Management System",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAF7F0",
    theme_color: "#0A2947",
    // lets the site check "is TAMS already installed on this phone?" (needs the full site address)
    ...(SITE_URL ? { related_applications: [{ platform: "webapp" as const, url: `${SITE_URL}/manifest.webmanifest` }] } : {}),
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
