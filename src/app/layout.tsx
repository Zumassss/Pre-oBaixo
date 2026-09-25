import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Portao } from "@/components/providers/portao";
import { SCRIPT_TEMA, TemaProvider } from "@/components/providers/tema";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-tech",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Preço Baixo · Central de Operações",
  description:
    "Sistema de gestão das Farmácias Preço Baixo: atendimento automatizado, CRM e operação em tempo real.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#030304" },
    { media: "(prefers-color-scheme: light)", color: "#f1f3f6" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // O tema é escrito no <html> por script, antes do React existir. O React
    // não controla esse atributo, então avisamos que a diferença é esperada.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Roda antes da primeira pintura para a tela não nascer escura e
            clarear depois. Um flash branco a cada carregamento é o tipo de
            defeito que faz o sistema parecer amador na demonstração. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full">
        <TemaProvider>
          <Portao>{children}</Portao>
        </TemaProvider>
      </body>
    </html>
  );
}
