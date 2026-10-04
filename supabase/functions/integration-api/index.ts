import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, message } from "../_shared/http.ts";

type CustomerInput = {
  company: string;
  externalId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  status?: "active" | "blocked" | "deleted";
};

type PurchaseInput = {
  company: string;
  externalId: string;
  customerEmail: string;
  bikeId: string;
  amountUSDT?: number;
};

class ApiError extends Error {
  constructor(public status: number, text: string) {
    super(text);
  }
}

function endpointFor(url: URL) {
  const marker = "/integration-api";
  const position = url.pathname.indexOf(marker);
  const value = position >= 0 ? url.pathname.slice(position + marker.length) : url.pathname;
  return (value.replace(/\/+$/, "") || "/").toLowerCase();
}

async function sameSecret(received: string, expected: string) {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

function cleanEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Correo inválido.");
  return email;
}

function cleanText(value: unknown, label: string, minimum: number, maximum: number) {
  const result = String(value ?? "").trim();
  if (result.length < minimum || result.length > maximum)
    throw new ApiError(400, `${label} debe tener entre ${minimum} y ${maximum} caracteres.`);
  return result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const endpoint = endpointFor(new URL(request.url));
  // Credencial central de RideClub: autoriza todas las empresas, no una sola.
  const configuredKey = Deno.env.get("INTEGRATION_API_KEY") ?? "";
  const receivedKey = request.headers.get("x-integration-key") ?? "";
  if (!configuredKey || !receivedKey || !(await sameSecret(receivedKey, configuredKey)))
    return json({ error: "Integración no autorizada.", requestId }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  let companyId: string | null = null;
  let externalReference: string | null = null;
  let createdUserId: string | undefined;
  let status = 200;

  try {
    if (!["GET", "POST"].includes(request.method)) throw new ApiError(405, "Método no permitido.");
    if (request.method === "GET" && endpoint === "/health") {
      return json({ ok: true, service: "rideclub-integration-api", version: "1", requestId });
    }

    const url = new URL(request.url);
    const payload = request.method === "POST" ? await request.json() : null;
    const companySlug = cleanText(
      request.method === "GET" ? url.searchParams.get("company") : payload?.company,
      "Empresa",
      2,
      50,
    ).toLowerCase();
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id,slug,name,status")
      .eq("slug", companySlug)
      .single();
    if (companyError || !company) throw new ApiError(404, "Empresa no encontrada.");
    if (company.status !== "active") throw new ApiError(409, "La empresa no está activa.");
    companyId = company.id;

    let response: unknown;
    if (request.method === "GET" && endpoint === "/customers") {
      const { data, error } = await admin
        .from("external_customer_links")
        .select("external_id,source,last_synced_at,profile:profiles!external_customer_links_profile_id_fkey(id,full_name,email,phone,status,created_at)")
        .eq("company_id", company.id)
        .order("last_synced_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      response = { customers: data, requestId };
    } else if (request.method === "POST" && endpoint === "/customers") {
      const input = payload as CustomerInput;
      const email = cleanEmail(input.email);
      const fullName = cleanText(input.fullName, "Nombre", 2, 80);
      const externalId = cleanText(input.externalId, "Identificador externo", 3, 120);
      externalReference = externalId;
      if (input.phone && !/^\+[1-9]\d{7,14}$/.test(input.phone))
        throw new ApiError(400, "El celular debe incluir código de país, por ejemplo +59170000000.");
      if (input.status && !["active", "blocked", "deleted"].includes(input.status))
        throw new ApiError(400, "Estado de cliente inválido.");

      const { data: linked, error: linkedError } = await admin
        .from("external_customer_links")
        .select("profile_id")
        .eq("company_id", company.id)
        .eq("external_id", externalId)
        .maybeSingle();
      if (linkedError) throw linkedError;
      const { data: existing, error: existingError } = await admin
        .from("profiles")
        .select("id,role,primary_company_id")
        .eq("email", email)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing && (existing.role !== "client" || (existing.primary_company_id && existing.primary_company_id !== company.id)))
        throw new ApiError(409, "El correo ya pertenece a otra cuenta o empresa.");
      if (linked && existing && linked.profile_id !== existing.id)
        throw new ApiError(409, "El identificador externo ya pertenece a otro cliente.");
      if (existing) {
        const { data: profileLink, error: profileLinkError } = await admin
          .from("external_customer_links")
          .select("external_id")
          .eq("company_id", company.id)
          .eq("profile_id", existing.id)
          .maybeSingle();
        if (profileLinkError) throw profileLinkError;
        if (profileLink && profileLink.external_id !== externalId)
          throw new ApiError(409, "El cliente ya está vinculado con otro identificador externo.");
      }

      let profileId = existing?.id;
      if (!profileId && linked) throw new ApiError(409, "El identificador externo ya pertenece a otro cliente.");
      if (!profileId) {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone: input.phone ?? null, brand: company.name },
        });
        if (error) throw error;
        profileId = data.user.id;
        createdUserId = profileId;
      } else {
        const { error } = await admin.auth.admin.updateUserById(profileId, {
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone: input.phone ?? null, brand: company.name },
        });
        if (error) throw error;
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .update({
          full_name: fullName,
          email,
          phone: input.phone ?? null,
          role: "client",
          status: input.status ?? "active",
          primary_company_id: company.id,
        })
        .eq("id", profileId)
        .select("id,full_name,email,phone,status,created_at")
        .single();
      if (profileError) throw profileError;

      const link = {
        company_id: company.id,
        profile_id: profileId,
        external_id: externalId,
        source: "api",
        last_synced_at: new Date().toISOString(),
      };
      // No sobrescribir el propietario si otra solicitud insertó el vínculo.
      const { error: linkError } = linked
        ? await admin.from("external_customer_links")
          .update({ source: link.source, last_synced_at: link.last_synced_at })
          .eq("company_id", company.id).eq("external_id", externalId).eq("profile_id", profileId)
        : await admin.from("external_customer_links").insert(link);
      if (linkError) throw linkError;
      const { error: auditError } = await admin.from("audit_logs").insert({
        actor_id: null,
        company_id: company.id,
        action: existing ? "Cliente sincronizado por API" : "Cliente creado por API",
        target_type: "profile",
        target_id: profileId,
        payload: { external_id: externalId, source: "integration-api" },
      });
      if (auditError) throw auditError;
      createdUserId = undefined;
      status = existing ? 200 : 201;
      response = { customer: { ...profile, externalId }, created: !existing, requestId };
    } else if (request.method === "GET" && endpoint === "/bikes") {
      const { data, error } = await admin
        .from("bikes")
        .select("id,external_key,name,category,tag,description,price_usdt,archived,updated_at")
        .eq("company_id", company.id)
        .order("name")
        .limit(200);
      if (error) throw error;
      response = { bikes: data, requestId };
    } else if (request.method === "GET" && endpoint === "/purchases") {
      const { data, error } = await admin
        .from("purchases")
        .select("id,operation_id,bike_id,bike_name,amount_usdt,points_awarded,created_at,customer:profiles!purchases_owner_id_fkey(id,full_name,email)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      response = { purchases: data, requestId };
    } else if (request.method === "POST" && endpoint === "/purchases") {
      const input = payload as PurchaseInput;
      const externalId = cleanText(input.externalId, "Referencia de compra", 3, 80);
      externalReference = externalId;
      const customerEmail = cleanEmail(input.customerEmail);
      const bikeId = cleanText(input.bikeId, "Moto", 36, 36);
      if (input.amountUSDT !== undefined && (!Number.isFinite(input.amountUSDT) || input.amountUSDT <= 0))
        throw new ApiError(400, "Monto USDT inválido.");
      const { data, error } = await admin.rpc("record_external_purchase", {
        p_company_slug: company.slug,
        p_customer_email: customerEmail,
        p_external_id: externalId,
        p_bike_id: bikeId,
        p_amount_usdt: input.amountUSDT ?? null,
      });
      if (error) throw error;
      status = data?.created ? 201 : 200;
      response = { ...data, requestId };
    } else {
      throw new ApiError(404, "Ruta no encontrada.");
    }

    await admin.from("integration_logs").insert({
      request_id: requestId,
      company_id: companyId,
      endpoint,
      method: request.method,
      status_code: status,
      outcome: "success",
      external_reference: externalReference,
    });
    return json(response, status);
  } catch (error) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    status = error instanceof ApiError ? error.status : 400;
    await admin.from("integration_logs").insert({
      request_id: requestId,
      company_id: companyId,
      endpoint,
      method: request.method,
      status_code: status,
      outcome: "error",
      external_reference: externalReference,
    });
    return json({ error: message(error), requestId }, status);
  }
});
