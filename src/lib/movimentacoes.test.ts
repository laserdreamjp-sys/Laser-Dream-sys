import { describe, expect, it } from "vitest";
import {
  alteracoes,
  camposPrincipais,
  entidadesDoTipo,
  formatarDataHora,
  formatarValor,
  lerFiltros,
  limitesDoPeriodo,
  linhasPorTabela,
  linkDoItem,
  padraoBusca,
  periodoPadrao,
  rotuloCampo,
  rotuloEntidade,
  tabelaInexistente,
  urlDaPagina,
} from "./movimentacoes";

describe("tipos e entidades", () => {
  it("agrupa as entidades por tipo", () => {
    expect(entidadesDoTipo("caixa")).toEqual(["cash_transactions", "cash_closures"]);
    expect(entidadesDoTipo("backups")).toEqual(["backups", "backup"]);
    expect(entidadesDoTipo("usuarios")).toContain("user_units");
    expect(entidadesDoTipo("configuracoes")).toContain("org_settings");
    expect(entidadesDoTipo("")).toBeNull();
    expect(entidadesDoTipo("inventado")).toBeNull();
  });

  it("dá o nome amigável da entidade", () => {
    expect(rotuloEntidade("sales")).toBe("Vendas");
    expect(rotuloEntidade("backup")).toBe("Backups");
    expect(rotuloEntidade("outra")).toBe("outra");
  });
});

describe("campos e valores", () => {
  it("traduz campos conhecidos e mantém os demais", () => {
    expect(rotuloCampo("phone")).toBe("Telefone");
    expect(rotuloCampo("seller_id")).toBe("Vendedora");
    expect(rotuloCampo("tipo_venda")).toBe("tipo_venda");
  });

  it("formata valores", () => {
    expect(formatarValor(null)).toBe("vazio");
    expect(formatarValor(undefined)).toBe("vazio");
    expect(formatarValor("")).toBe("vazio");
    expect(formatarValor(true)).toBe("Sim");
    expect(formatarValor(false)).toBe("Não");
    expect(formatarValor("2026-10-12")).toBe("12/10/2026");
    expect(formatarValor("Maria")).toBe("Maria");
    expect(formatarValor(350.5)).toBe("350,5");
    expect(formatarValor({ a: 1 })).toBe('{"a":1}');
    const longo = formatarValor({ texto: "x".repeat(300) });
    expect(longo.length).toBe(120);
    expect(longo.endsWith("…")).toBe(true);
  });

  it("lê as alterações de uma edição", () => {
    expect(
      alteracoes({ phone: { de: null, para: "11999" }, active: { de: true, para: false } })
    ).toEqual([
      { campo: "phone", rotulo: "Telefone", de: "vazio", para: "11999" },
      { campo: "active", rotulo: "Ativo", de: "Sim", para: "Não" },
    ]);
    expect(alteracoes(null)).toEqual([]);
    expect(alteracoes([])).toEqual([]);
  });

  it("lista os campos principais não vazios de criação e exclusão", () => {
    const campos = camposPrincipais({
      id: "x",
      organization_id: "y",
      created_at: "2026-10-01T10:00:00Z",
      name: "Ana",
      email: null,
      phone: "",
      cpf: "123",
    });
    expect(campos).toEqual([
      { campo: "name", rotulo: "Nome", valor: "Ana" },
      { campo: "cpf", rotulo: "CPF", valor: "123" },
    ]);
  });

  it("lê as linhas por tabela da restauração", () => {
    expect(linhasPorTabela({ linhas_por_tabela: { sales: 1684, clients: 900 } })).toEqual([
      { tabela: "sales", linhas: "1.684" },
      { tabela: "clients", linhas: "900" },
    ]);
    expect(linhasPorTabela({})).toEqual([]);
  });
});

describe("link do item", () => {
  it("leva ao cliente quando ele não foi excluído", () => {
    expect(linkDoItem("clients", "editado", "abc")).toBe("/clientes/abc");
    expect(linkDoItem("clients", "excluido", "abc")).toBeNull();
    expect(linkDoItem("sales", "criado", "abc")).toBeNull();
    expect(linkDoItem("clients", "criado", null)).toBeNull();
  });
});

describe("datas", () => {
  it("formata data e hora em Brasília", () => {
    expect(formatarDataHora("2026-10-13T01:30:00Z")).toBe("12/10/2026, 22:30");
  });

  it("período padrão são os últimos 30 dias contando hoje", () => {
    expect(periodoPadrao("2026-10-27")).toEqual({ de: "2026-09-28", ate: "2026-10-27" });
  });

  it("limites do período usam o dia de Brasília", () => {
    expect(limitesDoPeriodo("2026-10-01", "2026-10-31")).toEqual({
      inicio: "2026-10-01T00:00:00-03:00",
      fim: "2026-11-01T00:00:00-03:00",
    });
  });
});

describe("filtros da URL", () => {
  const hoje = "2026-10-27";

  it("usa o padrão quando não há filtros", () => {
    expect(lerFiltros({}, hoje)).toEqual({
      de: "2026-09-28",
      ate: "2026-10-27",
      tipo: "",
      acao: "",
      usuario: "",
      busca: "",
      pagina: 1,
    });
  });

  it("descarta valores inválidos e inverte período trocado", () => {
    const f = lerFiltros(
      {
        de: "2026-10-20",
        ate: "2026-10-01",
        tipo: "xpto",
        acao: "apagado",
        usuario: "não-é-uuid",
        busca: "  Maria  ",
        pagina: "-3",
      },
      hoje
    );
    expect(f).toEqual({
      de: "2026-10-01",
      ate: "2026-10-20",
      tipo: "",
      acao: "",
      usuario: "",
      busca: "Maria",
      pagina: 1,
    });
    expect(lerFiltros({ de: "2026-02-30" }, hoje).de).toBe("2026-09-28");
  });

  it("aceita filtros válidos", () => {
    const f = lerFiltros(
      {
        tipo: "caixa",
        acao: "excluido",
        usuario: "00000000-0000-0000-0000-000000000001",
        pagina: "3",
      },
      hoje
    );
    expect(f.tipo).toBe("caixa");
    expect(f.acao).toBe("excluido");
    expect(f.usuario).toBe("00000000-0000-0000-0000-000000000001");
    expect(f.pagina).toBe(3);
  });

  it("monta a URL de outra página mantendo os filtros", () => {
    const f = lerFiltros({ tipo: "vendas", busca: "Ana" }, hoje);
    expect(urlDaPagina(f, 2)).toBe(
      "/movimentacoes?de=2026-09-28&ate=2026-10-27&tipo=vendas&busca=Ana&pagina=2"
    );
    expect(urlDaPagina(f, 1)).not.toContain("pagina");
  });

  it("escapa curingas da busca", () => {
    expect(padraoBusca("50%_a")).toBe("%50\\%\\_a%");
  });
});

describe("tabela inexistente", () => {
  it("reconhece o erro de relação inexistente", () => {
    expect(tabelaInexistente({ code: "42P01", message: "x" })).toBe(true);
    expect(tabelaInexistente({ code: "PGRST205", message: "x" })).toBe(true);
    expect(
      tabelaInexistente({
        message: "Could not find the table 'public.movimentacoes' in the schema cache",
      })
    ).toBe(true);
    expect(tabelaInexistente({ message: 'relation "public.movimentacoes" does not exist' })).toBe(true);
    expect(tabelaInexistente({ code: "42501", message: "permission denied" })).toBe(false);
    expect(tabelaInexistente(null)).toBe(false);
  });
});
