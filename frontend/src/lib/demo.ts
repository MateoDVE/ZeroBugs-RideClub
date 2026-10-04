import {
  bikes,
  rewards,
  brandInfo,
  brands,
  pointsRules,
  type Brand,
  type Reward,
  type ActivityKind,
} from "../data/catalog";
import { normalizePhone, type PhoneInput } from "./phone";
export const demoFunding = 20000;
export type PointRule = { points: number; expiryDays: number };
export type PointRuleSet = Record<ActivityKind, PointRule>;
export const defaultPointRules = (): PointRuleSet =>
  Object.fromEntries(
    Object.entries(pointsRules).map(([kind, points]) => [
      kind,
      { points, expiryDays: 365 },
    ]),
  ) as PointRuleSet;
export type Account = {
  id: string;
  name: string;
  email: string;
  brand?: Brand;
  role: "client" | "admin" | "company";
  companyId?: string;
  createdAt?: string;
  phone?: string;
  balanceUSDT: number;
  code: string;
  referredBy?: string;
  wallet: { status: "ready" | "pending"; chainId: 84532; address?: string };
  points: Record<Brand, number>;
  favorites: string[];
  status?: "active" | "blocked" | "deleted";
};
export type Coupon = {
  id: string;
  ownerId: string;
  rewardId: string;
  title: string;
  brand: Brand;
  points: number;
  issuedAt: string;
  expiresAt: string;
  usedAt?: string;
  workshop?: string;
  terms?: string;
  image?: string;
};
export type Activity = {
  id: string;
  accountId: string;
  brand: Brand;
  label: string;
  points: number;
  date: string;
  reference?: string;
  kind?: ActivityKind;
  expiresAt?: string;
  expiredAt?: string;
};
export type Purchase = {
  id: string;
  ownerId: string;
  bikeId: string;
  brand: Brand;
  model: string;
  amountUSDT: number;
  points: number;
  createdAt: string;
  operationId: string;
};
export type Company = {
  id: string;
  name: string;
  email: string;
  subtitle: string;
  logo: string;
  color: string;
  url: string;
  status: "pending" | "active" | "suspended";
  createdAt: string;
  wallet: { chainId: 84532; address?: string };
  pointRules: PointRuleSet;
};
export const initialCompanies = (): Company[] =>
  brands.map((name) => ({
    id: name,
    name,
    email: `${name.toLowerCase()}@gmail.com`,
    ...brandInfo[name],
    url: brandInfo[name].url,
    status: "active",
    createdAt: new Date().toISOString(),
    wallet: { chainId: 84532 },
    pointRules: defaultPointRules(),
  }));
export type Demo = {
  version: 1;
  accounts: Account[];
  currentId: string | null;
  coupons: Coupon[];
  activities: Activity[];
  purchases: Purchase[];
  companies: Company[];
  catalogBikes: import("../data/catalog").Bike[];
  catalogRewards: Reward[];
  audit: {
    id: string;
    actorId: string;
    companyId: string;
    action: string;
    targetId: string;
    date: string;
  }[];
};
export function mockWalletAddress(seedValue: string): string {
  let seed = 2166136261;
  for (const character of seedValue) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  let address = "";
  for (let index = 0; index < 5; index += 1) {
    seed = Math.imul(seed ^ (index + 1), 2246822519) >>> 0;
    address += seed.toString(16).padStart(8, "0");
  }
  return `0x${address.slice(0, 40)}`;
}
const seed: Account = {
  id: "demo-rider",
  name: "Manuel",
  email: "manuel@rideclub.demo",
  brand: "Zontes",
  role: "client",
  phone: "+59170000000",
  balanceUSDT: demoFunding,
  code: "10002026",
  wallet: {
    status: "ready",
    chainId: 84532,
    address: mockWalletAddress("demo-rider"),
  },
  points: { Zontes: 1000, NIU: 0, Kiden: 0 },
  favorites: [],
  status: "active",
};
export const initialDemo = (): Demo => ({
  version: 1,
  accounts: [structuredClone(seed)],
  currentId: null,
  coupons: [],
  purchases: [],
  companies: initialCompanies(),
  catalogBikes: structuredClone(bikes),
  catalogRewards: structuredClone(rewards),
  audit: [],
  activities: [
    {
      id: "seed-points",
      accountId: seed.id,
      brand: "Zontes",
      label: "Compra de bienvenida · demo",
      points: 1000,
      date: new Date().toISOString(),
      reference: "DEMO-001",
      kind: "Compra",
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    },
  ],
});
export const id = () => crypto.randomUUID();
export function register(
  state: Demo,
  name: string,
  email: string,
  phone: PhoneInput,
  referredBy: string,
  brand: Brand,
): Demo {
  name = name.trim();
  email = email.trim().toLowerCase();
  referredBy = referredBy.trim();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Error("Revisa tu nombre y correo.");
  if (!state.companies.some((c) => c.name === brand && c.status === "active"))
    throw Error("Selecciona la marca vinculada a tu perfil.");
  if (
    email === "admin@rideclub.demo" ||
    state.companies.some((c) => c.email === email)
  )
    throw Error(
      "Este correo corresponde a un acceso de administración o empresa. Usa Iniciar sesión.",
    );
  const normalizedPhone = normalizePhone(phone);
  if (state.accounts.some((a) => a.email === email))
    throw Error(
      "Este correo ya tiene una cuenta de demo. Ingresa desde “Ya tengo cuenta”.",
    );
  if (referredBy && !state.accounts.some((a) => a.code === referredBy))
    throw Error(
      "No encontramos ese número de referido en esta demo. Revisa el código o deja el campo vacío.",
    );
  let code: string;
  do {
    code = String(
      10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000),
    );
  } while (state.accounts.some((a) => a.code === code));
  const account: Account = {
    id: id(),
    name,
    email,
    brand,
    role: "client",
    createdAt: new Date().toISOString(),
    phone: normalizedPhone,
    balanceUSDT: demoFunding,
    code,
    referredBy: referredBy || undefined,
    wallet: {
      status: "ready",
      chainId: 84532,
      address: mockWalletAddress(email),
    },
    points: Object.fromEntries(state.companies.map((c) => [c.name, 0])),
    favorites: [],
    status: "active",
  };
  return {
    ...state,
    accounts: [...state.accounts, account],
    currentId: account.id,
  };
}
export function login(state: Demo, email: string): Demo {
  email = email.trim().toLowerCase();
  const company = state.companies.find((c) => c.email === email);
  if (company) {
    const existing = state.accounts.find(
      (a) => a.role === "company" && a.companyId === company.id,
    );
    if (existing) return { ...state, currentId: existing.id };
    let code: string;
    do {
      code = String(
        10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000),
      );
    } while (state.accounts.some((a) => a.code === code));
    const account: Account = {
      id: id(),
      name: company.name,
      email,
      role: "company",
      companyId: company.id,
      brand: company.name,
      createdAt: new Date().toISOString(),
      balanceUSDT: 0,
      code,
      points: Object.fromEntries(state.companies.map((c) => [c.name, 0])),
      favorites: [],
      wallet: {
        status: "ready",
        chainId: 84532,
        address: mockWalletAddress(email),
      },
    };
    return {
      ...state,
      accounts: [...state.accounts, account],
      currentId: account.id,
    };
  }
  const a = state.accounts.find(
    (a) => a.email === email && a.role !== "company",
  );
  if (!a)
    throw Error(
      "No encontramos este correo en este perfil del navegador. Si lo creaste en una ventana normal, no aparecerá en incógnito; ingresa desde el mismo perfil o crea otra cuenta de demo aquí.",
    );
  if (a.status === "blocked")
    throw Error("Esta cuenta está bloqueada. Contacta al administrador.");
  if (a.status === "deleted")
    throw Error("Esta cuenta fue dada de baja.");
  return { ...state, currentId: a.id };
}

export function pointRule(
  state: Demo,
  brand: Brand,
  kind: ActivityKind,
): PointRule {
  return (
    state.companies.find((company) => company.name === brand)?.pointRules?.[
      kind
    ] ?? defaultPointRules()[kind]
  );
}

export function applyPointExpirations(
  state: Demo,
  now = new Date(),
): Demo {
  const expiring = state.activities.filter(
    (activity) =>
      activity.points > 0 &&
      activity.expiresAt &&
      !activity.expiredAt &&
      new Date(activity.expiresAt) <= now,
  );
  if (!expiring.length) return state;
  const deductions = new Map<string, number>();
  expiring.forEach((activity) => {
    const key = `${activity.accountId}\u0000${activity.brand}`;
    deductions.set(key, (deductions.get(key) ?? 0) + activity.points);
  });
  const expiryActivities: Activity[] = [];
  const accounts = state.accounts.map((account) => {
    let changed = false;
    const nextPoints = { ...account.points };
    state.companies.forEach((company) => {
      const key = `${account.id}\u0000${company.name}`;
      const requested = deductions.get(key) ?? 0;
      const deducted = Math.min(nextPoints[company.name] ?? 0, requested);
      if (!deducted) return;
      changed = true;
      nextPoints[company.name] -= deducted;
      expiryActivities.push({
        id: id(),
        accountId: account.id,
        brand: company.name,
        label: "Vencimiento de puntos",
        points: -deducted,
        date: now.toISOString(),
      });
    });
    return changed ? { ...account, points: nextPoints } : account;
  });
  return {
    ...state,
    accounts,
    activities: [
      ...expiryActivities,
      ...state.activities.map((activity) =>
        expiring.some((item) => item.id === activity.id)
          ? { ...activity, expiredAt: now.toISOString() }
          : activity,
      ),
    ],
  };
}
export function redeem(
  state: Demo,
  ownerId: string,
  reward: Reward,
  now = new Date(),
): { state: Demo; coupon: Coupon } {
  const account = state.accounts.find((a) => a.id === ownerId);
  if (!account || account.role !== "client")
    throw Error("Ingresa como cliente para canjear.");
  const current = state.catalogRewards.find(
    (r) => r.id === reward.id && !r.archived,
  );
  if (
    !current ||
    !state.companies.some(
      (c) => c.name === current.brand && c.status === "active",
    )
  )
    throw Error("Este beneficio no está disponible.");
  reward = current;
  if (account.points[reward.brand] < reward.points)
    throw Error(
      `Necesitas ${reward.points - account.points[reward.brand]} puntos ${reward.brand} más.`,
    );
  if (
    state.coupons.filter((c) => c.rewardId === reward.id).length >= reward.stock
  )
    throw Error("Este beneficio se agotó en la demo.");
  const coupon: Coupon = {
    id: `RC-${id().toUpperCase()}`,
    ownerId,
    rewardId: reward.id,
    title: reward.title,
    brand: reward.brand,
    points: reward.points,
    terms: reward.terms,
    image: reward.image,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + reward.days * 86400000).toISOString(),
  };
  return {
    coupon,
    state: {
      ...state,
      accounts: state.accounts.map((a) =>
        a.id === ownerId
          ? {
              ...a,
              points: {
                ...a.points,
                [reward.brand]: a.points[reward.brand] - reward.points,
              },
            }
          : a,
      ),
      coupons: [coupon, ...state.coupons],
      activities: [
        {
          id: id(),
          accountId: ownerId,
          brand: reward.brand,
          label: `Canje: ${reward.title}`,
          points: -reward.points,
          date: now.toISOString(),
        },
        ...state.activities,
      ],
    },
  };
}
export function useCoupon(
  state: Demo,
  couponId: string,
  brand: Brand,
  customerConfirmed: boolean,
  workshop: string,
  now = new Date(),
): Demo {
  const c = state.coupons.find((c) => c.id === couponId);
  if (!c) throw Error("No se encontró el cupón.");
  if (c.brand !== brand) throw Error("El cupón pertenece a otra marca.");
  if (c.usedAt)
    throw Error("Este cupón ya fue utilizado. No puede volver a canjearse.");
  if (new Date(c.expiresAt) <= now) throw Error("Este cupón está vencido.");
  if (!customerConfirmed) throw Error("Confirma la autorización del cliente.");
  if (!workshop.trim()) throw Error("Indica el nombre del taller.");
  return {
    ...state,
    coupons: state.coupons.map((x) =>
      x.id === c.id
        ? { ...x, usedAt: now.toISOString(), workshop: workshop.trim() }
        : x,
    ),
    activities: [
      {
        id: id(),
        accountId: c.ownerId,
        brand: c.brand,
        label: `Beneficio utilizado: ${c.title}`,
        points: 0,
        date: now.toISOString(),
      },
      ...state.activities,
    ],
  };
}
export function credit(
  state: Demo,
  accountId: string,
  brand: Brand,
  kind: ActivityKind,
  reference: string,
  confirmed: boolean,
): Demo {
  const a = state.accounts.find((a) => a.id === accountId);
  reference = reference.trim().toUpperCase();
  if (
    !a ||
    a.role !== "client" ||
    !pointsRules[kind] ||
    !state.companies.some((c) => c.name === brand)
  )
    throw Error("Selecciona un cliente, una marca y una actividad.");
  if (!confirmed || reference.length < 3)
    throw Error(
      "Confirma la actividad e introduce una referencia de al menos 3 caracteres.",
    );
  if (
    state.activities.some((x) => x.brand === brand && x.reference === reference)
  )
    throw Error("Esta referencia ya fue acreditada para esta marca.");
  const award =
    kind === "Referido"
      ? state.accounts.find((x) => x.code === a.referredBy)
      : a;
  if (!award) throw Error("Este cliente no tiene un referido asociado.");
  if (
    kind === "Referido" &&
    state.activities.some(
      (x) =>
        x.kind === "Referido" && x.label === `Referido confirmado: ${a.id}`,
    )
  )
    throw Error("Este referido ya recibió su recompensa.");
  const rule = pointRule(state, brand, kind);
  const points = rule.points;
  const now = new Date();
  return {
    ...state,
    accounts: state.accounts.map((x) =>
      x.id === award.id
        ? { ...x, points: { ...x.points, [brand]: x.points[brand] + points } }
        : x,
    ),
    activities: [
      {
        id: id(),
        accountId: award.id,
        brand,
        label:
          kind === "Referido"
            ? `Referido confirmado: ${a.id}`
            : `${kind} confirmada · ${reference}`,
        points,
        date: now.toISOString(),
        expiresAt: new Date(
          now.getTime() + rule.expiryDays * 86400000,
        ).toISOString(),
        reference,
        kind,
      },
      ...state.activities,
    ],
  };
}
export const storageKey = "rideclub-demo-v1";
export function loadDemo(): Demo {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const s = JSON.parse(raw);
      const catalogRewards: Reward[] = Array.isArray(s.catalogRewards)
        ? s.catalogRewards
        : structuredClone(rewards);
      const companies: Company[] = (Array.isArray(s.companies)
        ? s.companies.map((company: Company) => ({
            ...company,
            pointRules: {
              ...defaultPointRules(),
              ...(company.pointRules ?? {}),
            },
          }))
        : initialCompanies()
      ).map((company: Company) => {
        const maintenance = catalogRewards.find(
          (reward) =>
            reward.brand === company.name && reward.kind === "service",
        );
        return maintenance
          ? {
              ...company,
              pointRules: {
                ...company.pointRules,
                Mantenimiento: {
                  ...company.pointRules.Mantenimiento,
                  points: maintenance.points,
                },
              },
            }
          : company;
      });
      if (
        s.version === 1 &&
        Array.isArray(s.accounts) &&
        Array.isArray(s.coupons) &&
        Array.isArray(s.activities) &&
        s.accounts.every(
          (a: Account) =>
            a.id &&
            a.wallet &&
            a.points &&
            Object.values(a.points).every(
              (p) => Number.isFinite(p) && p >= 0,
            ) &&
            Array.isArray(a.favorites) &&
            (a.balanceUSDT === undefined ||
              (Number.isFinite(a.balanceUSDT) && a.balanceUSDT >= 0)),
        )
      ) {
        return applyPointExpirations({
          ...s,
          companies,
          accounts: s.accounts.map((a: Account) => ({
            ...a,
            wallet: {
              status: "ready",
              chainId: 84532,
              address: a.wallet.address ?? mockWalletAddress(a.id || a.email),
            },
            brand: companies.some((c) => c.name === a.brand)
              ? a.brand
              : undefined,
            role:
              a.role === "admin"
                ? "admin"
                : a.role === "company" &&
                    companies.some((c) => c.id === a.companyId)
                  ? "company"
                  : "client",
            points: {
              ...Object.fromEntries(companies.map((c) => [c.name, 0])),
              ...a.points,
            },
            balanceUSDT:
              a.balanceUSDT === undefined ? demoFunding : a.balanceUSDT,
            status: a.status ?? "active",
          })),
          purchases: Array.isArray(s.purchases) ? s.purchases : [],
          catalogBikes: Array.isArray(s.catalogBikes)
            ? s.catalogBikes
            : structuredClone(bikes),
          audit: Array.isArray(s.audit) ? s.audit : [],
          catalogRewards,
        });
      }
    }
  } catch {
    /* Keep the demo usable if local storage is unavailable. */
  }
  return initialDemo();
}

/** Atomic simulated checkout. The operation ID makes retries safe. */
export function buy(
  state: Demo,
  ownerId: string,
  bikeId: string,
  operationId: string,
): { state: Demo; purchase: Purchase } {
  const existing = state.purchases.find(
    (p) => p.ownerId === ownerId && p.operationId === operationId,
  );
  if (existing) {
    if (existing.bikeId !== bikeId)
      throw Error("La operación ya pertenece a otra compra.");
    return { state, purchase: existing };
  }
  const account = state.accounts.find((a) => a.id === ownerId);
  const bike = state.catalogBikes.find((b) => b.id === bikeId && !b.archived);
  if (!account || account.role !== "client")
    throw Error("Inicia sesión como cliente para comprar en la demo.");
  if (
    bike &&
    !state.companies.some((c) => c.name === bike.brand && c.status === "active")
  )
    throw Error("Esta empresa no tiene permiso de publicación.");
  if (!bike?.price || !operationId.trim())
    throw Error("Este modelo necesita una cotización antes de comprar.");
  if (account.balanceUSDT < bike.price)
    throw Error("Saldo USDT de prueba insuficiente. Recarga desde Mi club.");
  const purchaseRule = pointRule(state, bike.brand, "Compra");
  const referralRule = pointRule(state, bike.brand, "Referido");
  const purchase: Purchase = {
    id: `DEMO-${id().toUpperCase()}`,
    ownerId,
    bikeId,
    brand: bike.brand,
    model: bike.name,
    amountUSDT: bike.price,
    points: purchaseRule.points,
    createdAt: new Date().toISOString(),
    operationId,
  };
  const inviter = state.accounts.find((a) => a.code === account.referredBy);
  const awardReferral =
    inviter &&
    !state.activities.some(
      (a) =>
        a.kind === "Referido" && a.label === `Referido confirmado: ${ownerId}`,
    );
  return {
    purchase,
    state: {
      ...state,
      accounts: state.accounts.map((a) =>
        a.id === ownerId
          ? {
              ...a,
              balanceUSDT:
                Math.round((a.balanceUSDT - bike.price!) * 100) / 100,
              points: {
                ...a.points,
                [bike.brand]: a.points[bike.brand] + purchase.points,
              },
            }
          : awardReferral && a.id === inviter.id
            ? {
                ...a,
                points: {
                  ...a.points,
                  [bike.brand]: a.points[bike.brand] + referralRule.points,
                },
              }
            : a,
      ),
      purchases: [purchase, ...state.purchases],
      activities: [
        {
          id: id(),
          accountId: ownerId,
          brand: bike.brand,
          label: `Compra demo: ${bike.brand} ${bike.name}`,
          points: purchase.points,
          date: purchase.createdAt,
          reference: purchase.id,
            kind: "Compra",
            expiresAt: new Date(
              new Date(purchase.createdAt).getTime() +
                purchaseRule.expiryDays * 86400000,
            ).toISOString(),
        },
        ...(awardReferral
          ? [
              {
                id: id(),
                accountId: inviter.id,
                brand: bike.brand,
                label: `Referido confirmado: ${ownerId}`,
                points: referralRule.points,
                date: purchase.createdAt,
                reference: purchase.id,
                kind: "Referido" as const,
                expiresAt: new Date(
                  new Date(purchase.createdAt).getTime() +
                    referralRule.expiryDays * 86400000,
                ).toISOString(),
              },
            ]
          : []),
        ...state.activities,
      ],
    },
  };
}
export function fundDemo(state: Demo, ownerId: string): Demo {
  if (!state.accounts.some((a) => a.id === ownerId))
    throw Error("Inicia sesión para recargar.");
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === ownerId ? { ...a, balanceUSDT: a.balanceUSDT + demoFunding } : a,
    ),
  };
}

export function linkBrand(state: Demo, ownerId: string, brand: Brand): Demo {
  if (
    state.currentId !== ownerId ||
    !state.accounts.some((a) => a.id === ownerId)
  )
    throw Error("Inicia sesión para vincular tu marca.");
  if (!state.companies.some((c) => c.name === brand && c.status === "active"))
    throw Error("Selecciona una marca activa válida.");
  return {
    ...state,
    accounts: state.accounts.map((a) =>
      a.id === ownerId ? { ...a, brand } : a,
    ),
  };
}
/** Public demo access only. Replace this with server-side authentication and authorization. */
export function enterAdminDemo(state: Demo): Demo {
  const existing = state.accounts.find((a) => a.id === "demo-admin");
  if (existing) return { ...state, currentId: existing.id };
  let code: string;
  do {
    code = String(
      10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000000),
    );
  } while (state.accounts.some((a) => a.code === code));
  const admin: Account = {
    ...structuredClone(seed),
    id: "demo-admin",
    name: "Administrador demo",
    email: "admin@rideclub.demo",
    role: "admin",
    brand: undefined,
    code,
    balanceUSDT: 0,
    points: { Zontes: 0, NIU: 0, Kiden: 0 },
    status: "active",
  };
  return {
    ...state,
    accounts: [...state.accounts, admin],
    currentId: admin.id,
  };
}
export function adminAction(state: Demo, action: (state: Demo) => Demo): Demo {
  if (state.accounts.find((a) => a.id === state.currentId)?.role !== "admin")
    throw Error("Esta operación requiere el rol de administrador de demo.");
  return action(state);
}
