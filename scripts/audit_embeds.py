#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auditoria de embeds PostgREST.

Percorre todo o codigo procurando chamadas .from("tabela").select("...") e
confere cada relacionamento embutido contra o mapa real de chaves estrangeiras
do banco. Quando existe mais de uma ligacao entre duas tabelas, o embed precisa
nomear a constraint explicitamente (tabela!nome_da_fkey), senao o PostgREST
recusa a consulta inteira e a tela aparece vazia.
"""
import json, re, sys, pathlib

# Mapa extraido do banco: (origem, destino) -> quantidade de FKs
FK_PAIRS = {}
for row in json.load(open(pathlib.Path(__file__).parent / "fk_map.json")):
    FK_PAIRS[(row["origem"], row["destino"])] = row["ligacoes"]

SRC = pathlib.Path(__file__).parent.parent / "src"

# .from("x") seguido em ate ~600 chars por .select("...")
CALL = re.compile(r'\.from\(\s*"(\w+)"\s*\)([\s\S]{0,600}?)\.select\(\s*(["\'`])([\s\S]*?)\3', re.M)
# nomes embutidos no select: palavra seguida de "(" que nao seja funcao conhecida
EMBED = re.compile(r'(?<![\w!])(\w+)\s*\(')

problemas = []
verificados = 0

for path in sorted(SRC.rglob("*.ts")) + sorted(SRC.rglob("*.tsx")):
    texto = path.read_text(encoding="utf-8")
    for m in CALL.finditer(texto):
        origem, _meio, _q, select = m.group(1), m.group(2), m.group(3), m.group(4)
        linha = texto[: m.start()].count("\n") + 1

        # embeds com FK explicita: tabela!constraint(...)
        explicitos = set(re.findall(r'(\w+)!(\w+)\s*\(', select))
        explicit_tables = {t for t, _ in explicitos}

        for destino in EMBED.findall(select):
            if destino in explicit_tables:
                continue
            par = (origem, destino)
            if par not in FK_PAIRS:
                continue  # nao e um relacionamento direto; ignora
            verificados += 1
            if FK_PAIRS[par] > 1:
                problemas.append(
                    f"{path.relative_to(SRC.parent)}:{linha}  "
                    f"{origem} -> {destino} tem {FK_PAIRS[par]} ligacoes e o embed "
                    f"nao diz qual usar (precisa de {destino}!nome_da_fkey)"
                )

print(f"Embeds diretos verificados: {verificados}")
if problemas:
    print(f"\nPROBLEMAS ENCONTRADOS ({len(problemas)}):")
    for p in problemas:
        print("  x " + p)
    sys.exit(1)
print("Nenhum embed ambiguo. OK.")
