import type { Company } from "./demo";

export type ClientImportStatus = "active" | "blocked" | "deleted";
export type ClientImportRow = {
  row: number;
  name: string;
  email: string;
  phone?: string;
  companyId: string;
  companyName: string;
  status: ClientImportStatus;
};
export type ClientImportIssue = { row: number; message: string };
export type ClientImportParseResult = {
  rows: ClientImportRow[];
  issues: ClientImportIssue[];
};
export type ClientImportOutcome = ClientImportRow & {
  result: "created" | "updated" | "error";
  message?: string;
};

const aliases: Record<string, string[]> = {
  name: ["nombre", "nombre completo", "name", "full name", "full_name"],
  email: ["correo", "correo electronico", "email", "e-mail"],
  phone: ["celular", "telefono", "telefono celular", "phone"],
  company: ["empresa", "marca", "company", "brand"],
  status: ["estado", "status"],
};

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

function parseRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === delimiter) {
      record.push(field.trim());
      field = "";
    } else if (character === "\n") {
      record.push(field.trim());
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else if (character !== "\r") field += character;
  }
  record.push(field.trim());
  if (record.some(Boolean)) records.push(record);
  return records;
}

function headerIndex(headers: string[], key: keyof typeof aliases) {
  return headers.findIndex((header) => aliases[key].includes(normalize(header)));
}

function statusValue(value: string): ClientImportStatus | undefined {
  const normalized = normalize(value || "active");
  if (["active", "activa", "activo"].includes(normalized)) return "active";
  if (["blocked", "bloqueada", "bloqueado"].includes(normalized)) return "blocked";
  if (["deleted", "baja", "dada de baja", "eliminada", "eliminado"].includes(normalized)) return "deleted";
  return undefined;
}

export function parseClientCsv(
  source: string,
  companies: Company[],
  defaultCompany?: Company,
): ClientImportParseResult {
  const text = source.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const records = parseRecords(text, delimiter);
  if (!records.length) return { rows: [], issues: [{ row: 1, message: "El archivo está vacío." }] };
  const headers = records[0];
  const indexes = {
    name: headerIndex(headers, "name"),
    email: headerIndex(headers, "email"),
    phone: headerIndex(headers, "phone"),
    company: headerIndex(headers, "company"),
    status: headerIndex(headers, "status"),
  };
  const missing: string[] = ["name", "email"]
    .filter((key) => indexes[key as "name" | "email"] < 0)
    .map((key) => (key === "name" ? "nombre" : "correo"));
  if (!defaultCompany && indexes.company < 0) missing.push("empresa");
  if (missing.length) {
    return {
      rows: [],
      issues: [{ row: 1, message: `Faltan columnas obligatorias: ${missing.join(", ")}.` }],
    };
  }
  const companyByName = new Map(
    companies.flatMap((company) => [
      [normalize(company.name), company],
      [normalize(company.id), company],
    ]),
  );
  const rows: ClientImportRow[] = [];
  const issues: ClientImportIssue[] = [];
  const emails = new Set<string>();
  records.slice(1).forEach((record, offset) => {
    const row = offset + 2;
    const name = record[indexes.name]?.trim() ?? "";
    const email = (record[indexes.email]?.trim() ?? "").toLowerCase();
    const phone = indexes.phone >= 0 ? record[indexes.phone]?.trim() : "";
    const requestedCompany =
      defaultCompany ?? companyByName.get(normalize(record[indexes.company] ?? ""));
    const status = statusValue(indexes.status >= 0 ? record[indexes.status] ?? "" : "active");
    const errors: string[] = [];
    if (name.length < 2 || name.length > 80) errors.push("nombre inválido");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160)
      errors.push("correo inválido");
    if (email && emails.has(email)) errors.push("correo duplicado en el archivo");
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
      errors.push("celular debe usar formato internacional, por ejemplo +59170000000");
    if (!requestedCompany) errors.push("empresa no encontrada");
    if (requestedCompany && requestedCompany.status === "suspended")
      errors.push("empresa suspendida");
    if (!status) errors.push("estado inválido");
    if (errors.length) {
      issues.push({ row, message: errors.join("; ") });
      return;
    }
    emails.add(email);
    rows.push({
      row,
      name,
      email,
      phone: phone || undefined,
      companyId: requestedCompany!.id,
      companyName: requestedCompany!.name,
      status: status!,
    });
  });
  if (rows.length > 250) {
    return {
      rows: [],
      issues: [{ row: 1, message: "El archivo supera el máximo de 250 clientes por importación." }],
    };
  }
  return { rows, issues };
}

export function clientCsvTemplate(companyName?: string) {
  const company = companyName || "Zontes";
  return [
    "nombre;correo;celular;empresa;estado",
    `Cliente Ejemplo;cliente@example.com;+59170000000;${company};active`,
  ].join("\r\n");
}
