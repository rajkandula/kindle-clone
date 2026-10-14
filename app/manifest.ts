import type { MetadataRoute } from "next";

/**
 * What makes Lectoire installable. Colours match globals.css: paper behind the
 * splash screen, ink for the title bar of the installed window.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lectoire",
    short_name: "Lectoire",
    description: "A home for books — read, listen, and write with an AI partner.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#1c1917",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
