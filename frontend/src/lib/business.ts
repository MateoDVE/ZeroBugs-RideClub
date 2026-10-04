import type { Bike, Brand, Reward } from "../data/catalog";
import {
  defaultPointRules,
  demoFunding,
  id,
  mockWalletAddress,
  type Account,
  type Company,
  type Demo,
  type PointRuleSet,
} from "./demo";
export type CompanyDraft = Omit<
  Company,
  "id" | "createdAt" | "wallet" | "pointRules"
> & {
  walletAddress?: string;
  pointRules?: PointRuleSet;
};
export type ClientDraft = Pick<Account, "name" | "email" | "phone" | "brand"> & {
  status: "active" | "blocked" | "deleted";
};
export type BikeDraft = Omit<Bike, "id" | "brand" | "archived">;
export type RewardDraft = Omit<Reward, "id" | "brand" | "archived">;
export function actor(state: Demo): Account {
  const account = state.accounts.find((a) => a.id === state.currentId);
  if (!account || account.role === "client")
    throw Error("Inicia sesión como administrador o empresa.");
  return account;
}
export function assertCompanyAccess(
  state: Demo,
  companyId: string,
  write = false,
): Company {
  const a = actor(state);
  const company = state.companies.find((c) => c.id === companyId);
  if (!company || (a.role === "company" && a.companyId !== company.id))
    throw Error("No tienes acceso a esta empresa.");
  if (write && a.role === "company" && company.status === "suspended")
    throw Error(
      "Los permisos de esta empresa están suspendidos. Contacta al administrador.",
    );
  return company;
}
export function manageBrand(state: Demo, brand: Brand): Company {
  const company = state.companies.find((c) => c.name === brand);
  if (!company) throw Error("La empresa no existe.");
  return assertCompanyAccess(state, company.id, true);
}

function companyOperator(state: Demo, companyId: string): Company {
  const current = actor(state);
  if (current.role === "admin") return assertCompanyAccess(state, companyId, true);
  return assertCompanyAccess(state, companyId, true);
}
export function safeURL(value: string, image = false): string {
  value = value.trim();
  if (!value) return "";
  if (
    image &&
    (/^\/assets\/[a-zA-Z0-9._/-]+$/.test(value) ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))
  )
    return value;
  try {
    const url = new URL(value);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return value;
  } catch {
    /* Invalid URL. */
  }
  throw Error("Usa una URL http/https válida o una imagen PNG, JPEG o WebP.");
}
function text(value: string, label: string, min = 2, max = 250) {
  value = value.trim();
  if (value.length < min || value.length > max)
    throw Error(`Revisa ${label} (${min}–${max} caracteres).`);
  return value;
}
function audit(
  state: Demo,
  companyId: string,
  action: string,
  targetId: string,
): Demo {
  return {
    ...state,
    audit: [
      {
        id: id(),
        actorId: state.currentId!,
        companyId,
        action,
        targetId,
        date: new Date().toISOString(),
      },
      ...state.audit,
    ],
  };
}
export function saveCompany(
  state: Demo,
  draft: CompanyDraft,
  companyId?: string,
): Demo {
  if (actor(state).role !== "admin")
    throw Error(
      "Solo el administrador puede registrar empresas y asignar permisos.",
    );
  const existing = companyId
    ? assertCompanyAccess(state, companyId)
    : undefined;
  const name = text(draft.name, "el nombre de la empresa", 2, 45);
  if (
    ["todas", "todos", "constructor", "prototype", "__proto__"].includes(
      name.toLowerCase(),
    ) ||
    !/^[\p{L}\p{N}][\p{L}\p{N} .&'-]*$/u.test(name)
  )
    throw Error("El nombre de empresa contiene caracteres no admitidos.");
  if (existing && existing.name !== name)
    throw Error(
      "El nombre de marca identifica su historial y no se puede cambiar.",
    );
  if (
    state.companies.some(
      (c) => c.id !== companyId && c.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw Error("Esta empresa ya existe.");
  const email = draft.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160)
    throw Error("Revisa el correo de acceso de la empresa.");
  if (
    email === "admin@rideclub.demo" ||
    state.companies.some((c) => c.id !== companyId && c.email === email) ||
    state.accounts.some(
      (a) =>
        a.email === email &&
        !(a.role === "company" && a.companyId === companyId),
    )
  )
    throw Error("Este correo ya está asociado a otra cuenta o empresa.");
  if (!["pending", "active", "suspended"].includes(draft.status))
    throw Error("Selecciona permisos válidos.");
  if (!/^#[a-fA-F0-9]{6}$/.test(draft.color))
    throw Error("Selecciona un color válido.");
  const address = draft.walletAddress?.trim();
  if (address && !/^0x[0-9a-fA-F]{40}$/.test(address))
    throw Error(
      "La dirección EVM debe tener 0x y 40 caracteres hexadecimales.",
    );
  const company: Company = {
    id: existing?.id ?? id(),
    name,
    email,
    subtitle: text(
      draft.subtitle || "Tu próxima ruta empieza aquí",
      "el lema",
      2,
      120,
    ),
    logo: safeURL(draft.logo, true),
    url: safeURL(draft.url),
    color: draft.color,
    status: draft.status,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    wallet: { chainId: 84532, address: address || undefined },
    pointRules:
      draft.pointRules ?? existing?.pointRules ?? defaultPointRules(),
  };
  return audit(
    {
      ...state,
      companies: existing
        ? state.companies.map((c) => (c.id === company.id ? company : c))
        : [...state.companies, company],
      accounts: state.accounts.map((a) => ({
        ...a,
        ...(a.role === "company" && a.companyId === company.id
          ? { email, name }
          : {}),
        points: { ...a.points, [name]: a.points[name] ?? 0 },
      })),
    },
    company.id,
    existing ? "Empresa actualizada" : "Empresa registrada",
    company.id,
  );
}

function uniqueCode(state: Demo) {
  let code: string;
  do {
    code = String(
      10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000),
    );
  } while (state.accounts.some((account) => account.code === code));
  return code;
}

export function saveClient(
  state: Demo,
  draft: ClientDraft,
  accountId?: string,
): Demo {
  const current = actor(state);
  const company =
    current.role === "admin"
      ? state.companies.find((item) => item.name === draft.brand)
      : assertCompanyAccess(state, current.companyId!, true);
  if (!company) throw Error("Selecciona una empresa válida para el perfil.");
  const existing = accountId
    ? state.accounts.find(
        (account) => account.id === accountId && account.role === "client",
      )
    : undefined;
  if (accountId && !existing) throw Error("El cliente ya no existe.");
  if (
    current.role === "company" &&
    existing &&
    existing.brand !== company.name
  )
    throw Error("Solo puedes editar clientes registrados en tu empresa.");
  const name = text(draft.name, "el nombre del cliente", 2, 80);
  const email = draft.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160)
    throw Error("Revisa el correo del cliente.");
  if (
    state.accounts.some(
      (account) => account.id !== accountId && account.email === email,
    ) ||
    state.companies.some((company) => company.email === email) ||
    email === "admin@rideclub.demo"
  )
    throw Error("Este correo ya está asociado a otra cuenta.");
  if (current.role === "company" && draft.brand !== company.name)
    throw Error("El cliente debe quedar vinculado a tu empresa.");
  const phone = draft.phone?.trim();
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
    throw Error("Usa el celular en formato internacional, por ejemplo +59170000000.");
  if (!["active", "blocked", "deleted"].includes(draft.status))
    throw Error("Selecciona un estado válido.");
  const account: Account = existing
    ? { ...existing, name, email, phone, brand: draft.brand, status: draft.status }
    : {
        id: id(),
        name,
        email,
        phone,
        brand: draft.brand,
        role: "client",
        createdAt: new Date().toISOString(),
        balanceUSDT: demoFunding,
        code: uniqueCode(state),
        wallet: {
          status: "ready",
          chainId: 84532,
          address: mockWalletAddress(email),
        },
        points: Object.fromEntries(
          state.companies.map((company) => [company.name, 0]),
        ),
        favorites: [],
        status: draft.status,
      };
  return audit(
    {
      ...state,
      accounts: existing
        ? state.accounts.map((item) =>
            item.id === account.id ? account : item,
          )
        : [...state.accounts, account],
    },
    company.id,
    existing
      ? draft.status === "deleted"
        ? "Cliente dado de baja"
        : "Cliente actualizado"
      : current.role === "admin"
        ? "Cliente registrado por administración"
        : "Cliente registrado por la empresa",
    account.id,
  );
}

export function savePointRules(
  state: Demo,
  companyId: string,
  rules: PointRuleSet,
): Demo {
  const company = companyOperator(state, companyId);
  const normalized = Object.fromEntries(
    Object.entries(rules).map(([kind, rule]) => {
      if (
        !Number.isInteger(rule.points) ||
        rule.points < 0 ||
        rule.points > 1000000
      )
        throw Error(`Revisa los puntos configurados para ${kind}.`);
      if (
        !Number.isInteger(rule.expiryDays) ||
        rule.expiryDays < 1 ||
        rule.expiryDays > 3650
      )
        throw Error(`La vigencia de ${kind} debe estar entre 1 y 3.650 días.`);
      return [kind, rule];
    }),
  ) as PointRuleSet;
  return audit(
    {
      ...state,
      companies: state.companies.map((item) =>
        item.id === company.id ? { ...item, pointRules: normalized } : item,
      ),
      catalogRewards: state.catalogRewards.map((reward) =>
        reward.brand === company.name && reward.kind === "service"
          ? { ...reward, points: normalized.Mantenimiento.points }
          : reward,
      ),
    },
    company.id,
    "Reglas de puntuación actualizadas",
    company.id,
  );
}
export function saveBike(
  state: Demo,
  companyId: string,
  draft: BikeDraft,
  bikeId?: string,
): Demo {
  const company = companyOperator(state, companyId);
  const existing = bikeId
    ? state.catalogBikes.find((b) => b.id === bikeId)
    : undefined;
  if (bikeId && (!existing || existing.brand !== company.name))
    throw Error("No puedes editar una moto de otra empresa.");
  const price = draft.price;
  if (
    price !== undefined &&
    (!Number.isFinite(price) || price <= 0 || price > 100000000)
  )
    throw Error(
      "Introduce un precio USDT positivo o deja el campo vacío para cotización.",
    );
  if (
    !Array.isArray(draft.specs) ||
    draft.specs.length > 12 ||
    draft.specs.some(
      ([k, v]) => !k.trim() || !v.trim() || k.length > 80 || v.length > 160,
    )
  )
    throw Error("Revisa las especificaciones (nombre: valor). Máximo 12.");
  const bike: Bike = {
    ...draft,
    id: existing?.id ?? id(),
    brand: company.name,
    name: text(draft.name, "el modelo", 2, 80),
    description: text(draft.description, "la descripción", 2, 1000),
    category: text(draft.category, "la categoría", 2, 40),
    tag: text(draft.tag || "Tu próxima moto", "el lema", 2, 80),
    region: text(draft.region || "Catálogo de empresa", "la región", 2, 100),
    image: safeURL(draft.image, true) || "/assets/motorcycle-placeholder.svg",
    source: safeURL(draft.source),
    price: price === undefined ? undefined : Math.round(price * 100) / 100,
    archived: existing?.archived ?? false,
  };
  return audit(
    {
      ...state,
      catalogBikes: existing
        ? state.catalogBikes.map((b) => (b.id === bike.id ? bike : b))
        : [...state.catalogBikes, bike],
    },
    company.id,
    existing ? "Moto editada" : "Moto creada",
    bike.id,
  );
}
export function saveReward(
  state: Demo,
  companyId: string,
  draft: RewardDraft,
  rewardId?: string,
): Demo {
  const company = companyOperator(state, companyId);
  const existing = rewardId
    ? state.catalogRewards.find((r) => r.id === rewardId)
    : undefined;
  if (rewardId && (!existing || existing.brand !== company.name))
    throw Error("No puedes editar una recompensa de otra empresa.");
  if (
    !Number.isInteger(draft.points) ||
    draft.points < 1 ||
    draft.points > 1000000
  )
    throw Error("Los puntos deben ser un entero positivo.");
  if (!Number.isInteger(draft.days) || draft.days < 1 || draft.days > 3650)
    throw Error("La vigencia debe estar entre 1 y 3.650 días.");
  const issued = state.coupons.filter((c) => c.rewardId === rewardId).length;
  if (
    !Number.isInteger(draft.stock) ||
    draft.stock < issued ||
    draft.stock < 0 ||
    draft.stock > 10000
  )
    throw Error(
      `El cupo debe ser entero y no puede ser menor que los ${issued} beneficios ya emitidos.`,
    );
  if (!["service", "parts", "care"].includes(draft.kind))
    throw Error("Selecciona el tipo de recompensa.");
  const reward: Reward = {
    ...draft,
    id: existing?.id ?? id(),
    brand: company.name,
    title: text(draft.title, "el beneficio", 2, 100),
    detail: text(draft.detail, "la descripción", 2, 1000),
    terms: text(draft.terms, "las condiciones", 2, 1500),
    category: text(draft.category, "la categoría", 2, 60),
    image: safeURL(draft.image ?? "", true),
    archived: existing?.archived ?? false,
  };
  const updatedRewards = existing
    ? state.catalogRewards.map((item) =>
        item.id === reward.id ? reward : item,
      )
    : [...state.catalogRewards, reward];
  const catalogRewards =
    reward.kind === "service"
      ? updatedRewards.map((item) =>
          item.brand === company.name && item.kind === "service"
            ? { ...item, points: reward.points }
            : item,
        )
      : updatedRewards;
  return audit(
    {
      ...state,
      catalogRewards,
      companies:
        reward.kind === "service"
          ? state.companies.map((item) =>
              item.id === company.id
                ? {
                    ...item,
                    pointRules: {
                      ...item.pointRules,
                      Mantenimiento: {
                        ...item.pointRules.Mantenimiento,
                        points: reward.points,
                      },
                    },
                  }
                : item,
            )
          : state.companies,
    },
    company.id,
    existing ? "Recompensa editada" : "Recompensa creada",
    reward.id,
  );
}
export function archiveItem(
  state: Demo,
  kind: "bike" | "reward",
  itemId: string,
  archived: boolean,
): Demo {
  const item =
    kind === "bike"
      ? state.catalogBikes.find((b) => b.id === itemId)
      : state.catalogRewards.find((r) => r.id === itemId);
  if (!item) throw Error("El producto ya no existe.");
  const company = manageBrand(state, item.brand);
  const next =
    kind === "bike"
      ? {
          ...state,
          catalogBikes: state.catalogBikes.map((b) =>
            b.id === itemId ? { ...b, archived } : b,
          ),
        }
      : {
          ...state,
          catalogRewards: state.catalogRewards.map((r) =>
            r.id === itemId ? { ...r, archived } : r,
          ),
        };
  return audit(
    next,
    company.id,
    archived ? "Producto retirado del catálogo" : "Producto republicado",
    itemId,
  );
}
export function saveWallet(
  state: Demo,
  companyId: string,
  address: string,
): Demo {
  const company = companyOperator(state, companyId);
  address = address.trim();
  if (address && !/^0x[0-9a-fA-F]{40}$/.test(address))
    throw Error(
      "La dirección EVM debe tener 0x y 40 caracteres hexadecimales.",
    );
  return audit(
    {
      ...state,
      companies: state.companies.map((c) =>
        c.id === company.id
          ? { ...c, wallet: { chainId: 84532, address: address || undefined } }
          : c,
      ),
    },
    company.id,
    "Dirección de cobro actualizada",
    company.id,
  );
}
export type Period = { from?: string; to?: string };
export function readBusiness(
  state: Demo,
  requestedBrand?: string,
  period: Period = {},
) {
  const a = actor(state);
  const own =
    a.role === "company"
      ? state.companies.find((c) => c.id === a.companyId)
      : undefined;
  if (
    a.role === "company" &&
    (!own || (requestedBrand && requestedBrand !== own.name))
  )
    throw Error("No puedes consultar otra empresa.");
  const brand = own?.name ?? requestedBrand;
  if (brand && !state.companies.some((c) => c.name === brand))
    throw Error("La empresa no existe.");
  const matches = (b: string) => !brand || b === brand;
  const within = (date?: string) => {
    if (!period.from && !period.to) return true;
    if (!date) return false;
    const timestamp = new Date(date).getTime();
    return (
      (!period.from ||
        timestamp >= new Date(`${period.from}T00:00:00`).getTime()) &&
      (!period.to ||
        timestamp <= new Date(`${period.to}T23:59:59.999`).getTime())
    );
  };
  const companies = state.companies.filter((c) => matches(c.name));
  const allPurchases = state.purchases.filter((p) => matches(p.brand));
  const allCoupons = state.coupons.filter((c) => matches(c.brand));
  const clients = state.accounts
    .filter(
      (c) =>
        c.role === "client" &&
        (a.role === "admin" || c.status !== "deleted") &&
        (!brand ||
          c.brand === brand ||
          allPurchases.some((p) => p.ownerId === c.id) ||
          allCoupons.some((p) => p.ownerId === c.id)),
    )
    .map((c) => ({
      ...c,
      points: brand ? { [brand]: c.points[brand] ?? 0 } : c.points,
    }));
  const registered = clients.filter(
    (c) =>
      c.status !== "deleted" &&
      (!brand || c.brand === brand) &&
      within(c.createdAt),
  );
  const purchases = allPurchases.filter((p) => within(p.createdAt));
  const coupons = allCoupons.filter((c) => within(c.issuedAt));
  const activities = state.activities.filter(
    (c) => matches(c.brand) && within(c.date),
  );
  const sales =
    Math.round(purchases.reduce((n, p) => n + p.amountUSDT, 0) * 100) / 100;
  return {
    brand,
    companies,
    clients,
    registered,
    purchases,
    coupons,
    activities,
    bikes: state.catalogBikes.filter((b) => matches(b.brand)),
    rewards: state.catalogRewards.filter((r) => matches(r.brand)),
    audit: state.audit.filter(
      (r) => companies.some((c) => c.id === r.companyId) && within(r.date),
    ),
    metrics: {
      registered: registered.length,
      customers: clients.length,
      sales,
      units: purchases.length,
      buyers: new Set(purchases.map((p) => p.ownerId)).size,
      spentPoints: coupons.reduce((n, c) => n + c.points, 0),
      issuedPoints: activities.reduce((n, c) => n + Math.max(c.points, 0), 0),
      redemptions: coupons.length,
      used: coupons.filter((c) => c.usedAt).length,
    },
  };
}
export type BusinessView = ReturnType<typeof readBusiness>;

export function trendSeries(view: BusinessView, days = 14) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return Array.from({ length: days }, (_, index) => {
    const start = new Date(end);
    start.setDate(end.getDate() - (days - index - 1));
    start.setHours(0, 0, 0, 0);
    const finish = new Date(start);
    finish.setHours(23, 59, 59, 999);
    const inside = (value?: string) => {
      if (!value) return false;
      const time = new Date(value).getTime();
      return time >= start.getTime() && time <= finish.getTime();
    };
    return {
      key: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "short",
      }),
      registrations: view.registered.filter((item) => inside(item.createdAt))
        .length,
      sales: view.purchases
        .filter((item) => inside(item.createdAt))
        .reduce((sum, item) => sum + item.amountUSDT, 0),
      redemptions: view.coupons.filter((item) => inside(item.issuedAt)).length,
    };
  });
}
