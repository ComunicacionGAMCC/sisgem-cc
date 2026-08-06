import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "SISGEM-CC | Sistema de Gestión Municipal Cuatro Cañadas",
  description: "Portal digital de trámites, servicios y seguimiento del Gobierno Autónomo Municipal de Cuatro Cañadas.",
  openGraph: {
    title: "SISGEM-CC",
    description: "Sistema de Gestión Municipal Cuatro Cañadas — Tu municipio, más cerca.",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "SISGEM-CC — Sistema de Gestión Municipal Cuatro Cañadas" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SISGEM-CC",
    description: "Sistema de Gestión Municipal Cuatro Cañadas — Tu municipio, más cerca.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
