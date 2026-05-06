import type { Metadata } from "next";
import "./globals.css";
import { GlobalHeader } from "@/components/AuthGate";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "SOC Copilot",
  description: "AI Copilot para Analistas SOC Junior",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <GlobalHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
