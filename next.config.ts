import type { NextConfig } from "next";

const desenvolvimento = process.env.NODE_ENV !== "production";

/**
 * Cabeçalhos de segurança de todas as páginas.
 *
 * A política de conteúdo diz ao navegador de onde a página pode carregar e
 * para onde pode mandar dados. Se um dia entrar um script malicioso (num
 * nome de cliente, numa dependência), ele não consegue mandar o token da
 * sessão para fora: só o Supabase e o mapa de endereços estão liberados.
 *
 * O `unsafe-inline` em script é exigência do Next sem nonce; o
 * `unsafe-eval` só existe em desenvolvimento, para o recarregamento ao vivo.
 */
const politica = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://ztfgcpcwmzqlhnpaefup.supabase.co wss://ztfgcpcwmzqlhnpaefup.supabase.co https://nominatim.openstreetmap.org",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: politica },
          // Ninguém põe o sistema dentro de outro site para enganar o clique.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Microfone só para gravar áudio na conversa; o resto desligado.
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
