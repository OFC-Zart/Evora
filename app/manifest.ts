import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/lib/env";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — treino de corrida`,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    lang: "pt-BR",
    start_url: "/hoje",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#060606",
    theme_color: "#060606",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
