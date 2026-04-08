import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Private Assistant",
    short_name: "Assistant",
    description: "Private PWA personal assistant for expenses, reminders, and notes.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f4ec",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
