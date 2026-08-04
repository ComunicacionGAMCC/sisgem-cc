import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const baseMetadata: Metadata = {
  title: "Municipio Digital | Cuatro Cañadas",
  description: "Portal ciudadano y plataforma de gestión del Gobierno Autónomo Municipal de Cuatro Cañadas.",
  applicationName: "Municipio Digital Cuatro Cañadas",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/escudo-gamcc.png",
    apple: "/escudo-gamcc.png",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    ...baseMetadata,
    metadataBase: new URL(origin),
    openGraph: {
      title: "Municipio Digital Cuatro Cañadas",
      description: "Tu municipio, más cerca.",
      url: origin,
      siteName: "Municipio Digital Cuatro Cañadas",
      locale: "es_BO",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1765, height: 923, alt: "Municipio Digital Cuatro Cañadas" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Municipio Digital Cuatro Cañadas",
      description: "Tu municipio, más cerca.",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#071247",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
