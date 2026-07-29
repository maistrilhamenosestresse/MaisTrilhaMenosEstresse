import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Mais Trilha Menos Estresse",
    short_name: "Mais Trilha",
    description: "Trilhas, benefícios, reservas, pontos e lembranças das suas aventuras.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F7FA",
    theme_color: "#071829",
    categories: ["travel", "lifestyle", "sports"],
    icons: [
      {
        src: "/api/pwa/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa/icon/512?purpose=maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Comprar trilha",
        short_name: "Trilhas",
        url: "/app/trilhas",
        icons: [{ src: "/api/pwa/icon/192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Meus benefícios",
        short_name: "Benefícios",
        url: "/app/beneficios",
        icons: [{ src: "/api/pwa/icon/192", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
