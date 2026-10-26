#!/usr/bin/env python3
"""Gera a página HTML (Artifact) que o dono usa no celular para rodar SQL no Supabase.

Regra: seção 12 do CLAUDE.md. Só biblioteca padrão.

Uso:
  python3 scripts/gerar-pagina-sql.py SAIDA.html a.sql [b.sql ...] \
    --titulo "..." --resumo "..." --conferencia "select ..." \
    --esperado "coluna=valor" [--esperado ...] [--explicacao-script N "texto"]
"""

import argparse
import html
import os
import re
import sys

PROJETO_REF = "nlhohtbgtiuqyhewbjnu"
PROJETO_NOME = "laser-dream-os"
SQL_EDITOR = f"https://supabase.com/dashboard/project/{PROJETO_REF}/sql/new"

KEYWORDS = [
    # frases primeiro (mais longas antes)
    "create unique index if not exists", "create index if not exists",
    "drop function if exists", "drop trigger if exists", "drop table if exists",
    "drop index if exists", "drop view if exists", "drop policy if exists",
    "create or replace function", "create or replace view",
    "alter default privileges", "is not null", "is null", "not null",
    "if not exists", "if exists", "for role", "in schema",
    "on all tables", "on all sequences", "on all functions",
    "select count", "order by", "group by",
]
SINGLE = (
    "select from where as in on is not null and or drop create alter revoke grant "
    "all tables sequences functions function execute to schema default privileges "
    "for role trigger index unique if exists table insert update delete into values "
    "set begin commit rollback returns return language security definer invoker "
    "policy using check enable disable row level references primary key foreign "
    "case when then else end join left inner distinct limit order by group having "
    "count view replace with true false public_placeholder"
).split()
SINGLE = [w for w in SINGLE if w != "public_placeholder"]


def eh_comentario(linha: str) -> bool:
    return linha.strip().startswith("--")


def texto_comentario(linha: str) -> str:
    return re.sub(r"^\s*--\s?", "", linha).rstrip()


def nome_legivel(caminho: str) -> str:
    base = os.path.splitext(os.path.basename(caminho))[0]
    base = re.sub(r"^\d+[_-]?", "", base)
    base = base.replace("_", " ").replace("-", " ").strip()
    return base[:1].upper() + base[1:] if base else os.path.basename(caminho)


def analisar_sql(caminho: str):
    with open(caminho, encoding="utf-8") as f:
        linhas = f.read().splitlines()

    # Bloco de comentários iniciais (até a primeira linha que não é comentário nem vazia).
    cabecalho = []
    for linha in linhas:
        if eh_comentario(linha):
            cabecalho.append(texto_comentario(linha))
        elif linha.strip() == "":
            if cabecalho:
                break
        else:
            break

    nome_arquivo = os.path.splitext(os.path.basename(caminho))[0]
    restantes = list(cabecalho)
    if restantes and restantes[0].strip() == nome_arquivo:
        restantes = restantes[1:]

    titulo = None
    descricao_linhas = []
    for i, t in enumerate(restantes):
        if t.strip():
            titulo = t.strip()
            descricao_linhas = restantes[i + 1:]
            break
    if not titulo:
        titulo = nome_legivel(caminho)

    paragrafos = " ".join(t.strip() for t in descricao_linhas if t.strip())
    descricao = paragrafos

    # SQL sem linhas só de comentário e sem linhas em branco repetidas.
    sql_linhas = []
    for linha in linhas:
        if eh_comentario(linha):
            continue
        linha = linha.rstrip()
        if linha == "" and (not sql_linhas or sql_linhas[-1] == ""):
            continue
        sql_linhas.append(linha)
    while sql_linhas and sql_linhas[-1] == "":
        sql_linhas.pop()
    sql = "\n".join(sql_linhas)

    destrutivas = sorted({m.lower().strip() for m in re.findall(r"\b(drop|revoke)\s", sql, re.I)})
    return titulo, descricao, sql, destrutivas


def realcar(sql: str) -> str:
    """Escapa HTML e envolve palavras-chave em <span class="k">. O innerText fica idêntico ao SQL."""
    frases = sorted(KEYWORDS, key=len, reverse=True)
    padrao_frases = "|".join(r"\s+".join(map(re.escape, f.split())) for f in frases)
    padrao_palavras = "|".join(map(re.escape, sorted(SINGLE, key=len, reverse=True)))
    token = re.compile(
        r"('(?:[^']|'')*')"  # string literal
        r"|(\"(?:[^\"]|\"\")*\")"  # identificador entre aspas
        r"|(?<![\w.])((?:" + padrao_frases + r")|(?:" + padrao_palavras + r"))(?![\w.(])"
        r"|(?<![\w.])(count)(?=\()",
        re.I,
    )
    saida = []
    pos = 0
    for m in token.finditer(sql):
        saida.append(html.escape(sql[pos:m.start()], quote=False))
        if m.group(3) or m.group(4):
            saida.append('<span class="k">' + html.escape(m.group(0), quote=False) + "</span>")
        else:
            saida.append(html.escape(m.group(0), quote=False))
        pos = m.end()
    saida.append(html.escape(sql[pos:], quote=False))
    return "".join(saida)


def formatar_conferencia(sql: str) -> str:
    """Quebra uma consulta de uma linha para caber no celular; consulta com várias linhas fica como veio."""
    sql = sql.strip()
    if "\n" in sql:
        return sql
    m = re.match(r"(?is)^select\s+(.*)$", sql)
    if not m:
        return sql
    corpo = m.group(1)
    itens, atual, nivel, em_str = [], [], 0, False
    for ch in corpo:
        if ch == "'":
            em_str = not em_str
        elif not em_str:
            if ch == "(":
                nivel += 1
            elif ch == ")":
                nivel -= 1
            elif ch == "," and nivel == 0:
                itens.append("".join(atual).strip())
                atual = []
                continue
        atual.append(ch)
    itens.append("".join(atual).strip())

    def quebrar_item(item: str) -> str:
        # Dentro de subconsulta entre parênteses, quebra antes de " where ".
        out, nivel, em_str, i = [], 0, False, 0
        while i < len(item):
            ch = item[i]
            if ch == "'":
                em_str = not em_str
            elif not em_str:
                if ch == "(":
                    nivel += 1
                elif ch == ")":
                    nivel -= 1
                elif nivel >= 1 and item[i:i + 7].lower() == " where ":
                    out.append("\n    where ")
                    i += 7
                    continue
            out.append(ch)
            i += 1
        return "".join(out)

    return "select\n" + ",\n".join("  " + quebrar_item(it) for it in itens)


CSS = """<style>
  :root {
    --bg: #f4f7f6;
    --card: #ffffff;
    --line: #d9e3e0;
    --fg: #14211f;
    --muted: #51625f;
    --accent: #1b7f77;
    --accent-fg: #ffffff;
    --warn: #8a5300;
    --ok: #17714a;
    --code-bg: #101c1a;
    --code-fg: #d7efe9;
    --code-key: #7fd6c7;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0e1715; --card: #16221f; --line: #28403b; --fg: #e6f1ee; --muted: #9db3ae;
      --accent: #2fb3a6; --accent-fg: #06201c; --warn: #f0b45a; --ok: #5fd39a;
      --code-bg: #0a1210; --code-fg: #d7efe9; --code-key: #7fd6c7; color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0e1715; --card: #16221f; --line: #28403b; --fg: #e6f1ee; --muted: #9db3ae;
    --accent: #2fb3a6; --accent-fg: #06201c; --warn: #f0b45a; --ok: #5fd39a;
    --code-bg: #0a1210; --code-fg: #d7efe9; --code-key: #7fd6c7; color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body {
    background: var(--bg); color: var(--fg);
    font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    padding-block: 28px 56px;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
  }
  main { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 4px; text-wrap: balance; }
  h2 { font-size: 1.15rem; line-height: 1.3; margin: 0; text-wrap: balance; }
  p { margin: 0; }
  .lead { color: var(--muted); }
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 18px; display: flex; flex-direction: column; gap: 14px; min-width: 0;
  }
  ol { margin: 0; padding-left: 1.3rem; display: flex; flex-direction: column; gap: 10px; }
  li::marker { color: var(--accent); font-weight: 700; }
  .warn { color: var(--warn); }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; align-self: flex-start;
    min-height: 48px; padding: 0 22px; border: 0; border-radius: 12px; cursor: pointer;
    background: var(--accent); color: var(--accent-fg); font: 700 1rem/1 system-ui, sans-serif;
    text-decoration: none;
  }
  .btn:focus-visible { outline: 3px solid var(--fg); outline-offset: 2px; }
  .btn.copied { background: var(--ok); color: #fff; }
  .head { display: flex; gap: 14px; align-items: flex-start; }
  .num {
    flex: none; width: 38px; height: 38px; border-radius: 50%; background: var(--accent);
    color: var(--accent-fg); display: grid; place-items: center; font-weight: 800;
  }
  .head > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .sub { color: var(--muted); font-size: .95rem; }
  pre {
    margin: 0; background: var(--code-bg); color: var(--code-fg); border-radius: 12px;
    padding: 16px; overflow-x: auto; max-width: 100%;
    font: 14px/1.6 ui-monospace, "SF Mono", Menlo, Consolas, monospace; tab-size: 2;
  }
  .k { color: var(--code-key); }
  .c { color: #7d9993; }
  table { border-collapse: collapse; width: 100%; font-size: .95rem; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
  th { color: var(--muted); font-weight: 600; }
  code.inline { font: .9em ui-monospace, Menlo, Consolas, monospace; background: var(--bg); padding: 1px 6px; border-radius: 6px; }
  .scroll { overflow-x: auto; }
  @media (prefers-reduced-motion: no-preference) { .btn { transition: background .15s; } }
</style>"""

SCRIPT = """<script>
  function selectText(el) {
    var r = document.createRange();
    r.selectNodeContents(el);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var original = btn.textContent;
    btn.addEventListener("click", function () {
      var el = document.getElementById(btn.getAttribute("data-copy"));
      var text = el.innerText;
      function done(ok) {
        if (ok) {
          btn.textContent = "Copiado";
          btn.classList.add("copied");
        } else {
          selectText(el);
          btn.textContent = "Selecionado, use Copiar do celular";
        }
        setTimeout(function () { btn.textContent = original; btn.classList.remove("copied"); }, 2500);
      }
      try {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } catch (e) { done(false); }
    });
  });
</script>"""


def e(texto: str) -> str:
    return html.escape(texto, quote=True)


def montar(args, scripts) -> str:
    n = len(scripts)
    destrutivas = sorted({d for s in scripts for d in s["destrutivas"]})

    passos = ['<li>Toque no botão abaixo para abrir o SQL Editor do projeto, já numa consulta nova.</li>',
              '<li>Toque em <strong>Copiar SQL 1</strong>, cole no editor e toque em <strong>Run</strong>.</li>']
    if destrutivas:
        cods = " e ".join(f'<code class="inline">{d}</code>' for d in destrutivas)
        passos.append(
            f'<li>O Supabase avisa que a consulta tem operação destrutiva ({cods}). '
            'Confirme em <strong>Run this query</strong>. É esperado.</li>')
    if n > 1:
        seguintes = "o SQL 2" if n == 2 else f"os SQL 2 a {n}, um de cada vez"
        passos.append(f'<li>Deve aparecer <em>Success. No rows returned</em>. '
                      f'Repita com {seguintes}, numa consulta nova.</li>')
    else:
        passos.append('<li>Deve aparecer <em>Success. No rows returned</em>.</li>')
    passos.append('<li>Rode a conferência no final, numa consulta nova.</li>')

    intro = (f"<p>{n} scripts, para rodar <strong>um de cada vez, nesta ordem</strong>.</p>" if n > 1
             else "<p>1 script. Depois dele, rode a conferência.</p>")

    partes = []
    partes.append(f"<title>{e(args.titulo)}</title>")
    partes.append('<meta name="claude:viewport-fit-sides" content="cover">')
    partes.append(CSS)
    partes.append("")
    partes.append("<main>")
    partes.append("  <header>")
    partes.append("    <h1>SQL para rodar no Supabase</h1>")
    resumo = f" {e(args.resumo)}" if args.resumo else ""
    partes.append(f'    <p class="lead">Projeto <strong>{PROJETO_NOME}</strong> '
                  f'(<code class="inline">{PROJETO_REF}</code>).{resumo}</p>')
    partes.append("  </header>")
    partes.append("")
    partes.append('  <section class="card">')
    partes.append(f"    {intro}")
    partes.append("    <ol>")
    for p in passos:
        partes.append(f"      {p}")
    partes.append("    </ol>")
    partes.append(f'    <a class="btn" href="{SQL_EDITOR}" target="_blank" rel="noopener">Abrir SQL Editor</a>')
    partes.append('    <p class="warn">Se aparecer algum erro, não rode os seguintes. Me mande a mensagem exata.</p>')
    partes.append("  </section>")

    for i, s in enumerate(scripts, 1):
        partes.append("")
        partes.append('  <section class="card">')
        partes.append('    <div class="head">')
        partes.append(f'      <div class="num">{i}</div>')
        partes.append("      <div>")
        partes.append(f"        <h2>{e(s['titulo'])}</h2>")
        if s["descricao"]:
            partes.append(f'        <p class="sub">{e(s["descricao"])}</p>')
        partes.append("      </div>")
        partes.append("    </div>")
        partes.append(f'    <button class="btn" type="button" data-copy="sql{i}">Copiar SQL {i}</button>')
        partes.append(f'    <pre id="sql{i}">{realcar(s["sql"])}</pre>')
        partes.append("  </section>")

    conf_id = f"sql{n + 1}"
    partes.append("")
    partes.append('  <section class="card">')
    partes.append('    <div class="head">')
    partes.append('      <div class="num">✓</div>')
    partes.append("      <div>")
    partes.append("        <h2>Conferência</h2>")
    partes.append('        <p class="sub">Consulta só de leitura. Deve voltar uma linha com os valores abaixo.</p>')
    partes.append("      </div>")
    partes.append("    </div>")
    if args.esperado:
        partes.append('    <div class="scroll">')
        partes.append("      <table>")
        partes.append("        <thead><tr><th>Coluna</th><th>Esperado</th></tr></thead>")
        partes.append("        <tbody>")
        for col, val in args.esperado:
            partes.append(f"          <tr><td>{e(col)}</td><td>{e(val)}</td></tr>")
        partes.append("        </tbody>")
        partes.append("      </table>")
        partes.append("    </div>")
    partes.append(f'    <button class="btn" type="button" data-copy="{conf_id}">Copiar consulta</button>')
    partes.append(f'    <pre id="{conf_id}">{realcar(formatar_conferencia(args.conferencia))}</pre>')
    partes.append('    <p class="sub">Quando os valores baterem, me avise. Eu confiro pelo meu lado e fecho a documentação.</p>')
    partes.append("  </section>")
    partes.append("</main>")
    partes.append("")
    partes.append(SCRIPT)
    return "\n".join(partes) + "\n"


def par_esperado(texto: str):
    if "=" not in texto:
        raise argparse.ArgumentTypeError(f'--esperado precisa ser "coluna=valor": {texto!r}')
    col, val = texto.split("=", 1)
    return col.strip(), val.strip()


def main(argv=None):
    ap = argparse.ArgumentParser(description="Gera a página de SQL para o Supabase (seção 12 do CLAUDE.md).")
    ap.add_argument("saida", help="arquivo HTML de saída")
    ap.add_argument("sql", nargs="+", help="arquivos .sql, na ordem de execução")
    ap.add_argument("--titulo", default="SQL para o Supabase")
    ap.add_argument("--resumo", default="")
    ap.add_argument("--conferencia", required=True, help="consulta só de leitura")
    ap.add_argument("--esperado", action="append", type=par_esperado, default=[], help='"coluna=valor"')
    ap.add_argument("--explicacao-script", nargs=2, action="append", default=[], metavar=("N", "TEXTO"))
    args = ap.parse_args(argv)

    explicacoes = {}
    for num, texto in args.explicacao_script:
        if not num.isdigit() or not (1 <= int(num) <= len(args.sql)):
            ap.error(f"--explicacao-script: número de script inválido: {num}")
        explicacoes[int(num)] = texto

    scripts = []
    for i, caminho in enumerate(args.sql, 1):
        titulo, descricao, sql, destrutivas = analisar_sql(caminho)
        if not sql.strip():
            ap.error(f"{caminho}: não sobrou SQL depois de tirar os comentários")
        scripts.append({
            "titulo": titulo,
            "descricao": explicacoes.get(i, descricao),
            "sql": sql,
            "destrutivas": destrutivas,
        })

    pagina = montar(args, scripts)
    if "—" in pagina:
        print("aviso: a página contém travessão (—); revise os textos.", file=sys.stderr)
    with open(args.saida, "w", encoding="utf-8") as f:
        f.write(pagina)
    print(f"Página gerada: {args.saida} ({len(scripts)} script(s))")


if __name__ == "__main__":
    main()
