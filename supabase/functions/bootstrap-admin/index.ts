import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, message } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let createdId: string | undefined;
  try {
    const secret = Deno.env.get("BOOTSTRAP_SECRET");
    if (!secret || request.headers.get("x-bootstrap-secret") !== secret)
      return json({ error: "Bootstrap no autorizado." }, 401);
    const { email, fullName } = await request.json();
    if (!email || !fullName) throw Error("Email y nombre son obligatorios.");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const existing = await admin.from("profiles").select("id").eq("role", "admin").limit(1);
    if (existing.error) throw existing.error;
    if ((existing.data?.length ?? 0) > 0) return json({ error: "Ya existe un administrador. Desactiva esta función." }, 409);
    const { data, error } = await admin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      email_confirm: true,
      user_metadata: { full_name: String(fullName).trim() },
    });
    if (error) throw error;
    createdId = data.user.id;
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update({ role: "admin", demo_usdt: 0 })
      .eq("id", data.user.id)
      .select()
      .single();
    if (profileError) throw profileError;
    createdId = undefined;
    return json({ profile }, 201);
  } catch (error) {
    if (createdId) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      await admin.auth.admin.deleteUser(createdId);
    }
    return json({ error: message(error) }, 400);
  }
});
