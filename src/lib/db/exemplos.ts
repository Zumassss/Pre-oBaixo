"use client";

import { atualizarBanco, novoId } from "./local-db";
import type { BancoLocal, Conversa, Mensagem } from "./types";

/**
 * Dados de exemplo.
 *
 * Servem só para ver o sistema cheio antes de existir movimento real. Nada
 * disto é carregado sozinho: alguém precisa clicar em Configurações. O botão
 * de apagar limpa tudo e devolve o sistema ao estado vazio.
 *
 * O conteúdo é de UMA loja, a de Vila Velha, coerente com o modelo do
 * produto: esta ferramenta nunca vê dado de outra unidade.
 */

const HORA = 60 * 60 * 1000;

function mensagem(
  origem: Mensagem["origem"],
  texto: string,
  minutosAtras: number,
): Mensagem {
  return {
    id: novoId("msg"),
    origem,
    texto,
    em: Date.now() - minutosAtras * 60 * 1000,
  };
}

function conversa(
  cliente: string,
  telefone: string,
  status: Conversa["status"],
  mensagens: Mensagem[],
): Conversa {
  return {
    id: novoId("cnv"),
    cliente,
    telefone,
    status,
    mensagens,
    atualizadaEm: mensagens.length
      ? mensagens[mensagens.length - 1].em
      : Date.now(),
  };
}

export function carregarExemplos(): BancoLocal {
  const agora = Date.now();

  const banco: BancoLocal = {
    loja: {
      nome: "Preço Baixo Vila Velha",
      endereco: "Rua Jair de Andrade, 120",
      bairro: "Centro",
      cidade: "Vila Velha",
      uf: "ES",
      cep: "29100-000",
      telefone: "27 3000-0000",
      cnpj: "00.000.000/0001-00",
      farmaceutico: "Renata Lopes",
      crf: "CRF-ES 00000",
      horarios: "Segunda a sábado das 8h às 22h, domingo das 8h às 20h",
      configurada: true,
    },

    whatsappConectado: true,

    clientes: [
      {
        id: novoId("cli"),
        nome: "Ana Paula Ribeiro",
        telefone: "27 99812-4821",
        consentimento: true,
        observacao: "Compra Losartana todo mês",
        criadoEm: agora - 40 * 24 * HORA,
      },
      {
        id: novoId("cli"),
        nome: "Carlos Eduardo Lima",
        telefone: "27 99745-1177",
        consentimento: true,
        observacao: "",
        criadoEm: agora - 22 * 24 * HORA,
      },
      {
        id: novoId("cli"),
        nome: "Marta Souza",
        telefone: "27 99630-7734",
        consentimento: true,
        observacao: "Insulina, precisa de refrigeração",
        criadoEm: agora - 15 * 24 * HORA,
      },
      {
        id: novoId("cli"),
        nome: "José Antônio Farias",
        telefone: "27 99518-3390",
        consentimento: false,
        observacao: "Prefere ser chamado por telefone",
        criadoEm: agora - 9 * 24 * HORA,
      },
      {
        id: novoId("cli"),
        nome: "Fernanda Alves",
        telefone: "27 99402-5512",
        consentimento: true,
        observacao: "",
        criadoEm: agora - 4 * 24 * HORA,
      },
      {
        id: novoId("cli"),
        nome: "Roberto Nogueira",
        telefone: "27 99377-8846",
        consentimento: true,
        observacao: "",
        criadoEm: agora - 6 * HORA,
      },
      {
        id: novoId("cli"),
        nome: "Luciana Prado",
        telefone: "27 99260-2204",
        consentimento: false,
        observacao: "Não compra desde julho",
        criadoEm: agora - 1 * 24 * HORA,
      },
    ],

    produtos: [
      {
        id: novoId("sku"),
        nome: "Dipirona Sódica 500mg 20 comprimidos",
        categoria: "Genérico",
        preco: 8.9,
        estoque: 312,
        estoqueMinimo: 60,
        exigeReceita: false,
        criadoEm: agora - 30 * 24 * HORA,
      },
      {
        id: novoId("sku"),
        nome: "Losartana Potássica 50mg 30 comprimidos",
        categoria: "Genérico",
        preco: 12.9,
        estoque: 146,
        estoqueMinimo: 50,
        exigeReceita: true,
        criadoEm: agora - 30 * 24 * HORA,
      },
      {
        id: novoId("sku"),
        nome: "Amoxicilina 500mg 21 cápsulas",
        categoria: "Genérico",
        preco: 24.5,
        estoque: 18,
        estoqueMinimo: 40,
        exigeReceita: true,
        criadoEm: agora - 28 * 24 * HORA,
      },
      {
        id: novoId("sku"),
        nome: "Omeprazol 20mg 28 cápsulas",
        categoria: "Genérico",
        preco: 14.2,
        estoque: 204,
        estoqueMinimo: 50,
        exigeReceita: false,
        criadoEm: agora - 25 * 24 * HORA,
      },
      {
        id: novoId("sku"),
        nome: "Metformina 850mg 30 comprimidos",
        categoria: "Genérico",
        preco: 11.4,
        estoque: 168,
        estoqueMinimo: 45,
        exigeReceita: true,
        criadoEm: agora - 20 * 24 * HORA,
      },
      {
        id: novoId("sku"),
        nome: "Protetor Solar FPS 50 120ml",
        categoria: "Dermocosmético",
        preco: 62.9,
        estoque: 74,
        estoqueMinimo: 20,
        exigeReceita: false,
        criadoEm: agora - 18 * 24 * HORA,
      },
      {
        id: novoId("sku"),
        nome: "Vitamina D 2000UI 60 cápsulas",
        categoria: "Similar",
        preco: 39.9,
        estoque: 8,
        estoqueMinimo: 25,
        exigeReceita: false,
        criadoEm: agora - 12 * 24 * HORA,
      },
      {
        id: novoId("sku"),
        nome: "Fralda Geriátrica G 8 unidades",
        categoria: "Higiene",
        preco: 34.9,
        estoque: 96,
        estoqueMinimo: 30,
        exigeReceita: false,
        criadoEm: agora - 10 * 24 * HORA,
      },
    ],

    conversas: [
      conversa("Ana Paula Ribeiro", "27 99812-4821", "aberta", [
        mensagem("cliente", "Boa tarde! Vocês têm Losartana 50mg?", 22),
        mensagem(
          "agente",
          "Boa tarde, Ana! Temos sim. Losartana Potássica 50mg, caixa com 30 comprimidos, por R$ 12,90.",
          21,
        ),
        mensagem("cliente", "E quanto fica se eu levar 2 caixas?", 16),
        mensagem("agente", "Duas caixas ficam R$ 25,80. Quer que eu separe?", 15),
        mensagem("cliente", "Pode separar, passo aí no fim da tarde", 12),
      ]),

      conversa("Carlos Eduardo Lima", "27 99745-1177", "com_atendente", [
        mensagem(
          "cliente",
          "Posso tomar esse antibiótico junto com o remédio de pressão?",
          48,
        ),
        mensagem(
          "agente",
          "Essa dúvida precisa de avaliação profissional, Carlos. Vou passar para a farmacêutica responsável da loja.",
          47,
        ),
        mensagem(
          "atendente",
          "Olá Carlos, aqui é a Renata, farmacêutica. Pode me dizer o nome dos dois medicamentos?",
          45,
        ),
      ]),

      conversa("Marta Souza", "27 99630-7734", "aberta", [
        mensagem("cliente", "Bom dia, chegou a insulina que eu pedi?", 90),
      ]),

      conversa("Roberto Nogueira", "27 99377-8846", "resolvida", [
        mensagem("cliente", "Vocês abrem domingo?", 300),
        mensagem(
          "agente",
          "Abrimos sim, domingo das 8h às 20h, na Rua Jair de Andrade, 120.",
          299,
        ),
        mensagem("cliente", "Obrigado!", 297),
      ]),

      conversa("Fernanda Alves", "27 99402-5512", "resolvida", [
        mensagem("cliente", "Quanto custa o protetor solar FPS 50?", 400),
        mensagem("agente", "O de 120ml está R$ 62,90 e temos em estoque.", 399),
      ]),
    ],

    campanhas: [
      {
        id: novoId("cmp"),
        nome: "Genéricos com desconto",
        mensagem:
          "Oi! Esta semana os genéricos estão com preço especial aqui na Preço Baixo Vila Velha. Passa aqui ou responde esta mensagem que a gente separa.",
        status: "enviada",
        agendadaPara: "",
        criadoEm: agora - 7 * 24 * HORA,
      },
      {
        id: novoId("cmp"),
        nome: "Lembrete de recompra",
        mensagem:
          "Oi! Notamos que seu medicamento de uso contínuo deve estar acabando. Quer que a gente separe uma caixa?",
        status: "agendada",
        agendadaPara: "amanhã, 09:00",
        criadoEm: agora - 2 * 24 * HORA,
      },
      {
        id: novoId("cmp"),
        nome: "Dermocosméticos de verão",
        mensagem:
          "Protetor solar e hidratante com condição especial nesta semana.",
        status: "rascunho",
        agendadaPara: "",
        criadoEm: agora - 6 * HORA,
      },
    ],

    eventos: [
      {
        id: novoId("evt"),
        tipo: "pergunta",
        titulo: "Pergunta ao agente",
        detalhe: "Vocês abrem domingo?",
        em: agora - 3 * HORA,
      },
      {
        id: novoId("evt"),
        tipo: "resposta",
        titulo: "Resposta do agente",
        detalhe: "Abrimos domingo das 8h às 20h, na Rua Jair de Andrade, 120.",
        em: agora - 3 * HORA + 4000,
      },
      {
        id: novoId("evt"),
        tipo: "pergunta",
        titulo: "Pergunta ao agente",
        detalhe: "Quanto custa a dipirona?",
        em: agora - 90 * 60 * 1000,
      },
      {
        id: novoId("evt"),
        tipo: "resposta",
        titulo: "Resposta do agente",
        detalhe: "Dipirona Sódica 500mg, caixa com 20 comprimidos, R$ 8,90.",
        em: agora - 90 * 60 * 1000 + 3000,
      },
    ],
  };

  return atualizarBanco(() => banco);
}
