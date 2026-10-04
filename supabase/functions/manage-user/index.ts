import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, message } from "../_shared/http.ts";

type Input = {
  id?: string;
  email: string;
  fullName: string;
  phone?: string | null;
  companyId: string;
  status?: "active" | "blocked" | "deleted";
  role?: "client" | "company" | "admin";
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let createdId: string | undefined;
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sesión inválida." }, 401);
    const { data: caller, error: callerError } = await admin
      .from("profiles")
      .select("id,role,status")
      .eq("id", authData.user.id)
      .single();
    if (callerError || caller?.status !== "active" || !["admin", "company"].includes(caller.role))
      return json({ error: "No tienes permiso para gestionar usuarios." }, 403);

    const input = (await request.json()) as Input;
    const email = input.email?.trim().toLowerCase();
    const fullName = input.fullName?.trim();
    const role = input.role ?? "client";
    const status = input.status ?? "active";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("Correo inválido.");
    if (!fullName || fullName.length < 2 || fullName.length > 80) throw Error("Nombre inválido.");
    if (!input.companyId) throw Error("Selecciona una empresa.");
    if (input.phone && !/^\+[1-9]\d{7,14}$/.test(input.phone)) throw Error("Celular inválido.");
    if (caller.role === "company" && role !== "client") return json({ error: "Una empresa solo puede crear clientes." }, 403);

    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id,status")
      .eq("id", input.companyId)
      .single();
    if (companyError || !company) throw Error("La empresa no existe.");
    if (caller.role === "company") {
      const { data: membership } = await admin
        .from("company_memberships")
        .select("company_id")
        .eq("profile_id", caller.id)
        .eq("company_id", company.id)
        .eq("active", true)
        .maybeSingle();
      if (!membership || company.status === "suspended") return json({ error: "No tienes acceso a esta empresa." }, 403);
    }

    let userId = input.id;
    let isNewUser = false;
    if (!userId) {
      const { data: existingProfile, error: existingError } = await admin
        .from("profiles")
        .select("id,primary_company_id,role")
        .eq("email", email)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingProfile) {
        if (existingProfile.role !== role) {
          return json(
            { error: "Este correo ya pertenece a otra cuenta." },
            409,
          );
        }
        userId = existingProfile.id;
        if (
          caller.role === "company" &&
          (existingProfile.role !== "client" ||
            existingProfile.primary_company_id !== company.id)
        ) {
          return json(
            { error: "Este correo ya pertenece a otra cuenta." },
            409,
          );
        }
      }
    }
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone: input.phone ?? null },
      });
      if (error) throw error;
      userId = data.user.id;
      createdId = userId;
      isNewUser = true;
    } else {
      const { data: target } = await admin.from("profiles").select("primary_company_id").eq("id", userId).single();
      if (caller.role === "company" && target?.primary_company_id !== company.id)
        return json({ error: "Solo puedes editar clientes de tu empresa." }, 403);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone: input.phone ?? null },
      });
      if (error) throw error;
    }

    const profileChanges: Record<string, unknown> = {
      full_name: fullName,
      email,
      phone: input.phone ?? null,
      role,
      status,
      primary_company_id: company.id,
    };
    if (isNewUser) profileChanges.demo_usdt = role === "client" ? 20000 : 0;
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update(profileChanges)
      .eq("id", userId)
      .select()
      .single();
    if (profileError) throw profileError;

    const { error: membershipDeleteError } = await admin
      .from("company_memberships")
      .delete()
      .eq("profile_id", userId);
    if (membershipDeleteError) throw membershipDeleteError;
    if (role === "company") {
      const { error } = await admin.from("company_memberships").insert({ company_id: company.id, profile_id: userId });
      if (error) throw error;
    }
    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_id: caller.id,
      company_id: company.id,
      action: isNewUser ? "Usuario creado" : "Usuario actualizado",
      target_type: "profile",
      target_id: userId,
      payload: { role, status, email },
    });
    if (auditError) throw auditError;
    return json({ profile });
  } catch (error) {
    if (createdId) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      await admin.auth.admin.deleteUser(createdId);
    }
    return json({ error: message(error) }, 400);
  }
});
