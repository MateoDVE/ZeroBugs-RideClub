import { describe, expect, it } from "vitest";
import { initialCompanies } from "./demo";
import { parseClientCsv } from "./clientCsv";

describe("client CSV import", () => {
  const companies = initialCompanies();

  it("parses semicolon-separated Spanish columns and quoted values", () => {
    const result = parseClientCsv(
      'nombre;correo;celular;empresa;estado\n"Ana, Pérez";ANA@example.com;+59170000000;Zontes;activa',
      companies,
    );
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      row: 2,
      name: "Ana, Pérez",
      email: "ana@example.com",
      companyName: "Zontes",
      status: "active",
    });
  });

  it("uses the current company and reports invalid or duplicate records", () => {
    const result = parseClientCsv(
      "nombre,correo,celular,estado\nAna,ana@example.com,+59170000000,active\nLuis,ana@example.com,70000000,blocked",
      companies,
      companies[1],
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].companyName).toBe("NIU");
    expect(result.issues[0]).toMatchObject({ row: 3 });
    expect(result.issues[0].message).toContain("duplicado");
    expect(result.issues[0].message).toContain("formato internacional");
  });

  it("requires a company column for a global import", () => {
    const result = parseClientCsv(
      "nombre,correo\nAna,ana@example.com",
      companies,
    );
    expect(result.rows).toHaveLength(0);
    expect(result.issues[0].message).toContain("empresa");
  });
});

