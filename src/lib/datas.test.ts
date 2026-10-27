import { afterEach, describe, expect, it, vi } from "vitest";
import { dataLocal, hojeLocal, mesAtualLocal, primeiroDiaDoMesLocal, somarDias } from "@/lib/datas";

afterEach(() => {
  vi.useRealTimers();
});

describe("hojeLocal", () => {
  it("às 23:30 de Brasília devolve o dia de Brasília, não o dia UTC", () => {
    vi.useFakeTimers();
    // 15/03/2026 23:30 em Brasília (UTC-3) = 16/03/2026 02:30Z
    vi.setSystemTime(new Date("2026-03-16T02:30:00Z"));
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-03-16");
    expect(hojeLocal()).toBe("2026-03-15");
  });

  it("às 00:30 de Brasília já é o novo dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T03:30:00Z"));
    expect(hojeLocal()).toBe("2026-03-16");
  });
});

describe("mesAtualLocal e primeiroDiaDoMesLocal", () => {
  it("na virada do mês continuam no mês de Brasília", () => {
    vi.useFakeTimers();
    // 31/10/2026 22:00 em Brasília = 01/11/2026 01:00Z
    vi.setSystemTime(new Date("2026-11-01T01:00:00Z"));
    expect(mesAtualLocal()).toBe("2026-10");
    expect(primeiroDiaDoMesLocal()).toBe("2026-10-01");
  });

  it("na virada do ano continuam no ano de Brasília", () => {
    vi.useFakeTimers();
    // 31/12/2026 23:59 em Brasília = 01/01/2027 02:59Z
    vi.setSystemTime(new Date("2027-01-01T02:59:00Z"));
    expect(hojeLocal()).toBe("2026-12-31");
    expect(mesAtualLocal()).toBe("2026-12");
    expect(primeiroDiaDoMesLocal()).toBe("2026-12-01");
  });

  it("depois da meia-noite de Brasília passam para o mês seguinte", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    expect(mesAtualLocal()).toBe("2026-11");
    expect(primeiroDiaDoMesLocal()).toBe("2026-11-01");
  });
});

describe("somarDias", () => {
  it("soma dentro do mês", () => {
    expect(somarDias("2026-10-10", 5)).toBe("2026-10-15");
  });

  it("cruza o mês", () => {
    expect(somarDias("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("cruza o ano", () => {
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("respeita fevereiro de ano bissexto", () => {
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(somarDias("2028-02-28", 2)).toBe("2028-03-01");
  });

  it("respeita fevereiro de ano não bissexto", () => {
    expect(somarDias("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("aceita valor negativo, cruzando mês, ano e fevereiro bissexto", () => {
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(somarDias("2028-03-01", -1)).toBe("2028-02-29");
    expect(somarDias("2027-01-01", -1)).toBe("2026-12-31");
    expect(somarDias("2026-10-26", -30)).toBe("2026-09-26");
  });

  it("zero devolve a mesma data", () => {
    expect(somarDias("2026-10-26", 0)).toBe("2026-10-26");
  });
});

describe("dataLocal", () => {
  it("converte um instante para a data de Brasília", () => {
    expect(dataLocal(new Date("2026-10-26T02:59:59Z"))).toBe("2026-10-25");
    expect(dataLocal(new Date("2026-10-26T03:00:00Z"))).toBe("2026-10-26");
    expect(dataLocal(new Date("2026-10-26T15:00:00Z"))).toBe("2026-10-26");
  });

  it("sem argumento usa o instante atual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T02:30:00Z"));
    expect(dataLocal()).toBe("2026-03-15");
  });
});
