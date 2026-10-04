import type { Bike, Reward, ActivityKind } from "../../data/catalog";
import {
  defaultPointRules,
  mockWalletAddress,
  type Account,
  type Company,
  type Coupon,
  type Demo,
  type PointRuleSet,
  type Purchase,
} from "../demo";
import type { BikeDraft, ClientDraft, CompanyDraft, RewardDraft } from "../business";
import type { ClientImportOutcome, ClientImportRow } from "../clientCsv";
import { supabaseClient } from "./client";

const publicRealtimeTables = [
  "companies",
  "point_rules",
  "bikes",
  "rewards",
] as const;

const privateRealtimeTables = [
  "profiles",
  "company_memberships",
  "point_balances",
  "purchases",
  "point_ledger",
  "coupons",
  "favorites",
  "audit_logs",
] as const;

export type BackendRealtimeStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export function subscribeBackendChanges(
  onChange: () => void,
  onStatus: (status: BackendRealtimeStatus) => void,
  authenticated: boolean,
) {
  const client = supabaseClient();
  const channel = client.channel(`rideclub-live-${crypto.randomUUID()}`);

  const tables = authenticated
    ? [...publicRealtimeTables, ...privateRealtimeTables]
    : publicRealtimeTables;
  for (const table of tables) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      onChange,
    );
  }

  onStatus("connecting");
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus("connected");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
      onStatus("error");
    else if (status === "CLOSED") onStatus("disconnected");
  });

  return () => {
    void client.removeChannel(channel);
  };
}

const toDbKind: Record<ActivityKind, string> = {
  Compra: "purchase",
  Mantenimiento: "maintenance",
  Referido: "referral",
  Evento: "event",
};
const fromDbKind: Record<string, ActivityKind> = {
  purchase: "Compra",
  maintenance: "Mantenimiento",
  referral: "Referido",
  event: "Evento",
};

function fail(error: { message: string } | null) {
  if (error) throw Error(error.message);
}

async function fetchAll(table: string, orderColumn = "created_at") {
  const pageSize = 1000;
  const rows: Record<string, any>[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await supabaseClient()
      .from(table)
      .select("*")
      .order(orderColumn, { ascending: false })
      .range(from, from + pageSize - 1);
    fail(result.error);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function requestRegistration(input: {
  name: string;
  email: string;
  phone: string;
  brand: string;
  referralCode?: string;
}) {
  const { error } = await supabaseClient().auth.signInWithOtp({
    email: input.email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      // Supabase returns the session in the URL hash. Keep our hash-based
      // router out of the callback URL so it cannot overwrite those tokens.
      emailRedirectTo: `${window.location.origin}/?auth=callback`,
      data: {
        full_name: input.name.trim(),
        phone: input.phone,
        brand: input.brand,
        referral_code: input.referralCode?.trim() || null,
      },
    },
  });
  fail(error);
}

export async function requestLogin(email: string) {
  const { error } = await supabaseClient().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/?auth=callback`,
    },
  });
  fail(error);
}

export async function logoutBackend() {
  const { error } = await supabaseClient().auth.signOut();
  fail(error);
}

export async function importBackendClients(
  rows: ClientImportRow[],
  existingEmails: Set<string>,
): Promise<ClientImportOutcome[]> {
  const client = supabaseClient();
  const outcomes: ClientImportOutcome[] = [];
  for (const row of rows) {
    const existed = existingEmails.has(row.email);
    const result = await client.functions.invoke("manage-user", {
      body: {
        email: row.email,
        fullName: row.name,
        phone: row.phone ?? null,
        companyId: row.companyId,
        role: "client",
        status: row.status,
      },
    });
    if (result.error || result.data?.error) {
      outcomes.push({
        ...row,
        result: "error",
        message: result.data?.error ?? result.error?.message ?? "No se pudo importar.",
      });
    } else {
      outcomes.push({ ...row, result: existed ? "updated" : "created" });
      existingEmails.add(row.email);
    }
  }
  return outcomes;
}

export async function loadBackendState(): Promise<Demo> {
  const client = supabaseClient();
  const [companyRows, ruleRows, bikeRows, rewardRows, sessionResult] = await Promise.all([
    fetchAll("companies"),
    fetchAll("point_rules", "updated_at"),
    fetchAll("bikes"),
    fetchAll("rewards"),
    client.auth.getSession(),
  ]);
  fail(sessionResult.error);
  const nameById = new Map(companyRows.map((row) => [row.id, String(row.name)]));
  const rulesByCompany = new Map<string, PointRuleSet>();
  for (const company of companyRows) rulesByCompany.set(company.id, defaultPointRules());
  for (const row of ruleRows) {
    const rules = rulesByCompany.get(row.company_id) ?? defaultPointRules();
    const kind = fromDbKind[row.kind];
    if (kind) rules[kind] = { points: row.points, expiryDays: row.expiry_days };
    rulesByCompany.set(row.company_id, rules);
  }
  const companies: Company[] = companyRows.map((row) => ({
    id: row.id, name: String(row.name), email: String(row.access_email), subtitle: row.subtitle,
    logo: row.logo_url, color: row.color, url: row.website_url, status: row.status,
    createdAt: row.created_at, wallet: { chainId: row.wallet_chain_id, address: row.wallet_address ?? undefined },
    pointRules: rulesByCompany.get(row.id) ?? defaultPointRules(),
  }));
  const catalogBikes: Bike[] = bikeRows.map((row) => ({
    id: row.id, brand: nameById.get(row.company_id) ?? "Empresa", name: row.name,
    category: row.category, tag: row.tag, description: row.description, image: row.image_url,
    price: row.price_usdt === null ? undefined : Number(row.price_usdt), source: row.source_url,
    region: row.region, specs: row.specs as [string, string][], archived: row.archived,
  }));
  const catalogRewards: Reward[] = rewardRows.map((row) => ({
    id: row.id, brand: nameById.get(row.company_id) ?? "Empresa", title: row.title,
    kind: row.kind, category: row.category, points: row.points, detail: row.detail,
    terms: row.terms, days: row.validity_days, stock: row.stock,
    image: row.image_url ?? undefined, archived: row.archived,
  }));
  const base: Demo = { version: 1, accounts: [], currentId: null, coupons: [], activities: [], purchases: [], companies, catalogBikes, catalogRewards, audit: [] };
  const session = sessionResult.data.session;
  if (!session) return base;
  const access = await client.rpc("account_access_status");
  fail(access.error);
  const status = access.data?.[0];
  if (!status || status.status !== "active") {
    await client.auth.signOut();
    throw Error(status?.status === "blocked" ? "Esta cuenta está bloqueada." : "Esta cuenta fue dada de baja.");
  }
  const expiryResult = await client.rpc("expire_my_points");
  fail(expiryResult.error);
  const [profileRows, memberships, balances, purchaseRows, couponRows, ledgerRows, favorites, auditRows, referralsResult] = await Promise.all([
    fetchAll("profiles"), fetchAll("company_memberships"),
    fetchAll("point_balances", "updated_at"), fetchAll("purchases"),
    fetchAll("coupons", "issued_at"), fetchAll("point_ledger"),
    fetchAll("favorites"), fetchAll("audit_logs"),
    client.rpc("my_referrals"),
  ]);
  fail(referralsResult.error);
  const referralCodeById = new Map(
    profileRows.map((profile) => [profile.id, profile.referral_code]),
  );
  const accounts: Account[] = profileRows.map((row) => {
    const membership = memberships.find((item) => item.profile_id === row.id && item.active);
    return {
      id: row.id, name: row.full_name, email: String(row.email), phone: row.phone ?? undefined,
      role: row.role, companyId: membership?.company_id ?? undefined,
      brand: row.primary_company_id ? nameById.get(row.primary_company_id) : undefined,
      createdAt: row.created_at, balanceUSDT: Number(row.demo_usdt), code: row.referral_code,
      referredBy: row.referred_by_profile_id
        ? referralCodeById.get(row.referred_by_profile_id)
        : undefined,
      wallet: {
        status: "ready",
        chainId: row.wallet_chain_id,
        address: row.wallet_address ?? mockWalletAddress(row.id),
      },
      points: Object.fromEntries(companies.map((company) => [company.name, balances.find((item) => item.profile_id === row.id && item.company_id === company.id)?.balance ?? 0])),
      favorites: favorites.filter((item) => item.profile_id === row.id).map((item) => item.bike_id), status: row.status,
    };
  });
  const currentAccount = accounts.find((account) => account.id === session.user.id);
  for (const referral of referralsResult.data ?? []) {
    if (accounts.some((account) => account.id === referral.id)) continue;
    accounts.push({
      id: referral.id,
      name: referral.full_name,
      email: "",
      role: "client",
      brand: referral.primary_company_id
        ? nameById.get(referral.primary_company_id)
        : undefined,
      createdAt: referral.created_at,
      balanceUSDT: 0,
      code: "",
      referredBy: currentAccount?.code,
      wallet: {
        status: "ready",
        chainId: 84532,
        address: mockWalletAddress(referral.id),
      },
      points: Object.fromEntries(companies.map((company) => [company.name, 0])),
      favorites: [],
      status: "active",
    });
  }
  const purchases: Purchase[] = purchaseRows.map((row) => ({
    id: row.id, ownerId: row.owner_id, bikeId: row.bike_id, brand: nameById.get(row.company_id) ?? "Empresa",
    model: row.bike_name, amountUSDT: Number(row.amount_usdt), points: row.points_awarded,
    createdAt: row.created_at, operationId: row.operation_id,
  }));
  const coupons: Coupon[] = couponRows.map((row) => ({
    id: row.code, ownerId: row.owner_id, rewardId: row.reward_id, brand: nameById.get(row.company_id) ?? "Empresa",
    title: row.title, points: row.points_spent, terms: row.terms, image: row.image_url ?? undefined,
    issuedAt: row.issued_at, expiresAt: row.expires_at, usedAt: row.used_at ?? undefined, workshop: row.workshop ?? undefined,
  }));
  return {
    ...base, accounts, currentId: session.user.id, purchases, coupons,
    activities: ledgerRows.map((row) => ({
      id: row.id, accountId: row.profile_id, brand: nameById.get(row.company_id) ?? "Empresa",
      label:
        row.kind === "referral" && row.metadata?.invited_profile_id
          ? `Referido confirmado: ${row.metadata.invited_profile_id}`
          : row.label,
      points: row.amount, date: row.created_at, reference: row.reference ?? undefined,
      kind: row.kind ? fromDbKind[row.kind] : undefined, expiresAt: row.expires_at ?? undefined, expiredAt: row.expired_at ?? undefined,
    })),
    audit: auditRows.map((row) => ({
      id: String(row.id), actorId: row.actor_id ?? "system", companyId: row.company_id ?? "",
      action: row.action, targetId: row.target_id, date: row.created_at,
    })),
  };
}

export const backendApi = {
  purchase: async (bikeId: string, operationId: string) => { const r = await supabaseClient().rpc("purchase_bike", { p_bike_id: bikeId, p_operation_id: operationId }); fail(r.error); return r.data; },
  redeem: async (rewardId: string) => { const r = await supabaseClient().rpc("redeem_reward", { p_reward_id: rewardId }); fail(r.error); return r.data; },
  credit: async (clientId: string, companyId: string, kind: ActivityKind, reference: string, confirmed: boolean) => { const r = await supabaseClient().rpc("credit_activity", { p_client_id: clientId, p_company_id: companyId, p_kind: toDbKind[kind], p_reference: reference, p_confirmed: confirmed }); fail(r.error); },
  useCoupon: async (code: string, workshop: string, confirmed: boolean) => { const r = await supabaseClient().rpc("use_coupon", { p_code: code, p_workshop: workshop, p_customer_confirmed: confirmed }); fail(r.error); },
  fund: async () => { const r = await supabaseClient().rpc("fund_demo_account"); fail(r.error); },
  favorite: async (profileId: string, bikeId: string, selected: boolean) => {
    const query = selected ? supabaseClient().from("favorites").insert({ profile_id: profileId, bike_id: bikeId }) : supabaseClient().from("favorites").delete().eq("profile_id", profileId).eq("bike_id", bikeId);
    const { error } = await query; fail(error);
  },
  updateProfile: async (name: string, phone: string | undefined, companyId?: string) => { const r = await supabaseClient().rpc("update_my_profile", { p_full_name: name, p_phone: phone ?? null, p_company_id: companyId ?? null }); fail(r.error); },
};

export async function syncBusinessMutation(before: Demo, after: Demo) {
  const client = supabaseClient();
  const mutationAction =
    after.audit[0]?.id !== before.audit[0]?.id ? after.audit[0]?.action ?? "" : "";

  const changedClient = after.accounts.find(
    (item) =>
      item.role === "client" &&
      JSON.stringify(item) !==
        JSON.stringify(before.accounts.find((old) => old.id === item.id)),
  );
  if (changedClient) {
    const old = before.accounts.find((item) => item.id === changedClient.id);
    const company = after.companies.find(
      (item) => item.name === changedClient.brand,
    );
    const result = await client.functions.invoke("manage-user", {
      body: {
        id: old ? changedClient.id : undefined,
        email: changedClient.email,
        fullName: changedClient.name,
        phone: changedClient.phone ?? null,
        companyId: company?.id,
        role: "client",
        status: changedClient.status ?? "active",
      },
    });
    if (result.error || result.data?.error)
      throw Error(result.data?.error ?? result.error?.message);
    return;
  }

  const changedBike = after.catalogBikes.find(
    (item) =>
      item.id === after.audit[0]?.targetId &&
      JSON.stringify(item) !==
        JSON.stringify(before.catalogBikes.find((old) => old.id === item.id)),
  ) ?? after.catalogBikes.find(
    (item) =>
      JSON.stringify(item) !==
      JSON.stringify(before.catalogBikes.find((old) => old.id === item.id)),
  );
  if (changedBike) {
    const old = before.catalogBikes.find((item) => item.id === changedBike.id);
    if (old && old.archived !== changedBike.archived) {
      const r = await client.rpc("archive_catalog_item", {
        p_kind: "bike",
        p_id: changedBike.id,
        p_archived: changedBike.archived ?? false,
      });
      fail(r.error);
      return;
    }
    const company = after.companies.find(
      (item) => item.name === changedBike.brand,
    )!;
    const r = await client.rpc("manage_bike", {
      p_id: old ? changedBike.id : null,
      p_company_id: company.id,
      p_name: changedBike.name,
      p_category: changedBike.category,
      p_tag: changedBike.tag,
      p_description: changedBike.description,
      p_image_url: changedBike.image,
      p_price_usdt: changedBike.price ?? null,
      p_source_url: changedBike.source,
      p_region: changedBike.region,
      p_specs: changedBike.specs,
    });
    fail(r.error);
    return;
  }

  const changedReward = after.catalogRewards.find(
    (item) =>
      item.id === after.audit[0]?.targetId &&
      JSON.stringify(item) !==
        JSON.stringify(before.catalogRewards.find((old) => old.id === item.id)),
  ) ?? after.catalogRewards.find(
    (item) =>
      JSON.stringify(item) !==
      JSON.stringify(before.catalogRewards.find((old) => old.id === item.id)),
  );
  if (changedReward && !mutationAction.startsWith("Reglas de puntuación")) {
    const old = before.catalogRewards.find(
      (item) => item.id === changedReward.id,
    );
    if (old && old.archived !== changedReward.archived) {
      const r = await client.rpc("archive_catalog_item", {
        p_kind: "reward",
        p_id: changedReward.id,
        p_archived: changedReward.archived ?? false,
      });
      fail(r.error);
      return;
    }
    const company = after.companies.find(
      (item) => item.name === changedReward.brand,
    )!;
    const r = await client.rpc("manage_reward", {
      p_id: old ? changedReward.id : null,
      p_company_id: company.id,
      p_title: changedReward.title,
      p_kind: changedReward.kind,
      p_category: changedReward.category,
      p_points: changedReward.points,
      p_detail: changedReward.detail,
      p_terms: changedReward.terms,
      p_validity_days: changedReward.days,
      p_stock: changedReward.stock,
      p_image_url: changedReward.image ?? "",
    });
    fail(r.error);
    return;
  }

  const addedCompany = after.companies.find((item) => !before.companies.some((old) => old.id === item.id));
  const changedCompany = addedCompany ?? after.companies.find((item) => JSON.stringify(item) !== JSON.stringify(before.companies.find((old) => old.id === item.id)));
  if (changedCompany) {
    const old = before.companies.find((item) => item.id === changedCompany.id);
    if (old && old.wallet.address !== changedCompany.wallet.address && JSON.stringify({ ...old, wallet: changedCompany.wallet }) === JSON.stringify(changedCompany)) {
      const r = await client.rpc("update_company_wallet", { p_company_id: changedCompany.id, p_address: changedCompany.wallet.address ?? "" }); fail(r.error); return;
    }
    if (old && JSON.stringify(old.pointRules) !== JSON.stringify(changedCompany.pointRules)) {
      const rules = Object.fromEntries(Object.entries(changedCompany.pointRules).map(([kind, rule]) => [toDbKind[kind as ActivityKind], { points: rule.points, expiry_days: rule.expiryDays }]));
      const r = await client.rpc("update_point_rules", { p_company_id: changedCompany.id, p_rules: rules }); fail(r.error); return;
    }
    const r = await client.rpc("manage_company", {
      p_id: old ? changedCompany.id : null, p_name: changedCompany.name, p_access_email: changedCompany.email,
      p_subtitle: changedCompany.subtitle, p_logo_url: changedCompany.logo, p_color: changedCompany.color,
      p_website_url: changedCompany.url, p_status: changedCompany.status,
    }); fail(r.error);
    const companyId = r.data.id;
    const companyAccount = before.accounts.find(
      (account) => account.role === "company" && account.companyId === old?.id,
    );
    const user = await client.functions.invoke("manage-user", { body: { id: companyAccount?.id, email: changedCompany.email, fullName: changedCompany.name, companyId, role: "company", status: "active" } });
    if (user.error || user.data?.error) throw Error(user.data?.error ?? user.error?.message);
    return;
  }
  throw Error("No se identificó la operación que debe sincronizarse.");
}
