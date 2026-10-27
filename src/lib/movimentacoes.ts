/**
 * Regras puras da tela de Histórico (/movimentacoes).
 *
 * A tabela `movimentacoes` (migração 0045) é escrita só pelo gatilho
 * fn_registrar_movimentacao e por restore_from_backup. Aqui ficam o
 * agrupamento amigável das entidades, a tradução de campos, a formatação dos
 * valores e a leitura dos filtros da URL.
 */

import { somarDias } from "@/lib/datas";

export const POR_PAGINA = 100;

export type Acao = "criado" | "editado" | "excluido" | "restaurado";

export const ACOES: { valor: Acao; rotulo: string }[] = [
  { valor: "criado", rotulo: "Criado" },
  { valor: "editado", rotulo: "Editado" },
  { valor: "excluido", rotulo: "Excluído" },
  { valor: "restaurado", rotulo: "Restaurado" },
];

export function rotuloAcao(acao: string): string {
  return ACOES.find((a) => a.valor === acao)?.rotulo ?? acao;
}

/** Agrupamento amigável das entidades (nome de tabela) para o filtro "Tipo". */
export const TIPOS: { valor: string; rotulo: string; entidades: string[] }[] = [
  { valor: "clientes", rotulo: "Clientes", entidades: ["clients"] },
  { valor: "vendas", rotulo: "Vendas", entidades: ["sales"] },
  { valor: "caixa", rotulo: "Caixa", entidades: ["cash_transactions", "cash_closures"] },
  {
    valor: "usuarios",
    rotulo: "Usuários e acesso",
    entidades: ["profiles", "user_units", "invites", "roles"],
  },
  {
    valor: "configuracoes",
    rotulo: "Configurações e catálogos",
    entidades: [
      "org_settings",
      "payment_methods",
      "procedures",
      "procedure_areas",
      "sellers",
      "lead_origins",
      "cash_categories",
      "units",
    ],
  },
  { valor: "solicitacoes", rotulo: "Solicitações", entidades: ["change_requests"] },
  { valor: "backups", rotulo: "Backups", entidades: ["backups", "backup"] },
];

/** Entidades de um tipo do filtro; null quando o tipo não existe (sem filtro). */
export function entidadesDoTipo(tipo: string | undefined | null): string[] | null {
  if (!tipo) return null;
  return TIPOS.find((t) => t.valor === tipo)?.entidades ?? null;
}

/** Nome amigável do tipo a que uma entidade pertence. */
export function rotuloEntidade(entidade: string): string {
  return TIPOS.find((t) => t.entidades.includes(entidade))?.rotulo ?? entidade;
}

const CAMPOS: Record<string, string> = {
  name: "Nome",
  full_name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  cpf: "CPF",
  birth_date: "Data de nascimento",
  amount: "Valor",
  sale_date: "Data da venda",
  status: "Status",
  notes: "Observações",
  description: "Descrição",
  transaction_date: "Data",
  type: "Tipo",
  active: "Ativo",
  role_id: "Papel",
  client_id: "Cliente",
  seller_id: "Vendedora",
  procedure_id: "Procedimento",
};

export function rotuloCampo(campo: string): string {
  return CAMPOS[campo] ?? campo;
}

const LIMITE_JSON = 120;

/** Valor legível de um campo do histórico. */
export function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "vazio";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return valor.toLocaleString("pt-BR");
  if (typeof valor === "string") {
    const data = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (data) return `${data[3]}/${data[2]}/${data[1]}`;
    return valor;
  }
  const json = JSON.stringify(valor);
  return json.length > LIMITE_JSON ? `${json.slice(0, LIMITE_JSON - 1)}…` : json;
}

export type Alteracao = { campo: string; rotulo: string; de: string; para: string };

/** Em 'editado': `{ coluna: { de, para } }` vira linhas Campo | Antes | Depois. */
export function alteracoes(detalhes: unknown): Alteracao[] {
  if (!detalhes || typeof detalhes !== "object" || Array.isArray(detalhes)) return [];
  return Object.entries(detalhes as Record<string, unknown>).map(([campo, v]) => {
    const par = (v && typeof v === "object" ? v : {}) as { de?: unknown; para?: unknown };
    return {
      campo,
      rotulo: rotuloCampo(campo),
      de: formatarValor(par.de),
      para: formatarValor(par.para),
    };
  });
}

/** Colunas técnicas que não ajudam a entender o registro. */
const CAMPOS_TECNICOS = new Set([
  "id",
  "organization_id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
]);

/** Em 'criado' e 'excluido': os campos principais não vazios da linha. */
export function camposPrincipais(detalhes: unknown): { campo: string; rotulo: string; valor: string }[] {
  if (!detalhes || typeof detalhes !== "object" || Array.isArray(detalhes)) return [];
  return Object.entries(detalhes as Record<string, unknown>)
    .filter(([campo, valor]) => !CAMPOS_TECNICOS.has(campo) && valor !== null && valor !== undefined && valor !== "")
    .map(([campo, valor]) => ({ campo, rotulo: rotuloCampo(campo), valor: formatarValor(valor) }));
}

/** Em 'restaurado': `{ linhas_por_tabela: { tabela: n } }`. */
export function linhasPorTabela(detalhes: unknown): { tabela: string; linhas: string }[] {
  const lpt =
    detalhes && typeof detalhes === "object" && !Array.isArray(detalhes)
      ? (detalhes as Record<string, unknown>).linhas_por_tabela
      : null;
  if (!lpt || typeof lpt !== "object" || Array.isArray(lpt)) return [];
  return Object.entries(lpt as Record<string, unknown>).map(([tabela, n]) => ({
    tabela,
    linhas: formatarValor(n),
  }));
}

/** Link para o item, quando ele ainda existe e há tela para ele. */
export function linkDoItem(entidade: string, acao: string, entidadeId: string | null): string | null {
  if (!entidadeId) return null;
  if (entidade === "clients" && acao !== "excluido") return `/clientes/${entidadeId}`;
  return null;
}

/** Data e hora no fuso de Brasília. */
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Últimos 30 dias, contando hoje. */
export function periodoPadrao(hoje: string): { de: string; ate: string } {
  return { de: somarDias(hoje, -29), ate: hoje };
}

/** Limites de `ocorrido_em` para o período, com os dias de Brasília. */
export function limitesDoPeriodo(de: string, ate: string): { inicio: string; fim: string } {
  return { inicio: `${de}T00:00:00-03:00`, fim: `${somarDias(ate, 1)}T00:00:00-03:00` };
}

function dataValida(valor: string | undefined): valor is string {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const u = new Date(Date.UTC(a, m - 1, d));
  return u.getUTCFullYear() === a && u.getUTCMonth() === m - 1 && u.getUTCDate() === d;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FiltrosParams = {
  de?: string;
  ate?: string;
  tipo?: string;
  acao?: string;
  usuario?: string;
  busca?: string;
  pagina?: string;
};

export type Filtros = {
  de: string;
  ate: string;
  tipo: string;
  acao: string;
  usuario: string;
  busca: string;
  pagina: number;
};

/** Lê e valida os filtros da URL; valores inválidos voltam ao padrão. */
export function lerFiltros(params: FiltrosParams, hoje: string): Filtros {
  const padrao = periodoPadrao(hoje);
  let de = dataValida(params.de) ? params.de : padrao.de;
  let ate = dataValida(params.ate) ? params.ate : padrao.ate;
  if (de > ate) [de, ate] = [ate, de];
  const pagina = Number.parseInt(params.pagina ?? "", 10);
  return {
    de,
    ate,
    tipo: entidadesDoTipo(params.tipo) ? (params.tipo as string) : "",
    acao: ACOES.some((a) => a.valor === params.acao) ? (params.acao as string) : "",
    usuario: params.usuario && UUID.test(params.usuario) ? params.usuario : "",
    busca: (params.busca ?? "").trim().slice(0, 200),
    pagina: Number.isFinite(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/** Escapa curingas do `ilike` para a busca ser pelo texto literal. */
export function padraoBusca(busca: string): string {
  return `%${busca.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Monta a query string mantendo os filtros e trocando a página. */
export function urlDaPagina(filtros: Filtros, pagina: number): string {
  const p = new URLSearchParams();
  p.set("de", filtros.de);
  p.set("ate", filtros.ate);
  if (filtros.tipo) p.set("tipo", filtros.tipo);
  if (filtros.acao) p.set("acao", filtros.acao);
  if (filtros.usuario) p.set("usuario", filtros.usuario);
  if (filtros.busca) p.set("busca", filtros.busca);
  if (pagina > 1) p.set("pagina", String(pagina));
  return `/movimentacoes?${p.toString()}`;
}

/** A tabela ainda não existe no banco (migração 0045 não aplicada). */
export function tabelaInexistente(erro: { code?: string; message?: string } | null | undefined): boolean {
  if (!erro) return false;
  if (erro.code === "42P01" || erro.code === "PGRST205") return true;
  const msg = (erro.message ?? "").toLowerCase();
  return (
    msg.includes("movimentacoes") &&
    (msg.includes("does not exist") || msg.includes("could not find the table"))
  );
}
