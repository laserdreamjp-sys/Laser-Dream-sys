import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { unwrap } from "@/lib/unwrap";
import { hojeLocal } from "@/lib/datas";
import {
  ACOES,
  POR_PAGINA,
  TIPOS,
  alteracoes,
  camposPrincipais,
  entidadesDoTipo,
  formatarDataHora,
  lerFiltros,
  limitesDoPeriodo,
  linhasPorTabela,
  linkDoItem,
  padraoBusca,
  rotuloAcao,
  rotuloEntidade,
  tabelaInexistente,
  urlDaPagina,
  type FiltrosParams,
} from "@/lib/movimentacoes";

const SELO_ACAO: Record<string, string> = {
  criado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  editado: "bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300",
  excluido: "bg-destructive/10 text-destructive",
  restaurado: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
};

type Movimentacao = {
  id: string;
  ocorrido_em: string;
  usuario_nome: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  descricao: string;
  detalhes: unknown;
};

const CAMPO =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground";

export default async function MovimentacoesPage({ searchParams }: { searchParams: FiltrosParams }) {
  const { isAdmin } = await getCurrentProfile();

  if (!isAdmin) {
    return (
      <div>
        <h2 className="mb-2 font-display font-semibold text-2xl text-foreground">Histórico</h2>
        <p className="text-sm text-muted-foreground">Apenas o administrador pode ver o histórico.</p>
      </div>
    );
  }

  const supabase = createClient();
  const filtros = lerFiltros(searchParams, hojeLocal());
  const { inicio, fim } = limitesDoPeriodo(filtros.de, filtros.ate);

  const usuarios = unwrap(
    await supabase.from("profiles").select("id, full_name").order("full_name").order("id"),
    "usuários"
  ) as { id: string; full_name: string | null }[];

  const desde = (filtros.pagina - 1) * POR_PAGINA;
  let consulta = supabase
    .from("movimentacoes")
    .select("id, ocorrido_em, usuario_nome, acao, entidade, entidade_id, descricao, detalhes")
    .gte("ocorrido_em", inicio)
    .lt("ocorrido_em", fim)
    .order("ocorrido_em", { ascending: false })
    .order("id", { ascending: false })
    // Uma linha a mais só para saber se existe página seguinte.
    .range(desde, desde + POR_PAGINA);

  const entidades = entidadesDoTipo(filtros.tipo);
  if (entidades) consulta = consulta.in("entidade", entidades);
  if (filtros.acao) consulta = consulta.eq("acao", filtros.acao);
  if (filtros.usuario) consulta = consulta.eq("usuario_id", filtros.usuario);
  if (filtros.busca) consulta = consulta.ilike("descricao", padraoBusca(filtros.busca));

  const resultado = await consulta;
  const naoAtivado = tabelaInexistente(resultado.error);
  const linhas = naoAtivado ? [] : (unwrap(resultado, "histórico") as Movimentacao[]);
  const temProxima = linhas.length > POR_PAGINA;
  const pagina = linhas.slice(0, POR_PAGINA);

  return (
    <div className="min-w-0">
      <h2 className="mb-2 font-display font-semibold text-2xl text-foreground">Histórico</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Quem criou, alterou ou excluiu o quê, e quando. Somente leitura.
      </p>

      <form
        method="get"
        action="/movimentacoes"
        className="mb-6 grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-7"
      >
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">De</span>
          <input type="date" name="de" defaultValue={filtros.de} className={CAMPO} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Até</span>
          <input type="date" name="ate" defaultValue={filtros.ate} className={CAMPO} />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Tipo</span>
          <select name="tipo" defaultValue={filtros.tipo} className={CAMPO}>
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Ação</span>
          <select name="acao" defaultValue={filtros.acao} className={CAMPO}>
            <option value="">Todas</option>
            {ACOES.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-xs sm:col-span-1">
          <span className="mb-1 block text-muted-foreground">Usuário</span>
          <select name="usuario" defaultValue={filtros.usuario} className={CAMPO}>
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || "Sem nome"}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-xs sm:col-span-1">
          <span className="mb-1 block text-muted-foreground">Busca na descrição</span>
          <input
            type="search"
            name="busca"
            defaultValue={filtros.busca}
            placeholder="Ex.: Maria"
            className={CAMPO}
          />
        </label>
        <div className="col-span-2 flex items-end gap-3 sm:col-span-1">
          <button
            type="submit"
            className="rounded-md bg-gold-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-gold-600"
          >
            Filtrar
          </button>
          <Link
            href="/movimentacoes"
            className="pb-1.5 text-xs text-muted-foreground underline underline-offset-2"
          >
            Limpar
          </Link>
        </div>
      </form>

      {naoAtivado ? (
        <div className="rounded-lg border border-gold-300 bg-gold-50 p-5 text-sm text-gold-800 dark:border-gold-700 dark:bg-gold-900/30 dark:text-gold-200">
          O histórico ainda não foi ativado no banco (migração 0045).
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
            {pagina.map((m) => (
              <LinhaMovimentacao key={m.id} m={m} />
            ))}
            {pagina.length === 0 && (
              <li className="px-4 py-6 text-center text-muted-foreground">
                Nenhuma movimentação no período com esses filtros.
              </li>
            )}
          </ul>

          {(filtros.pagina > 1 || temProxima) && (
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              {filtros.pagina > 1 ? (
                <Link
                  href={urlDaPagina(filtros, filtros.pagina - 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted"
                >
                  Anteriores
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">Página {filtros.pagina}</span>
              {temProxima ? (
                <Link
                  href={urlDaPagina(filtros, filtros.pagina + 1)}
                  className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted"
                >
                  Próximos
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LinhaMovimentacao({ m }: { m: Movimentacao }) {
  const link = linkDoItem(m.entidade, m.acao, m.entidade_id);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">{formatarDataHora(m.ocorrido_em)}</span>
        <span className="font-medium text-foreground">{m.usuario_nome}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            SELO_ACAO[m.acao] ?? "bg-muted text-foreground"
          }`}
        >
          {rotuloAcao(m.acao)}
        </span>
        <span>{rotuloEntidade(m.entidade)}</span>
      </div>
      <p className="mt-1 break-words text-foreground">
        {link ? (
          <Link href={link} className="underline decoration-gold-300 underline-offset-2 hover:text-gold-700">
            {m.descricao}
          </Link>
        ) : (
          m.descricao
        )}
      </p>
      <details className="mt-1">
        <summary className="cursor-pointer select-none text-xs text-gold-700 dark:text-gold-300">
          Ver detalhes
        </summary>
        <div className="mt-2">
          <Detalhes acao={m.acao} detalhes={m.detalhes} />
        </div>
      </details>
    </li>
  );
}

function Detalhes({ acao, detalhes }: { acao: string; detalhes: unknown }) {
  const vazio = <p className="text-xs text-muted-foreground">Sem detalhes registrados.</p>;

  if (acao === "editado") {
    const itens = alteracoes(detalhes);
    if (itens.length === 0) return vazio;
    return (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted text-left uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Campo</th>
              <th className="px-3 py-2">Antes</th>
              <th className="px-3 py-2">Depois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itens.map((i) => (
              <tr key={i.campo} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">{i.rotulo}</td>
                <td className="min-w-[8rem] break-words px-3 py-2 text-muted-foreground">{i.de}</td>
                <td className="min-w-[8rem] break-words px-3 py-2 text-foreground">{i.para}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (acao === "restaurado") {
    const itens = linhasPorTabela(detalhes);
    if (itens.length === 0) return vazio;
    return (
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs">
        {itens.map((i) => (
          <div key={i.tabela} className="contents">
            <dt className="break-words text-muted-foreground">{i.tabela}</dt>
            <dd className="text-right tabular-nums text-foreground">{i.linhas} linhas</dd>
          </div>
        ))}
      </dl>
    );
  }

  const itens = camposPrincipais(detalhes);
  if (itens.length === 0) return vazio;
  return (
    <dl className="grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-4">
      {itens.map((i) => (
        <div key={i.campo} className="contents">
          <dt className="text-muted-foreground">{i.rotulo}</dt>
          <dd className="mb-1 break-words text-foreground sm:mb-0">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
