import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hockey Live",
    short_name: "Hockey Live",
    description:
      "Community-powered live field hockey scores, match clocks and updates.",
    start_url: "/live",
    scope: "/",
    display: "standalone",
    background_color: "#06111b",
    theme_color: "#06111b",
    orientation: "portrait",
    categories: ["sports"],
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
