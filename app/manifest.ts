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
    background_color: "#0a0c0b",
    theme_color: "#101411",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
