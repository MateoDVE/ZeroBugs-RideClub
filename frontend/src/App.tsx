import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Gift,
  Menu,
  UserRound,
  X,
  Wrench,
  ShieldCheck,
  Bike as BikeIcon,
} from "lucide-react";
import {
  type Bike,
  type Brand,
  type Reward,
  type ActivityKind,
} from "./data/catalog";
import {
  linkBrand,
  enterAdminDemo,
  buy,
  fundDemo,
  id,
  type Purchase,
  credit,
  initialDemo,
  loadDemo,
  login,
  redeem,
  register,
  storageKey,
  useCoupon,
  type Account,
  type Coupon,
  type Demo,
} from "./lib/demo";
import { CatalogProvider } from "./data/CatalogContext";
import { manageBrand, readBusiness, saveClient } from "./lib/business";
import type { ClientImportOutcome, ClientImportRow } from "./lib/clientCsv";
import Dashboard from "./components/Dashboard";
import Marketplace, { BikeDetail } from "./components/Marketplace";
import Rewards, { RewardDetail } from "./components/Rewards";
import Club, { CouponDialog } from "./components/Club";
import Checkout from "./components/Checkout";
import Auth from "./components/Auth";
import Workshop from "./components/Workshop";
import Landing from "./components/Landing";
import { BrandLogo, Modal } from "./components/ui";
import { normalizePhone } from "./lib/phone";
import { supabaseClient, supabaseEnabled } from "./lib/supabase/client";
import {
  backendApi,
  importBackendClients,
  loadBackendState,
  logoutBackend,
  requestLogin,
  requestPasswordReset,
  requestRegistration,
  subscribeBackendChanges,
  syncBusinessMutation,
  updatePassword,
  type BackendRealtimeStatus,
} from "./lib/supabase/api";
type Page =
  | "inicio"
  | "marketplace"
  | "recompensas"
  | "club"
  | "taller"
  | "admin"
  | "empresa";
const getPage = (): Page => {
  const h = window.location.hash.slice(1);
  return ["inicio", "marketplace", "recompensas", "club", "taller", "admin", "empresa"].includes(h)
    ? (h as Page)
    : "inicio";
};
export default function App() {
  const [state, setState] = useState<Demo>(() => {
    if (!supabaseEnabled) return loadDemo();
    const publicState = initialDemo();
    return {
      ...publicState,
      accounts: [],
      currentId: null,
      coupons: [],
      activities: [],
      purchases: [],
      audit: [],
    };
  });
  const stateRef = useRef(state);
  const presentationCompanyRef = useRef<string | null>(null);
  const presentationClientRef = useRef<string | null>(null);
  const presentationAdminRef = useRef<string | null>(null);
  const storageSync = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const initialPageRef = useRef(true);
  stateRef.current = state;
  const [page, setPage] = useState<Page>(getPage);
  const [filter, setFilter] = useState<Brand | "Todas">("Todas");
  const [menu, setMenu] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "recovery">("register");
  const [checkout, setCheckout] = useState<{
    bike: Bike;
    operationId: string;
  }>();
  const [purchase, setPurchase] = useState<Purchase>();
  const [purchaseError, setPurchaseError] = useState("");
  const [auth, setAuth] = useState(false);
  const [created, setCreated] = useState<Account>();
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [bike, setBike] = useState<Bike>();
  const [reward, setReward] = useState<Reward>();
  const [rewardError, setRewardError] = useState("");
  const [rewardSubmitting, setRewardSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<Coupon>();
  const [workshopCode, setWorkshopCode] = useState("");
  const [toast, setToast] = useState("");
  const [info, setInfo] = useState(false);
  const [realtimeStatus, setRealtimeStatus] =
    useState<BackendRealtimeStatus>(supabaseEnabled ? "connecting" : "disconnected");
  const [backendAuthenticated, setBackendAuthenticated] = useState(false);
  const brands = state.companies
    .filter((c) => c.status === "active")
    .map((c) => c.name);
  const brandInfo = Object.fromEntries(state.companies.map((c) => [c.name, c]));
  const account = state.accounts.find((a) => a.id === state.currentId);
  const commit = (next: Demo) => {
    stateRef.current = next;
    setState(next);
  };
  const applyPresentationCompany = (next: Demo): Demo => {
    const companyId = presentationCompanyRef.current;
    if (!companyId) {
      const clientId = presentationClientRef.current;
      if (!clientId) return next;
      const client = next.accounts.find(
        (item) => item.id === clientId && item.role === "client" && item.status === "active",
      );
      if (!client) {
        presentationClientRef.current = null;
        return next;
      }
      return { ...next, currentId: client.id };
    }
    const company = next.companies.find((item) => item.id === companyId);
    if (!company) {
      presentationCompanyRef.current = null;
      return next;
    }
    const existing = next.accounts.find(
      (item) => item.role === "company" && item.companyId === company.id,
    );
    if (existing) return { ...next, currentId: existing.id };
    const preview: Account = {
      id: `presentation-${company.id}`,
      name: company.name,
      email: company.email,
      role: "company",
      companyId: company.id,
      brand: company.name,
      createdAt: company.createdAt,
      balanceUSDT: 0,
      code: "",
      wallet: {
        status: "ready",
        chainId: 84532,
        address: company.wallet.address,
      },
      points: Object.fromEntries(next.companies.map((item) => [item.name, 0])),
      favorites: [],
      status: "active",
    };
    return {
      ...next,
      accounts: [...next.accounts, preview],
      currentId: preview.id,
    };
  };
  const refreshBackend = async () => {
    const next = applyPresentationCompany(await loadBackendState());
    setBackendAuthenticated(Boolean(next.currentId));
    commit(next);
    return next;
  };
  const apply = (fn: (s: Demo) => Demo) => {
    try {
      commit(fn(stateRef.current));
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    }
  };
  useEffect(() => {
    if (supabaseEnabled) return;
    if (storageSync.current) {
      storageSync.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      setToast(
        "Tu navegador no permite guardar la demo. Los cambios durarán esta sesión.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (supabaseEnabled) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      const incoming = loadDemo();
      const currentId = incoming.accounts.some(
        (item) => item.id === stateRef.current.currentId,
      )
        ? stateRef.current.currentId
        : null;
      storageSync.current = true;
      commit({ ...incoming, currentId });
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!supabaseEnabled) return;
    let active = true;
    const authIntent = new URLSearchParams(window.location.search).get("auth");
    const passwordRecovery = authIntent === "recovery";
    const authCallback =
      authIntent === "callback" ||
      new URLSearchParams(window.location.hash.slice(1)).has("access_token");
    const callbackError = new URLSearchParams(
      window.location.hash.slice(1),
    ).get("error_description");
    if (callbackError) {
      setToast(callbackError.replace(/\+/g, " "));
    }
    const enterAuthenticatedArea = (next: Demo | undefined) => {
      if (!next?.currentId) return;
      const role = next.accounts.find(
        (item) => item.id === next.currentId,
      )?.role;
      navigate(
        role === "admin" ? "admin" : role === "company" ? "empresa" : "club",
      );
      setAuth(false);
      if (window.location.search) {
        window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
      }
    };
    const refresh = async () => {
      if (presentationClientRef.current) return stateRef.current;
      try {
        const next = applyPresentationCompany(await loadBackendState());
        if (active) commit(next);
        return next;
      } catch (error) {
        if (active) {
          setBackendAuthenticated(false);
          commit({ ...stateRef.current, currentId: null });
          setToast((error as Error).message);
        }
        return undefined;
      }
    };
    const { data } = supabaseClient().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && active) {
        setAuthMode("recovery");
        setAuth(true);
      }
      window.setTimeout(() => {
        void (async () => {
          // Supabase can emit SIGNED_IN again when a tab regains focus or the
          // session is refreshed. Updating the data must not move the user away
          // from Marketplace, Rewards, Workshop, or the page they chose.
          await refresh();
        })();
      }, 0);
    });
    void (async () => {
      const next = await refresh();
      // The SDK can finish restoring the callback session before the auth
      // listener subscribes. This fallback makes that successful session
      // deterministic instead of leaving the user on the login screen.
      if (!active) return;
      if (passwordRecovery) {
        setAuthMode(next?.currentId && !callbackError ? "recovery" : "login");
        if (!next?.currentId || callbackError) {
          setAuthError("El enlace de recuperación no es válido o ha vencido. Solicita uno nuevo.");
        }
        setAuth(true);
      } else if (authCallback) enterAuthenticatedArea(next);
    })();
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!supabaseEnabled) return;
    let refreshTimer: number | undefined;
    let stopped = false;
    const unsubscribe = subscribeBackendChanges(
      () => {
        // A purchase or redemption changes several tables in one transaction.
        // Group those notifications into one consistent backend snapshot.
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          if (stopped || presentationClientRef.current) return;
          void refreshBackend().catch((error) => {
            if (!stopped) setToast((error as Error).message);
          });
        }, 220);
      },
      (status) => {
        if (!stopped) setRealtimeStatus(status);
      },
      backendAuthenticated,
    );
    return () => {
      stopped = true;
      window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [backendAuthenticated]);
  useEffect(() => {
    const current = state.accounts.find((item) => item.id === state.currentId);
    if (
      current?.role === "client" &&
      current.status &&
      current.status !== "active"
    ) {
      commit({ ...stateRef.current, currentId: null });
      setToast(
        current.status === "blocked"
          ? "Tu cuenta está bloqueada temporalmente. Contacta a la empresa."
          : "Tu cuenta fue dada de baja y ya no puede iniciar sesión.",
      );
      navigate("inicio");
    }
  }, [state.currentId, state.accounts]);
  useEffect(() => {
    const listener = () => {
      setPage(getPage());
      setMenu(false);
    };
    window.addEventListener("hashchange", listener);
    if (
      new URLSearchParams(window.location.search).has("ref") &&
      !stateRef.current.currentId
    ) {
      setAuth(true);
    }
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (window.location.hash !== "#catalogo")
      window.scrollTo({ top: 0, behavior: "instant" });
    document.title = `RideClub — ${page === "inicio" ? "Motos, puntos y beneficios" : page === "marketplace" ? "Marketplace" : page === "club" ? "Mi club" : page === "taller" ? "Taller demo" : page === "recompensas" ? "Recompensas" : "Administración"}`;
    if (initialPageRef.current) {
      initialPageRef.current = false;
    } else {
      window.requestAnimationFrame(() => mainRef.current?.focus());
    }
  }, [page]);
  const staff = account?.role === "admin" || account?.role === "company";
  const demoClient = state.accounts.find(
    (item) => item.role === "client" && (item.status ?? "active") === "active",
  );
  const dashboardPage: Page = account?.role === "company" ? "empresa" : "admin";
  const dashboardProps = {
    state,
    realtimeStatus,
    onImportClients: async (
      rows: ClientImportRow[],
    ): Promise<ClientImportOutcome[]> => {
      const existingEmails = new Set(
        stateRef.current.accounts.map((item) => item.email.toLowerCase()),
      );
      if (supabaseEnabled) {
        const outcomes = await importBackendClients(rows, existingEmails);
        await refreshBackend();
        return outcomes;
      }
      let next = stateRef.current;
      const outcomes: ClientImportOutcome[] = [];
      for (const row of rows) {
        const existing = next.accounts.find(
          (item) => item.role === "client" && item.email.toLowerCase() === row.email,
        );
        try {
          next = saveClient(
            next,
            {
              name: row.name,
              email: row.email,
              phone: row.phone,
              brand: row.companyName,
              status: row.status,
            },
            existing?.id,
          );
          outcomes.push({
            ...row,
            result: existing ? "updated" : "created",
          });
        } catch (error) {
          outcomes.push({
            ...row,
            result: "error",
            message: (error as Error).message,
          });
        }
      }
      commit(next);
      return outcomes;
    },
    onMutation: async (fn: (s: Demo) => Demo): Promise<string | null> => {
      try {
        const before = stateRef.current;
        const next = fn(before);
        commit(next);
        if (supabaseEnabled && !presentationClientRef.current) {
          await syncBusinessMutation(before, next);
          await refreshBackend();
        }
        return null;
      } catch (e) {
        if (supabaseEnabled && !presentationClientRef.current) {
          try {
            await refreshBackend();
          } catch {
            /* Keep the last usable snapshot while reporting the original error. */
          }
        }
        return (e as Error).message;
      }
    },
    onLogout: async () => {
      try {
        if (
          supabaseEnabled &&
          (presentationCompanyRef.current || presentationClientRef.current)
        ) {
          presentationCompanyRef.current = null;
          presentationClientRef.current = null;
          const adminId = presentationAdminRef.current;
          presentationAdminRef.current = null;
          commit({ ...stateRef.current, currentId: adminId });
          navigate("admin");
          setToast("Volviste a la administración global.");
          return;
        }
        if (supabaseEnabled) await logoutBackend();
        commit({ ...stateRef.current, currentId: null });
        navigate("inicio");
      } catch (error) {
        setToast((error as Error).message);
      }
    },
    onWorkshop: () => navigate("taller"),
  };
  const enterCompanyPresentation = (companyId: string) => {
    const company = stateRef.current.companies.find(
      (item) => item.id === companyId && item.status === "active",
    );
    if (!company) {
      setToast("Esta empresa no está activa para la presentación.");
      return;
    }
    const admin = stateRef.current.accounts.find(
      (item) => item.id === stateRef.current.currentId && item.role === "admin",
    ) ?? stateRef.current.accounts.find((item) => item.role === "admin");
    if (!admin) {
      setToast("Inicia sesión como administrador para usar el modo presentación.");
      return;
    }
    presentationAdminRef.current = admin.id;
    presentationCompanyRef.current = company.id;
    const next = applyPresentationCompany(stateRef.current);
    commit(next);
    navigate("empresa");
    setToast(`Vista de ${company.name} activada sin correo.`);
  };
  const enterClientPresentation = (clientId: string) => {
    const client = stateRef.current.accounts.find(
      (item) =>
        item.id === clientId &&
        item.role === "client" &&
        (item.status ?? "active") === "active",
    );
    const admin = stateRef.current.accounts.find(
      (item) => item.id === stateRef.current.currentId && item.role === "admin",
    ) ?? stateRef.current.accounts.find((item) => item.role === "admin");
    if (!client || !admin) {
      setToast("Importa un cliente activo e inicia sesión como administrador.");
      return;
    }
    presentationAdminRef.current = admin.id;
    presentationCompanyRef.current = null;
    presentationClientRef.current = client.id;
    commit({ ...stateRef.current, currentId: client.id });
    navigate("club");
    setToast(`Sandbox de ${client.name} activado. No usa correos ni fondos reales.`);
  };
  const exitCompanyPresentation = () => {
    if (!presentationCompanyRef.current && !presentationClientRef.current) {
      navigate("admin");
      return;
    }
    presentationCompanyRef.current = null;
    presentationClientRef.current = null;
    const adminId = presentationAdminRef.current;
    presentationAdminRef.current = null;
    commit({ ...stateRef.current, currentId: adminId });
    navigate("admin");
    setToast("Vista de administrador restaurada.");
    if (supabaseEnabled) {
      void refreshBackend().catch((error) => setToast((error as Error).message));
    }
  };
  const workshopState =
    account?.role === "company"
      ? (() => {
          const view = readBusiness(state);
          return {
            ...state,
            accounts: state.accounts.filter(
              (a) =>
                a.id === account.id || view.clients.some((c) => c.id === a.id),
            ),
            companies: view.companies,
            purchases: view.purchases,
            coupons: view.coupons,
            activities: view.activities,
            catalogBikes: view.bikes,
            catalogRewards: view.rewards,
          };
        })()
      : state;
  useEffect(() => {
    if (filter !== "Todas" && !brands.includes(filter)) setFilter("Todas");
  }, [state.companies, filter]);
  function navigate(p: Page) {
    setPage(p);
    window.location.hash = p;
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openAuth(mode: "login" | "register" = "register") {
    setAuthMode(mode);
    setAuthError("");
    setAuthNotice("");
    setCreated(undefined);
    setReward(undefined);
    setBike(undefined);
    setAuth(true);
    setMenu(false);
  }
  function openReward(r: Reward) {
    setRewardError("");
    setReward(r);
  }
  async function confirmReward() {
    if (!reward || !account || rewardSubmitting) return;
    setRewardSubmitting(true);
    try {
      if (supabaseEnabled && !presentationClientRef.current) {
        const redeemed = (await backendApi.redeem(reward.id)) as {
          code: string;
        };
        const next = await refreshBackend();
        setReward(undefined);
        setCoupon(next.coupons.find((item) => item.id === redeemed.code));
        setToast("Tu cupón está listo. El saldo de puntos se actualizó.");
        return;
      }
      const result = redeem(stateRef.current, account.id, reward);
      commit(result.state);
      setReward(undefined);
      setCoupon(result.coupon);
      setToast("Tu cupón está listo. El saldo de puntos se actualizó.");
    } catch (e) {
      const message = (e as Error).message;
      if (supabaseEnabled && !presentationClientRef.current) {
        try {
          await refreshBackend();
        } catch {
          /* The original redemption error is more useful to the customer. */
        }
      }
      setRewardError(
        message.includes("point_balances_balance_check")
          ? "Tu saldo cambió durante el canje. Ya actualizamos los puntos disponibles; vuelve a revisarlos."
          : message,
      );
    } finally {
      setRewardSubmitting(false);
    }
  }
  function copy(text: string) {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() =>
          setToast("Copiado. Compártelo con tu próximo compañero de ruta."),
        )
        .catch(() => setToast(`Copia este dato: ${text}`));
    } else setToast(`Copia este dato: ${text}`);
  }
  function exportCSV() {
    if (
      !["admin", "company"].includes(
        stateRef.current.accounts.find(
          (a) => a.id === stateRef.current.currentId,
        )?.role ?? "",
      )
    ) {
      setToast("Esta operación requiere el rol de administrador de demo.");
      return;
    }
    const view = readBusiness(stateRef.current);
    const cell = (v: string | number) =>
      `"${String(v)
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""')}"`;
    const rows = [
      [
        "Cliente",
        "Correo",
        "Actividad",
        "Marca",
        "Puntos",
        "Fecha",
        "Referencia",
      ],
      ...view.activities.map((a) => {
        const user = view.clients.find((x) => x.id === a.accountId);
        return [
          user?.name ?? "",
          user?.email ?? "",
          a.label,
          a.brand,
          a.points,
          a.date,
          a.reference ?? "",
        ];
      }),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "rideclub-actividad-demo.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("Reporte de la demo exportado.");
  }
  const onFavorite = (id: string) => {
    if (!account) {
      openAuth();
      return;
    }
    const selected = !account.favorites.includes(id);
    if (supabaseEnabled && !presentationClientRef.current) {
      void (async () => {
        try {
          await backendApi.favorite(account.id, id, selected);
          await refreshBackend();
        } catch (error) {
          setToast((error as Error).message);
        }
      })();
      return;
    }
    apply((s) => ({
      ...s,
      accounts: s.accounts.map((a) =>
        a.id === account.id
          ? {
              ...a,
              favorites: a.favorites.includes(id)
                ? a.favorites.filter((x) => x !== id)
                : [...a.favorites, id],
            }
          : a,
      ),
    }));
  };
  const rewardNavigate = (b?: Brand) => {
    if (b) setFilter(b);
    else setFilter("Todas");
    navigate("recompensas");
  };
  return (
    <CatalogProvider state={state}>
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <div className="topbar">
        <span>RIDE MORE. GET MORE.</span>
        <button onClick={() => setInfo(true)}>
          Cada compra, una nueva recompensa.
          <ChevronRight size={13} />
        </button>
        <span>BOLIVIA / EDICIÓN DEMO</span>
      </div>
      <header className="site-header">
        <a
          className="wordmark"
          href="#inicio"
          onClick={() => navigate("inicio")}
          aria-label="RideClub inicio"
        >
          <span className="brand-symbol">
            R<span />
          </span>
          ride<span>club</span>
          <span className="wordmark-dot">®</span>
        </a>
        <nav className={menu ? "open" : ""} aria-label="Navegación principal">
          {[
            ["inicio", "Inicio"],
            ["marketplace", "Marketplace"],
            ["recompensas", "Recompensas"],
            ...(!staff
              ? [["club", "Mi club"]]
              : [
                  [
                    dashboardPage,
                    account?.role === "admin" ? "Administración" : "Mi empresa",
                  ],
                ]),
          ].map(([p, label]) => (
            <button
              key={p}
              className={page === p ? "active" : ""}
              aria-current={page === p ? "page" : undefined}
              onClick={() => navigate(p as Page)}
            >
              {label}
              {page === p && <span />}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="account-button"
            onClick={
              account
                ? () => navigate(staff ? dashboardPage : "club")
                : () => openAuth("login")
            }
          >
            <UserRound size={18} />
            <span>
              {account ? account.name.split(" ")[0] : "Iniciar sesión"}
            </span>
            <ArrowUpRight size={16} />
          </button>
          <button
            className="mobile-menu icon-button"
            aria-expanded={menu}
            aria-label={menu ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {supabaseEnabled &&
        (account?.role === "admin" ||
          presentationCompanyRef.current ||
          presentationClientRef.current) && (
          <div className="presentation-switcher" role="navigation" aria-label="Modo presentación">
            <span><ShieldCheck size={15} /> MODO PRESENTACIÓN</span>
            <button
              className={
                !presentationCompanyRef.current && !presentationClientRef.current
                  ? "active"
                  : ""
              }
              onClick={exitCompanyPresentation}
            >
              Administrador
            </button>
            {state.companies
              .filter((company) => company.status === "active")
              .map((company) => (
                <button
                  key={company.id}
                  className={presentationCompanyRef.current === company.id ? "active" : ""}
                  onClick={() => enterCompanyPresentation(company.id)}
                >
                  <BrandLogo brand={company.name} />
                  {company.name}
                </button>
              ))}
            {demoClient && (
              <button
                className={
                  presentationClientRef.current &&
                  !presentationCompanyRef.current
                    ? "active"
                    : ""
                }
                onClick={() => enterClientPresentation(demoClient.id)}
              >
                <UserRound size={14} /> Cliente demo · {demoClient.name.split(" ")[0]}
              </button>
            )}
            <small>
              {presentationClientRef.current
                ? "Sandbox local · compras y canjes no afectan Supabase"
                : "Acceso visual sin correo · sesión segura del administrador"}
            </small>
          </div>
        )}
      <main id="main" ref={mainRef} tabIndex={-1}>
        {page === "inicio" && (
          <Landing
            onMarketplace={() => {
              setFilter("Todas");
              navigate("marketplace");
            }}
            onRewards={() => {
              setFilter("Todas");
              navigate("recompensas");
            }}
            onJoin={() =>
              account
                ? navigate(staff ? dashboardPage : "club")
                : openAuth("register")
            }
            onBrand={(selectedBrand, destination) => {
              setFilter(selectedBrand);
              navigate(destination === "marketplace" ? "marketplace" : "recompensas");
            }}
          />
        )}
        {page === "marketplace" && (
          <Marketplace
            filter={filter}
            setFilter={setFilter}
            favorites={account?.favorites ?? []}
            onFavorite={onFavorite}
            onBike={setBike}
            onRewards={() => rewardNavigate()}
            onJoin={account ? () => navigate("club") : () => openAuth()}
          />
        )}
        {page === "recompensas" && (
          <Rewards
            filter={filter}
            setFilter={setFilter}
            account={account?.role === "client" ? account : undefined}
            staffMode={staff}
            coupons={state.coupons}
            onSelect={openReward}
            onJoin={() =>
              staff ? navigate(dashboardPage) : openAuth("register")
            }
          />
        )}
        {page === "club" && staff && (
          <Dashboard key={account.id} {...dashboardProps} />
        )}
        {page === "club" && !staff && (
          <Club
            account={account}
            state={state}
            onJoin={openAuth}
            onLogout={() => {
              void (async () => {
                try {
                  if (supabaseEnabled && presentationClientRef.current) {
                    exitCompanyPresentation();
                    return;
                  }
                  if (supabaseEnabled) await logoutBackend();
                  commit({ ...stateRef.current, currentId: null });
                  setToast("Cerraste sesión correctamente.");
                  navigate("inicio");
                } catch (error) {
                  setToast((error as Error).message);
                }
              })();
            }}
            onRewards={() => rewardNavigate()}
            onCoupon={setCoupon}
            onFavorite={onFavorite}
            onBike={setBike}
            onCopy={copy}
            onBrand={rewardNavigate}
            onLinkBrand={(b) => {
              if (supabaseEnabled && !presentationClientRef.current) {
                const company = stateRef.current.companies.find(
                  (item) => item.name === b,
                );
                if (!company) return;
                void (async () => {
                  try {
                    await backendApi.updateProfile(
                      account!.name,
                      account!.phone,
                      company.id,
                    );
                    await refreshBackend();
                    setToast(`Tu perfil está vinculado a ${b}.`);
                  } catch (error) {
                    setToast((error as Error).message);
                  }
                })();
                return;
              }
              if (apply((s) => linkBrand(s, account!.id, b)))
                setToast(`Tu perfil está vinculado a ${b}.`);
            }}
            onFund={() => {
              if (supabaseEnabled && !presentationClientRef.current) {
                void (async () => {
                  try {
                    await backendApi.fund();
                    await refreshBackend();
                    setToast("Se añadieron 20.000 USDT de prueba a tu saldo.");
                  } catch (error) {
                    setToast((error as Error).message);
                  }
                })();
                return;
              }
              if (apply((s) => fundDemo(s, account!.id)))
                setToast("Se añadieron 20.000 USDT de prueba a tu saldo.");
            }}
          />
        )}
        {(page === "admin" || page === "empresa") &&
          ((page === "admin" && account?.role === "admin") ||
          (page === "empresa" && account?.role === "company") ? (
            <Dashboard key={account.id} {...dashboardProps} />
          ) : (
            <section className="page-section admin-access">
              <ShieldCheck size={35} />
              <span className="eyebrow">
                {page === "admin"
                  ? "ADMINISTRACIÓN GLOBAL"
                  : "ACCESO DE EMPRESAS"}
              </span>
              <h1>
                {page === "admin"
                  ? "El club, en tus manos."
                  : "Tu empresa, en un solo lugar."}
              </h1>
              <p>
                {page === "admin"
                  ? "Este panel requiere el rol de administrador de RideClub."
                  : "Ingresa con el correo que el administrador asignó a tu empresa para consultar su dashboard."}
              </p>
              {account?.role === "company" ? (
                <button
                  className="button primary"
                  onClick={() => navigate("empresa")}
                >
                  Volver a mi empresa
                </button>
              ) : page === "admin" && !supabaseEnabled ? (
                <button
                  className="button primary"
                  onClick={() => {
                    commit(enterAdminDemo(stateRef.current));
                    navigate("admin");
                  }}
                >
                  Entrar como administrador demo
                </button>
              ) : (
                <button
                  className="button primary"
                  onClick={() => openAuth("login")}
                >
                  Iniciar sesión de empresa
                </button>
              )}
            </section>
          ))}
        {page === "taller" &&
          (staff ? (
            <Workshop
              key={workshopCode}
              state={workshopState}
              companyBrand={
                account?.role === "company" ? account.brand : undefined
              }
              couponCode={workshopCode}
              onCredit={async (a, b, k, r, c) => {
                if (supabaseEnabled && !presentationClientRef.current) {
                  try {
                    const company = stateRef.current.companies.find(
                      (item) => item.name === b,
                    );
                    if (!company) throw Error("La empresa no existe.");
                    await backendApi.credit(a, company.id, k, r, c);
                    await refreshBackend();
                    return true;
                  } catch (error) {
                    setToast((error as Error).message);
                    return false;
                  }
                }
                return apply((s) => {
                  manageBrand(s, b);
                  if (
                    s.accounts.find((x) => x.id === s.currentId)?.role ===
                      "company" &&
                    !readBusiness(s).clients.some((x) => x.id === a)
                  )
                    throw Error(
                      "Este cliente no pertenece al ámbito de tu empresa.",
                    );
                  return credit(s, a, b, k, r, c);
                });
              }}
              onUse={async (couponId, b, c, w) => {
                if (supabaseEnabled && !presentationClientRef.current) {
                  try {
                    await backendApi.useCoupon(couponId, w, c);
                    await refreshBackend();
                    return true;
                  } catch (error) {
                    setToast((error as Error).message);
                    return false;
                  }
                }
                return apply((s) => {
                  manageBrand(s, b);
                  return useCoupon(s, couponId, b, c, w);
                });
              }}
              onExport={exportCSV}
            />
          ) : (
            <section className="page-section admin-access">
              <Wrench size={35} />
              <span className="eyebrow">ACCESO OPERATIVO</span>
              <h1>Gestiona la operación del club.</h1>
              <p>
                La validación de beneficios y la acreditación de puntos
                corresponden a empresas y administradores autorizados.
              </p>
              <button
                className="button primary"
                onClick={() => openAuth("login")}
              >
                Iniciar sesión <ChevronRight size={18} />
              </button>
              <p className="fine-print">
                {supabaseEnabled
                  ? "El acceso requiere una cuenta activa con rol de empresa o administrador. Los permisos se validan nuevamente en el servidor."
                  : "En modo local puedes usar la cuenta administradora de prueba. Tus datos de cliente se conservan y puedes volver ingresando con su correo."}
              </p>
            </section>
          ))}
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <a className="wordmark" href="#marketplace">
              <span className="brand-symbol">
                R<span />
              </span>
              ride<span>club</span>
              <span className="wordmark-dot">®</span>
            </a>
            <p>
              Cada compra, una nueva recompensa.
              <br />
              Para los que siempre quieren seguir rodando.
            </p>
          </div>
          <div className="footer-brands">
            {brands.map((b) => (
              <a
                key={b}
                href={brandInfo[b].url || "#catalogo"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Sitio ${b}`}
              >
                <BrandLogo brand={b} />
                <ArrowUpRight size={14} />
              </a>
            ))}
          </div>
          <button
            className="footer-join"
            onClick={account ? () => navigate("club") : () => openAuth()}
          >
            Nos vemos en el camino.
            <strong>
              {account ? "Volver a mi club" : "Únete al club"}
              <ArrowUpRight size={20} />
            </strong>
          </button>
        </div>
        <div className="footer-bottom">
          <span>© 2026 RideClub · Prototipo para Hackathon By Paseo</span>
          <button onClick={() => setInfo(true)}>
            Sobre la demo y sus fuentes
            <ArrowUpRight size={13} />
          </button>
          <span>
            {supabaseEnabled
              ? "Backend conectado · próxima integración: Base Sepolia"
              : "Modo local · configura Supabase para persistencia compartida"}
          </span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Cerrar aviso">
            <X size={17} />
          </button>
        </div>
      )}
      {bike && (
        <BikeDetail
          bike={bike}
          onClose={() => setBike(undefined)}
          onBuy={(b) => {
            setBike(undefined);
            if (!account || account.role !== "client") {
              openAuth("login");
              return;
            }
            setPurchase(undefined);
            setPurchaseError("");
            setCheckout({ bike: b, operationId: id() });
          }}
          onReward={(b) => {
            setBike(undefined);
            rewardNavigate(b);
          }}
        />
      )}
      {checkout && account && (
        <Checkout
          bike={checkout.bike}
          account={account}
          purchase={purchase}
          error={purchaseError}
          onClose={() => setCheckout(undefined)}
          onClub={() => {
            setCheckout(undefined);
            navigate("club");
          }}
          onConfirm={() => {
            if (supabaseEnabled && !presentationClientRef.current) {
              void (async () => {
                try {
                  await backendApi.purchase(
                    checkout.bike.id,
                    checkout.operationId,
                  );
                  const next = await refreshBackend();
                  setPurchase(
                    next.purchases.find(
                      (item) => item.operationId === checkout.operationId,
                    ),
                  );
                  setPurchaseError("");
                } catch (error) {
                  setPurchaseError((error as Error).message);
                }
              })();
              return;
            }
            try {
              const result = buy(
                stateRef.current,
                account.id,
                checkout.bike.id,
                checkout.operationId,
              );
              commit(result.state);
              setPurchase(result.purchase);
              setPurchaseError("");
            } catch (e) {
              setPurchaseError((e as Error).message);
            }
          }}
        />
      )}
      {reward && (
        <RewardDetail
          reward={reward}
          account={account?.role === "client" ? account : undefined}
          onClose={() => setReward(undefined)}
          onConfirm={confirmReward}
          onJoin={() =>
            staff ? navigate(dashboardPage) : openAuth("register")
          }
          error={rewardError}
          submitting={rewardSubmitting}
        />
      )}
      {coupon && (
        <CouponDialog
          coupon={state.coupons.find((c) => c.id === coupon.id) ?? coupon}
          onClose={() => setCoupon(undefined)}
          onWorkshop={(c) => {
            setCoupon(undefined);
            setWorkshopCode(c.id);
            navigate("taller");
          }}
        />
      )}
      {auth && (
        <Auth
          initialMode={authMode}
          backendMode={supabaseEnabled}
          onClose={() => {
            setAuth(false);
            if (created) navigate("club");
          }}
          created={created}
          error={authError}
          notice={authNotice}
          onRegister={async (n, e, phone, c, b, password) => {
            try {
              if (supabaseEnabled) {
                await requestRegistration({
                  name: n,
                  email: e,
                  phone: normalizePhone(phone),
                  brand: b,
                  referralCode: c,
                  password,
                });
                setAuthNotice(
                  "Revisa tu correo y confirma la cuenta una sola vez. Después podrás iniciar sesión con tu correo y contraseña.",
                );
                setAuthError("");
                return;
              }
              const next = register(stateRef.current, n, e, phone, c, b);
              commit(next);
              setCreated(next.accounts.find((a) => a.id === next.currentId));
              setAuthError("");
            } catch (e) {
              setAuthError((e as Error).message);
            }
          }}
          onLogin={async (e, password) => {
            try {
              if (supabaseEnabled) {
                await requestLogin(e, password);
                const next = await refreshBackend();
                const role = next.accounts.find(
                  (item) => item.id === next.currentId,
                )?.role;
                setAuth(false);
                navigate(
                  role === "company"
                    ? "empresa"
                    : role === "admin"
                      ? "admin"
                      : "club",
                );
                setAuthNotice("");
                setAuthError("");
                return;
              }
              const next = login(stateRef.current, e);
              commit(next);
              setAuth(false);
              const role = next.accounts.find(
                (a) => a.id === next.currentId,
              )?.role;
              navigate(
                role === "company"
                  ? "empresa"
                  : role === "admin"
                    ? "admin"
                    : "club",
              );
            } catch (e) {
              setAuthError((e as Error).message);
            }
          }}
          onRecover={async (e) => {
            try {
              await requestPasswordReset(e);
              setAuthNotice(
                "Te enviamos un enlace de un solo uso para crear tu contraseña.",
              );
              setAuthError("");
            } catch (error) {
              setAuthError((error as Error).message);
            }
          }}
          onUpdatePassword={async (password) => {
            try {
              await updatePassword(password);
              const next = await refreshBackend();
              const role = next.accounts.find(
                (item) => item.id === next.currentId,
              )?.role;
              setAuth(false);
              setAuthNotice("");
              setAuthError("");
              window.history.replaceState({}, "", `${window.location.pathname}#${role === "company" ? "empresa" : role === "admin" ? "admin" : "club"}`);
              navigate(role === "company" ? "empresa" : role === "admin" ? "admin" : "club");
            } catch (error) {
              setAuthError((error as Error).message);
            }
          }}
          onAdminDemo={() => {
            commit(enterAdminDemo(stateRef.current));
            setAuth(false);
            navigate("admin");
          }}
          onDemo={() => {
            try {
              commit(login(stateRef.current, "manuel@rideclub.demo"));
              setAuth(false);
              navigate("club");
            } catch (e) {
              setAuthError((e as Error).message);
            }
          }}
        />
      )}
      {info && (
        <Modal
          title="Una demo para seguir rodando"
          onClose={() => setInfo(false)}
        >
          <div className="info-icons">
            <BikeIcon />
            <Gift />
            <UserRound />
          </div>
          <p>
            RideClub conecta un marketplace de motos con puntos por marca,
            referidos y cupones de beneficios.
          </p>
          <h4>Catálogos consultados</h4>
          <ul className="source-list">
            <li>
              <a
                href="https://zontesbolivia.com/motos/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Zontes Bolivia · modelos y precios
              </a>
            </li>
            <li>
              <a
                href="https://niubolivia.com/catalogo/"
                target="_blank"
                rel="noopener noreferrer"
              >
                NIU Bolivia · modelos y precios
              </a>
            </li>
            <li>
              <a
                href="https://motofun.com.ar/kiden/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Kiden · MotoFun Argentina
              </a>
            </li>
            <li>
              <a
                href="https://m.kiden.cn/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Kiden · catálogo oficial internacional
              </a>
            </li>
          </ul>
          <p className="fine-print">
            Referencias consultadas el 3 de octubre de 2026. Disponibilidad y
            precios deben confirmarse con el distribuidor. Las marcas conservan
            sus derechos; este prototipo no implica aprobación comercial.
          </p>
          <h4>Qué puedes probar</h4>
          <p className="fine-print">
            {supabaseEnabled
              ? "Registro verificado por correo, celular y marca vinculada, referido de 8 dígitos, compras con USDT de prueba, favoritas, puntos por marca, canje con QR, dashboards y validación de un solo uso. Las cuentas nuevas empiezan con cero puntos y 20.000 USDT ficticios."
              : "Registro local por correo, celular y marca vinculada, referido de 8 dígitos, compras con USDT de prueba, favoritas, puntos por marca, canje con QR y validación de un solo uso. La demo de Manuel empieza con 1.000 puntos Zontes; las cuentas nuevas empiezan con cero puntos y 20.000 USDT ficticios."}
          </p>
          <h4>Siguiente etapa</h4>
          <p className="fine-print">
            {supabaseEnabled
              ? "La autenticación por correo y el backend persistente ya están conectados. La siguiente etapa es crear las wallets EVM y los contratos en Base Sepolia; todavía no se crean tokens ni NFTs reales."
              : "El proyecto conserva un modo local para presentar la interfaz. Al configurar Supabase habilita autenticación por correo, persistencia compartida y seguridad por roles. La blockchain se implementará después."}
          </p>
          {!supabaseEnabled && (
            <button
              className="button secondary full"
              onClick={() => {
                commit(initialDemo());
                setInfo(false);
                setToast(
                  "Demo reiniciada. Las cuentas, canjes y actividades locales volvieron al estado inicial.",
                );
              }}
            >
              Reiniciar datos de esta demo
            </button>
          )}
        </Modal>
      )}
    </CatalogProvider>
  );
}
