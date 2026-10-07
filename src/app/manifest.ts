import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/pwa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wayfare",
    short_name: "Wayfare",
    description: "Plan trips offline, find flights, get price-drop alerts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND,
    theme_color: BRAND,
    categories: ["travel"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
