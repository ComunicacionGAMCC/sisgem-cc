import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://municipio-digital-cuatro-canadas.unidadcomunicacioncc.chatgpt.site"),
  title: "Municipio Digital | Cuatro Cañadas",
  description: "Portal ciudadano y sistema interno de gestión del Gobierno Autónomo Municipal de Cuatro Cañadas.",
  openGraph: {
    title: "Municipio Digital | Cuatro Cañadas",
    description: "Tu municipio, más cerca. Trámites y gestión municipal en línea.",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Municipio Digital de Cuatro Cañadas" }],
    locale: "es_BO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Municipio Digital | Cuatro Cañadas",
    description: "Tu municipio, más cerca. Trámites y gestión municipal en línea.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/escudo-gamcc.png",
    shortcut: "/escudo-gamcc.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
