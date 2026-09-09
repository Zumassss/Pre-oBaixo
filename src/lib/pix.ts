/**
 * Pix copia e cola.
 *
 * O código que o cliente cola no app do banco não é invenção nossa: é o
 * BR Code, formato EMV publicado pelo Banco Central. Cada campo é um trio
 * `id + tamanho + valor`, e o último campo é um CRC16 do texto inteiro.
 * Gerar isso aqui é legítimo e funciona de verdade, com a chave Pix da
 * própria loja.
 *
 * O que NÃO dá para fazer só com a chave é saber que o cliente pagou. A
 * confirmação automática exige um provedor de pagamento (Mercado Pago,
 * Asaas, Efí) mandando webhook. Enquanto isso não existe, alguém da loja
 * confere o recebimento e registra na mão. O sistema é explícito sobre essa
 * diferença em vez de fingir que a baixa é automática.
 */

/** Campo EMV: identificador, tamanho em dois dígitos, conteúdo. */
function campo(id: string, valor: string) {
  const tamanho = valor.length.toString().padStart(2, "0");
  return `${id}${tamanho}${valor}`;
}

/**
 * CRC16/CCITT-FALSE, que é o exigido pela especificação.
 * Polinômio 0x1021, valor inicial 0xFFFF, sem inversão.
 */
export function crc16(texto: string) {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Tira acento e caractere fora do padrão.
 *
 * Nome e cidade viajam em ASCII no BR Code. "José" vira "JOSE"; deixar o
 * acento passar quebra a leitura em parte dos aplicativos de banco.
 */
function apenasAscii(texto: string, limite: number) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, limite)
    .toUpperCase();
}

/** Identificador da cobrança. Só letra e número, no máximo 25. */
function normalizarTxid(txid: string) {
  const limpo = txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return limpo || "***";
}

export type DadosPix = {
  /** Chave Pix da loja: CPF, CNPJ, telefone, email ou chave aleatória. */
  chave: string;
  /** Nome que aparece para o cliente no app do banco. */
  beneficiario: string;
  cidade: string;
  /** Valor em reais. Zero ou ausente deixa o cliente digitar o valor. */
  valor?: number;
  /** Referência da cobrança, normalmente o número do pedido. */
  txid?: string;
};

/**
 * Monta o texto do Pix copia e cola.
 *
 * A ordem dos campos importa: a especificação pede identificadores em
 * ordem crescente, e o CRC precisa ser calculado sobre a string já com
 * "6304" no fim.
 */
export function gerarPixCopiaECola({
  chave,
  beneficiario,
  cidade,
  valor,
  txid,
}: DadosPix) {
  const contaPix =
    campo("00", "br.gov.bcb.pix") + campo("01", chave.trim());

  let payload =
    campo("00", "01") +
    campo("26", contaPix) +
    campo("52", "0000") +
    campo("53", "986");

  if (valor && valor > 0) {
    payload += campo("54", valor.toFixed(2));
  }

  payload +=
    campo("58", "BR") +
    campo("59", apenasAscii(beneficiario, 25) || "RECEBEDOR") +
    campo("60", apenasAscii(cidade, 15) || "CIDADE") +
    campo("62", campo("05", normalizarTxid(txid ?? "")));

  const comCrc = `${payload}6304`;
  return comCrc + crc16(comCrc);
}

/** Diz se dá para cobrar por Pix ou o que ainda falta configurar. */
export function pixConfigurado(dados: {
  chavePix: string;
  beneficiario: string;
  cidade: string;
}) {
  return Boolean(
    dados.chavePix.trim() && dados.beneficiario.trim() && dados.cidade.trim(),
  );
}
