import {
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  Users,
  ShoppingBag,
  Bike as BikeIcon,
  Gift,
  Ticket,
  Wallet,
  Activity,
  Download,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  LogOut,
  Wrench,
  ShieldCheck,
  Search,
  Check,
  Copy,
  Settings2,
  UserPlus,
  TrendingUp,
  CalendarClock,
  FileUp,
  FileSpreadsheet,
} from "lucide-react";
import type {
  Account,
  Company,
  Demo,
  PointRuleSet,
} from "../lib/demo";
import type { BackendRealtimeStatus } from "../lib/supabase/api";
import type { Bike, Reward } from "../data/catalog";
import {
  archiveItem,
  readBusiness,
  saveClient,
  saveBike,
  saveCompany,
  savePointRules,
  saveReward,
  saveWallet,
  trendSeries,
  type BikeDraft,
  type ClientDraft,
  type CompanyDraft,
  type RewardDraft,
  type BusinessView,
} from "../lib/business";
import { BrandLogo, date, fmt, Modal } from "./ui";
import {
  clientCsvTemplate,
  parseClientCsv,
  type ClientImportOutcome,
  type ClientImportParseResult,
  type ClientImportRow,
} from "../lib/clientCsv";
type Tab =
  | "overview"
  | "companies"
  | "clients"
  | "rules"
  | "purchases"
  | "bikes"
  | "rewards"
  | "coupons"
  | "wallets"
  | "activity";
type SaveResult = Promise<string | null>;
type Mutation = (change: (s: Demo) => Demo) => SaveResult;
type Editor =
  | { kind: "company"; item?: Company }
  | { kind: "client"; item?: Account }
  | { kind: "rules"; item: Company }
  | { kind: "bike"; item?: Bike }
  | { kind: "reward"; item?: Reward }
  | { kind: "wallet"; item: Company }
  | { kind: "delete"; item: Bike | Reward; type: "bike" | "reward" };
const tabs = [
  ["overview", "Resumen", BarChart3],
  ["companies", "Empresas", Building2],
  ["clients", "Clientes", Users],
  ["rules", "Puntos y canjes", Settings2],
  ["purchases", "Compras", ShoppingBag],
  ["bikes", "Motos", BikeIcon],
  ["rewards", "Recompensas", Gift],
  ["coupons", "Canjes", Ticket],
  ["wallets", "Wallets", Wallet],
  ["activity", "Actividad", Activity],
] as const;
const pointRuleLabels: Record<keyof PointRuleSet, string> = {
  Compra: "Compra de moto (automática)",
  Mantenimiento: "Mantenimiento (conectado al canje)",
  Referido: "Referido confirmado",
  Evento: "Asistencia a evento",
};
export default function Dashboard({
  state,
  realtimeStatus,
  onMutation,
  onImportClients,
  onLogout,
  onWorkshop,
}: {
  state: Demo;
  realtimeStatus: BackendRealtimeStatus;
  onMutation: Mutation;
  onImportClients: (rows: ClientImportRow[]) => Promise<ClientImportOutcome[]>;
  onLogout: () => void;
  onWorkshop: () => void;
}) {
  const current = state.accounts.find((a) => a.id === state.currentId)!;
  const global = current.role === "admin";
  const own = state.companies.find((c) => c.id === current.companyId);
  const [tab, setTab] = useState<Tab>("overview");
  const [brand, setBrand] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [customer, setCustomer] = useState<Account>();
  const [message, setMessage] = useState("");
  const [clientImport, setClientImport] = useState(false);
  const view = readBusiness(state, global ? brand || undefined : own?.name, {
    from,
    to,
  });
  const m = view.metrics;
  const companies = global ? state.companies : own ? [own] : [];
  const writable = global || own?.status !== "suspended";
  const themedCompany = own ?? state.companies.find((c) => c.name === brand);
  const themeStyle = themedCompany
    ? ({ "--company-accent": themedCompany.color } as CSSProperties)
    : undefined;
  const matches = (value: string) =>
    value.toLowerCase().includes(search.toLowerCase());
  async function mutate(fn: (s: Demo) => Demo) {
    const error = await onMutation(fn);
    if (!error) {
      setEditor(undefined);
      setMessage(
        "Cambios guardados. El catálogo y los indicadores se actualizaron.",
      );
    }
    return error;
  }
  async function changePermissions(company: Company, status: Company["status"]) {
    const error = await mutate((s) =>
      saveCompany(
        s,
        { ...company, status, walletAddress: company.wallet.address },
        company.id,
      ),
    );
    if (error) setMessage(error);
  }
  async function restore(type: "bike" | "reward", itemId: string) {
    const error = await mutate((s) => archiveItem(s, type, itemId, false));
    if (error) setMessage(error);
  }
  function exportCSV() {
    let rows: (string | number)[][];
    const name = (id: string) =>
      view.clients.find((a) => a.id === id)?.name ?? "Cliente";
    if (tab === "clients")
      rows = [
        [
          "Cliente",
          "Correo",
          "Celular",
          "Marca del perfil",
          "Motos",
          "USDT demo",
          "Puntos canjeados",
        ],
        ...view.clients.map((a) => [
          a.name,
          a.email,
          a.phone ?? "",
          a.brand ?? "",
          view.purchases.filter((p) => p.ownerId === a.id).length,
          view.purchases
            .filter((p) => p.ownerId === a.id)
            .reduce((n, p) => n + p.amountUSDT, 0),
          view.coupons
            .filter((p) => p.ownerId === a.id)
            .reduce((n, p) => n + p.points, 0),
        ]),
      ];
    else if (tab === "coupons")
      rows = [
        [
          "Código",
          "Cliente",
          "Empresa",
          "Beneficio",
          "Puntos",
          "Emitido",
          "Vence",
          "Uso",
          "Taller",
        ],
        ...view.coupons.map((c) => [
          c.id,
          name(c.ownerId),
          c.brand,
          c.title,
          c.points,
          c.issuedAt,
          c.expiresAt,
          c.usedAt ?? "",
          c.workshop ?? "",
        ]),
      ];
    else if (tab === "companies" || tab === "overview")
      rows = [
        [
          "Empresa",
          "Estado",
          "Registrados",
          "Compradores",
          "Motos vendidas",
          "Ventas USDT demo",
          "Puntos canjeados",
          "Canjes",
        ],
        ...view.companies.map((c) => {
          const stats = readBusiness(state, c.name, { from, to }).metrics;
          return [
            c.name,
            c.status,
            stats.registered,
            stats.buyers,
            stats.units,
            stats.sales,
            stats.spentPoints,
            stats.redemptions,
          ];
        }),
      ];
    else if (tab === "bikes")
      rows = [
        ["Empresa", "Modelo", "Precio USDT", "Estado"],
        ...view.bikes.map((b) => [
          b.brand,
          b.name,
          b.price ?? "Cotización",
          b.archived ? "Retirado" : "Publicado",
        ]),
      ];
    else if (tab === "rewards")
      rows = [
        ["Empresa", "Beneficio", "Puntos", "Vigencia", "Cupos", "Estado"],
        ...view.rewards.map((r) => [
          r.brand,
          r.title,
          r.points,
          r.days,
          r.stock,
          r.archived ? "Retirado" : "Publicado",
        ]),
      ];
    else if (tab === "activity")
      rows = [
        ["Cliente", "Empresa", "Actividad", "Puntos", "Fecha", "Referencia"],
        ...view.activities.map((a) => [
          name(a.accountId),
          a.brand,
          a.label.startsWith("Referido confirmado:")
            ? "Referido confirmado"
            : a.label,
          a.points,
          a.date,
          a.reference ?? "",
        ]),
      ];
    else
      rows = [
        [
          "Compra",
          "Fecha",
          "Cliente",
          "Correo",
          "Empresa",
          "Moto",
          "USDT demo",
          "Puntos",
        ],
        ...view.purchases.map((p) => [
          p.id,
          p.createdAt,
          name(p.ownerId),
          view.clients.find((a) => a.id === p.ownerId)?.email ?? "",
          p.brand,
          p.model,
          p.amountUSDT,
          p.points,
        ]),
      ];
    const cell = (v: string | number) =>
      `"${String(v)
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8;" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `rideclub-${global ? "admin" : own?.name.toLowerCase()}-${tab}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Reporte del ámbito seleccionado exportado.");
  }
  const clientStats = (a: Account) => ({
    units: view.purchases.filter((p) => p.ownerId === a.id).length,
    paid: view.purchases
      .filter((p) => p.ownerId === a.id)
      .reduce((n, p) => n + p.amountUSDT, 0),
    spent: view.coupons
      .filter((p) => p.ownerId === a.id)
      .reduce((n, p) => n + p.points, 0),
  });
  const selectedCompanies =
    global && !brand
      ? companies
      : companies.filter((c) => c.name === (global ? brand : own?.name));
  return (
    <section
      className={`page-section business-page ${themedCompany ? "company-themed" : ""}`}
      style={themeStyle}
    >
      <div className="business-shell">
        <aside className="business-sidebar">
          <div className="business-identity">
            {global ? (
              <ShieldCheck size={28} />
            ) : (
              <BrandLogo brand={own!.name} />
            )}
            <span>
              {global ? "RIDECLUB" : own?.name}
              <strong>
                {global ? "Administración global" : "Dashboard de empresa"}
              </strong>
            </span>
          </div>
          <nav aria-label="Menú del dashboard">
            {tabs
              .filter(([key]) => global || key !== "companies")
              .map(([key, label, Icon]) => (
                <button
                  key={key}
                  className={tab === key ? "active" : ""}
                  onClick={() => {
                    setTab(key);
                    setSearch("");
                  }}
                >
                  <Icon size={18} />
                  {!global && key === "wallets" ? "Mi wallet" : label}
                  {key === "companies" && (
                    <small>{state.companies.length}</small>
                  )}
                </button>
              ))}
          </nav>
          <button className="business-workshop" onClick={onWorkshop}>
            <Wrench size={17} /> Operación y taller <ArrowUpRight size={15} />
          </button>
          <div className="business-session">
            <span>{current.email}</span>
            <small>
              {global ? "Rol administrador" : "Rol empresa"} · entorno de prueba
            </small>
            <button onClick={onLogout}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </aside>
        <div className="business-content">
          {themedCompany && (
            <div className="company-context-banner">
              <div>
                <span className="eyebrow">
                  ESPACIO DE MARCA · {themedCompany.name.toUpperCase()}
                </span>
                <h2>{themedCompany.subtitle}</h2>
                <p>
                  Métricas, clientes y catálogo filtrados para esta empresa.
                </p>
              </div>
              <BrandLogo brand={themedCompany.name} />
            </div>
          )}
          <div className="business-heading">
            <div>
              <span className="eyebrow">
                {global
                  ? "TODAS LAS EMPRESAS. UNA MISMA VISIÓN."
                  : "TU EMPRESA, MÁS CERCA DE SUS RIDERS."}
              </span>
              <h1>
                {tab === "overview"
                  ? global
                    ? "El pulso de RideClub."
                    : `Hola, ${own?.name}.`
                  : tabs.find(([key]) => key === tab)?.[1]}
              </h1>
              <p>
                {global
                  ? "Métricas, empresas y movimientos de toda la plataforma."
                  : `Clientes, ventas y beneficios de ${own?.name}.`}
              </p>
            </div>
            <button className="button secondary small" onClick={exportCSV}>
              <Download size={16} /> Exportar CSV
            </button>
          </div>
          <div className="business-filters">
            {global ? (
              <label>
                Empresa
                <select
                  aria-label="Empresa del dashboard"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                >
                  <option value="">Todas las empresas</option>
                  {companies.map((c) => (
                    <option key={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="company-scope">
                <BrandLogo brand={own!.name} />
                <Status status={own!.status} />
              </span>
            )}
            <label>
              Desde
              <input
                aria-label="Desde"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                aria-label="Hasta"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            {(from || to || brand) && (
              <button
                className="text-link"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setBrand("");
                }}
              >
                Limpiar filtros
              </button>
            )}
            <span className="dashboard-demo-label">
              <i
                className={`live-dot ${realtimeStatus}`}
                aria-hidden="true"
              />
              {realtimeStatus === "connected"
                ? "Datos en vivo"
                : realtimeStatus === "connecting"
                  ? "Conectando datos"
                  : realtimeStatus === "error"
                    ? "Reconectando datos"
                    : "Datos del ámbito autorizado"}
              {" · USDT ficticio"}
            </span>
          </div>
          {!global && own?.status !== "active" && (
            <div className="business-notice">
              <ShieldCheck size={21} />
              <span>
                {own?.status === "pending"
                  ? "Tu empresa está pendiente de aprobación. Puedes preparar su catálogo; aparecerá en la landing cuando el administrador la publique."
                  : "Tu empresa está suspendida. El catálogo no aparece en la landing y la edición está deshabilitada."}
              </span>
            </div>
          )}
          {message && (
            <div className="business-message" role="status">
              <Check size={17} />
              {message}
              <button onClick={() => setMessage("")}>Cerrar</button>
            </div>
          )}
          {tab === "overview" && (
            <>
              <div className="business-kpis">
                {[
                  [
                    Users,
                    "Clientes registrados",
                    m.registered,
                    "Perfiles vinculados",
                  ],
                  [
                    Wallet,
                    "Ventas en la página",
                    fmt(m.sales),
                    "USDT de prueba",
                  ],
                  [BikeIcon, "Motos compradas", m.units, "Compras completadas"],
                  [ShoppingBag, "Compradores", m.buyers, "Clientes únicos"],
                  [
                    Ticket,
                    "Puntos gastados",
                    fmt(m.spentPoints),
                    `${m.redemptions} canjes realizados`,
                  ],
                  [
                    Gift,
                    "Beneficios utilizados",
                    m.used,
                    "Validados en taller",
                  ],
                ].map(([Icon, label, value, note]) => {
                  const I = Icon as typeof Users;
                  return (
                    <article className="business-kpi" key={String(label)}>
                      <span>
                        <I size={19} />
                        {String(label)}
                      </span>
                      <strong>{String(value)}</strong>
                      <small>{String(note)}</small>
                    </article>
                  );
                })}
              </div>
              <div className="business-overview-grid">
                <Panel
                  title={
                    global
                      ? "Registrados por empresa"
                      : "Tus modelos más vendidos"
                  }
                  subtitle={
                    global
                      ? "Personas que eligieron cada marca al registrarse"
                      : "Unidades y ventas capturadas en las compras"
                  }
                >
                  {global ? (
                    <div className="business-bars">
                      {view.companies.map((c) => {
                        const count = readBusiness(state, c.name, { from, to })
                          .metrics.registered;
                        return (
                          <div key={c.id}>
                            <span>
                              <BrandLogo brand={c.name} />
                              <b>{count} clientes</b>
                            </span>
                            <div className="bar-track">
                              <i
                                style={{
                                  width: `${(count / Math.max(m.registered, 1)) * 100}%`,
                                  background: c.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ModelSales view={view} />
                  )}
                </Panel>
                <Panel
                  title="Puntos y beneficios"
                  subtitle="Movimientos de fidelización en el período seleccionado"
                >
                  <div className="business-loyalty">
                    <span>
                      <strong>{fmt(m.issuedPoints)}</strong>Puntos acreditados
                    </span>
                    <span>
                      <strong>{fmt(m.spentPoints)}</strong>Puntos canjeados
                    </span>
                    <span>
                      <strong>{m.redemptions}</strong>Beneficios emitidos
                    </span>
                    <span>
                      <strong>{m.used}</strong>Beneficios utilizados
                    </span>
                  </div>
                  <p className="fine-print">
                    Las ventas cuentan compras completadas en el checkout; la
                    acreditación manual de puntos se registra como actividad.
                  </p>
                </Panel>
              </div>
              <Panel
                title="Tendencias de los últimos 14 días"
                subtitle="Registros, ventas y canjes por día para detectar movimiento y crecimiento."
              >
                <TrendChart view={view} accent={themedCompany?.color} />
              </Panel>
              {global && (
                <Panel
                  title="Resultados por empresa"
                  subtitle="Registro, compras y canjes separados por marca"
                >
                  <Table
                    headings={[
                      "Empresa",
                      "Registrados",
                      "Compradores",
                      "Motos",
                      "Ventas USDT demo",
                      "Puntos canjeados",
                      "Canjes",
                    ]}
                  >
                    {view.companies.map((c) => {
                      const metrics = readBusiness(state, c.name, {
                        from,
                        to,
                      }).metrics;
                      return (
                        <tr key={c.id}>
                          <td>
                            <BrandLogo brand={c.name} />
                            <strong>{c.name}</strong>
                          </td>
                          <td>{metrics.registered}</td>
                          <td>{metrics.buyers}</td>
                          <td>{metrics.units}</td>
                          <td>{fmt(metrics.sales)}</td>
                          <td>{fmt(metrics.spentPoints)}</td>
                          <td>{metrics.redemptions}</td>
                        </tr>
                      );
                    })}
                  </Table>
                </Panel>
              )}
              <Panel
                title="Compras recientes"
                subtitle="Qué moto compró cada cliente y cuánto pagó"
              >
                <Purchases view={view} purchases={view.purchases.slice(0, 5)} />
              </Panel>
            </>
          )}
          {tab === "companies" && (
            <Panel
              title="Empresas del marketplace"
              subtitle="El administrador registra empresas y decide cuándo publicarlas."
              action={
                <button
                  className="button primary small"
                  onClick={() => setEditor({ kind: "company" })}
                >
                  <Plus size={16} />
                  Registrar empresa
                </button>
              }
            >
              <div className="company-management-grid">
                {view.companies.map((c) => {
                  const stats = readBusiness(state, c.name, {
                    from,
                    to,
                  }).metrics;
                  return (
                    <article className="managed-company" key={c.id}>
                      <div>
                        <BrandLogo brand={c.name} />
                        <Status status={c.status} />
                      </div>
                      <h3>{c.name}</h3>
                      <p>{c.subtitle}</p>
                      <span>{c.email}</span>
                      <div className="managed-company-stats">
                        <span>
                          <strong>{stats.registered}</strong>registrados
                        </span>
                        <span>
                          <strong>{stats.units}</strong>motos
                        </span>
                        <span>
                          <strong>{fmt(stats.sales)}</strong>USDT demo
                        </span>
                      </div>
                      <div className="row-actions">
                        <button
                          aria-label={`Editar empresa ${c.name}`}
                          onClick={() =>
                            setEditor({ kind: "company", item: c })
                          }
                        >
                          <Pencil size={15} />
                          Editar
                        </button>
                        <button
                          onClick={() => {
                            setBrand(c.name);
                            setTab("overview");
                          }}
                        >
                          Ver métricas <ArrowUpRight size={15} />
                        </button>
                        <button
                          onClick={() =>
                            changePermissions(
                              c,
                              c.status === "active" ? "suspended" : "active",
                            )
                          }
                        >
                          {c.status === "active"
                            ? "Suspender"
                            : "Publicar y autorizar"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Panel>
          )}
          {tab === "clients" && (
            <Panel
              title={global ? "Clientes de la plataforma" : "Tus clientes"}
              subtitle={
                global
                  ? "Administra los clientes de toda la plataforma o consulta su actividad por empresa."
                  : "Administra los perfiles registrados en tu empresa y consulta quienes compraron o canjearon contigo."
              }
              action={
                <div className="panel-actions">
                  <SearchBox
                    value={search}
                    onChange={setSearch}
                    label="Buscar clientes"
                  />
                  {(global || own) && (
                    <>
                      <button
                        className="button secondary small"
                        disabled={!writable}
                        onClick={() => setClientImport(true)}
                      >
                        <FileUp size={16} /> Importar CSV
                      </button>
                      <button
                        className="button primary small"
                        disabled={!writable}
                        onClick={() => setEditor({ kind: "client" })}
                      >
                        <UserPlus size={16} /> Registrar cliente
                      </button>
                    </>
                  )}
                </div>
              }
            >
              <Table
                headings={[
                  "Cliente",
                  "Contacto",
                  "Estado",
                  "Vínculo",
                  "Motos",
                  "USDT demo",
                  "Puntos canjeados",
                  "Detalle",
                ]}
              >
                {view.clients
                  .filter((a) =>
                    matches(a.name + " " + a.email + " " + a.phone),
                  )
                  .map((a) => {
                    const stats = clientStats(a);
                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.name}</strong>
                          <small>
                            {a.createdAt
                              ? date(a.createdAt)
                              : "Registro anterior a la actualización"}
                          </small>
                        </td>
                        <td>
                          {a.email}
                          <small>{a.phone ?? "Sin celular"}</small>
                        </td>
                        <td>
                          <ClientStatus status={a.status ?? "active"} />
                        </td>
                        <td>
                          {view.brand
                            ? a.brand === view.brand
                              ? "Registrado en tu empresa"
                              : "Comprador / participante"
                            : (a.brand ?? "Sin marca")}
                        </td>
                        <td>{stats.units}</td>
                        <td>{fmt(stats.paid)}</td>
                        <td>{fmt(stats.spent)}</td>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => setCustomer(a)}
                          >
                            Ver cliente <ArrowUpRight size={15} />
                          </button>
                          {(global || a.brand === own?.name) && (
                            <button
                              className="text-link"
                              disabled={!writable}
                              onClick={() =>
                                setEditor({ kind: "client", item: a })
                              }
                            >
                              <Pencil size={14} /> Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                })}
              </Table>
              {(global || own) && (
                <div className="status-explanation">
                  <ShieldCheck size={20} />
                  <span>
                    <strong>Bloqueada:</strong> suspensión temporal; no puede
                    iniciar sesión y puedes reactivarla. <strong>Dada de baja:</strong>{" "}
                    sale de la operación habitual y tampoco puede ingresar, pero
                    sus compras, canjes y auditoría se conservan.
                  </span>
                </div>
              )}
              {view.clients.length === 0 && (
                <BusinessEmpty text="Aún no hay clientes en esta empresa. Los registros y compradores aparecerán aquí." />
              )}
            </Panel>
          )}
          {tab === "rules" && (
            <Panel
              title="Puntos ganados y costos de canje"
              subtitle={
                global
                  ? "Administra cualquier marca. El valor de mantenimiento está conectado directamente con su recompensa publicada."
                  : "Configura los puntos de tu marca. El mantenimiento comparte un único valor con la recompensa publicada en la landing."
              }
            >
              <div className="points-rules-grid">
                {selectedCompanies.map((company) => (
                  <article className="points-rule-company" key={company.id}>
                    <div className="points-rule-brand">
                      <BrandLogo brand={company.name} />
                      <span>
                        <strong>{company.name}</strong>
                        <small>Reglas activas en compras y acreditaciones</small>
                      </span>
                    </div>
                    <div className="points-rule-list">
                      {Object.entries(company.pointRules).map(
                        ([kind, rule]) => (
                          <div key={kind}>
                            <span>
                              {pointRuleLabels[kind as keyof PointRuleSet]}
                            </span>
                            <strong>{fmt(rule.points)} puntos</strong>
                            <small>Vencen en {rule.expiryDays} días</small>
                          </div>
                        ),
                      )}
                    </div>
                    <button
                      className="button secondary small"
                      disabled={!writable}
                      onClick={() =>
                        setEditor({ kind: "rules", item: company })
                      }
                    >
                      <Settings2 size={15} /> Configurar puntos ganados
                    </button>
                  </article>
                ))}
              </div>
              <div className="redemption-costs-heading">
                <div>
                  <h3>Costos de los beneficios publicados</h3>
                  <p>
                    Este es el valor que aparece en la landing de recompensas.
                    El mantenimiento usa el mismo valor de la regla superior:
                    si cambias uno, el otro se actualiza automáticamente.
                  </p>
                </div>
              </div>
              <div className="redemption-costs-grid">
                {view.rewards
                  .filter((reward) => !reward.archived)
                  .map((reward) => (
                    <article key={reward.id}>
                      <span>{reward.brand}</span>
                      <strong>{reward.title}</strong>
                      <b>{fmt(reward.points)} puntos</b>
                      <button
                        className="text-link"
                        disabled={!writable}
                        onClick={() =>
                          setEditor({ kind: "reward", item: reward })
                        }
                      >
                        <Pencil size={14} /> Editar costo
                      </button>
                    </article>
                  ))}
              </div>
              <div className="expiry-explanation">
                <CalendarClock size={21} />
                <span>
                  <strong>Vencimiento activo.</strong> Cada nueva acreditación
                  guarda su fecha de expiración. Al abrir la aplicación, los
                  puntos vencidos se descuentan y quedan registrados en el
                  historial.
                </span>
              </div>
            </Panel>
          )}
          {tab === "purchases" && (
            <Panel
              title="Compras de motos"
              subtitle={`${m.units} motos · ${m.buyers} compradores · ${fmt(m.sales)} USDT de prueba`}
              action={
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  label="Buscar compras"
                />
              }
            >
              <Purchases
                view={view}
                purchases={view.purchases.filter((p) =>
                  matches(
                    p.model +
                      " " +
                      p.id +
                      " " +
                      view.clients.find((a) => a.id === p.ownerId)?.name,
                  ),
                )}
              />
            </Panel>
          )}
          {(tab === "bikes" || tab === "rewards") && (
            <Panel
              title={
                tab === "bikes"
                  ? "Catálogo de motos"
                  : "Catálogo de recompensas"
              }
              subtitle="Los cambios se reflejan en el marketplace y las recompensas publicadas."
              action={
                companies.length ? (
                  <button
                    className="button primary small"
                    disabled={!writable || !companies.length}
                    onClick={() =>
                      setEditor({
                        kind: tab === "bikes" ? "bike" : "reward",
                      })
                    }
                  >
                    <Plus size={16} />
                    {tab === "bikes" ? "Agregar moto" : "Agregar recompensa"}
                  </button>
                ) : undefined
              }
            >
              <div className="catalog-management-filters">
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  label={
                    tab === "bikes" ? "Buscar modelos" : "Buscar recompensas"
                  }
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={archived}
                    onChange={(e) => setArchived(e.target.checked)}
                  />
                  <span>Mostrar eliminados del catálogo</span>
                </label>
              </div>
              <div className="managed-products">
                {(tab === "bikes" ? view.bikes : view.rewards)
                  .filter(
                    (r) =>
                      (archived || !r.archived) &&
                      matches("name" in r ? r.name : r.title),
                  )
                  .map((item) => {
                    const motorcycle = "name" in item;
                    const label = motorcycle ? item.name : item.title;
                    return (
                      <article
                        className={`managed-product ${item.archived ? "archived" : ""}`}
                        key={item.id}
                      >
                        <img
                          src={
                            motorcycle
                              ? item.image
                              : item.image || "/assets/maintenance-benefit.webp"
                          }
                          alt={label}
                        />
                        <div>
                          <span className="eyebrow">
                            {item.brand} /{" "}
                            {item.archived
                              ? "ELIMINADO DEL CATÁLOGO"
                              : "CATÁLOGO"}
                          </span>
                          <h3>{label}</h3>
                          <p>{motorcycle ? item.description : item.detail}</p>
                          <strong>
                            {motorcycle
                              ? item.price
                                ? `${fmt(item.price)} USDT`
                                : "Precio a cotizar"
                              : `${fmt(item.points)} puntos · ${item.days} días · ${item.stock} cupos`}
                          </strong>
                          <div className="row-actions">
                            <button
                              disabled={!writable}
                              aria-label={`Editar ${motorcycle ? "moto" : "recompensa"} ${label}`}
                              onClick={() =>
                                setEditor(
                                  motorcycle
                                    ? { kind: "bike", item }
                                    : { kind: "reward", item },
                                )
                              }
                            >
                              <Pencil size={15} />
                              Editar
                            </button>
                            {item.archived ? (
                              <button
                                disabled={!writable}
                                onClick={() =>
                                  restore(
                                    motorcycle ? "bike" : "reward",
                                    item.id,
                                  )
                                }
                              >
                                <RotateCcw size={15} />
                                Restaurar
                              </button>
                            ) : (
                              <button
                                disabled={!writable}
                                aria-label={`Eliminar ${motorcycle ? "moto" : "recompensa"} ${label}`}
                                onClick={() =>
                                  setEditor({
                                    kind: "delete",
                                    item,
                                    type: motorcycle ? "bike" : "reward",
                                  })
                                }
                              >
                                <Trash2 size={15} />
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
              </div>
              {(tab === "bikes" ? view.bikes : view.rewards).filter(
                (r) => archived || !r.archived,
              ).length === 0 && (
                <BusinessEmpty text="Tu catálogo está listo para su primer producto. Usa el botón de agregar." />
              )}
            </Panel>
          )}
          {tab === "coupons" && (
            <Panel
              title="Canjes de clientes"
              subtitle={`${m.redemptions} beneficios emitidos · ${fmt(m.spentPoints)} puntos gastados`}
              action={
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  label="Buscar canjes"
                />
              }
            >
              <Coupons
                view={view}
                coupons={view.coupons.filter((c) =>
                  matches(
                    c.title +
                      " " +
                      c.id +
                      " " +
                      view.clients.find((a) => a.id === c.ownerId)?.name,
                  ),
                )}
              />
            </Panel>
          )}
          {tab === "wallets" && (
            <Panel
              title={
                global ? "Wallets de las empresas" : "Wallet de la empresa"
              }
              subtitle="Dirección de cobro y ventas acumuladas de la simulación; la conexión a blockchain está pendiente."
            >
              <div className="company-wallet-grid">
                {selectedCompanies.map((c) => {
                  const sales = readBusiness(state, c.name).metrics.sales;
                  return (
                    <article className="company-wallet" key={c.id}>
                      <div>
                        <BrandLogo brand={c.name} />
                        <Wallet size={24} />
                      </div>
                      <h3>{c.name}</h3>
                      <span>Ventas acumuladas en USDT demo</span>
                      <strong>
                        {fmt(sales)} <small>USDT</small>
                      </strong>
                      <label>Dirección EVM · Base Sepolia</label>
                      <code>
                        {c.wallet.address ?? "Wallet pendiente de conexión"}
                      </code>
                      <p className="fine-print">
                        {c.wallet.address
                          ? "Dirección configurada en la demo, sin verificar titularidad ni consultar saldo on-chain."
                          : "Aún no se ha conectado o creado una wallet real."}{" "}
                        Este total proviene de las compras de prueba.
                      </p>
                      <button
                        className="button secondary small"
                        disabled={!writable}
                        onClick={() => setEditor({ kind: "wallet", item: c })}
                      >
                        <Pencil size={15} />
                        Configurar dirección
                      </button>
                      {c.wallet.address && (
                        <button
                          className="text-link"
                          onClick={() =>
                            navigator.clipboard
                              ?.writeText(c.wallet.address!)
                              .then(
                                () => setMessage("Dirección copiada."),
                                () =>
                                  setMessage(
                                    "Selecciona y copia la dirección.",
                                  ),
                              )
                          }
                        >
                          <Copy size={15} />
                          Copiar
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </Panel>
          )}
          {tab === "activity" && (
            <>
              <Panel
                title="Actividad de puntos"
                subtitle="Compras, canjes, mantenimientos y referidos del ámbito seleccionado."
              >
                <Table
                  headings={[
                    "Cliente",
                    "Empresa",
                    "Actividad",
                    "Puntos",
                    "Fecha",
                  ]}
                >
                  {view.activities.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {view.clients.find((c) => c.id === a.accountId)?.name ??
                          "Cliente"}
                      </td>
                      <td>{a.brand}</td>
                      <td>
                        {a.label.startsWith("Referido confirmado:")
                          ? "Referido confirmado"
                          : a.label}
                        {a.points > 0 && a.expiresAt && (
                          <small>
                            {a.expiredAt
                              ? `Venció ${date(a.expiredAt)}`
                              : `Vence ${date(a.expiresAt)}`}
                          </small>
                        )}
                      </td>
                      <td className={a.points > 0 ? "positive" : ""}>
                        {a.points > 0 ? "+" : ""}
                        {fmt(a.points)}
                      </td>
                      <td>{date(a.date)}</td>
                    </tr>
                  ))}
                </Table>
                {!view.activities.length && (
                  <BusinessEmpty text="Los movimientos aparecerán aquí cuando se realicen compras, canjes o acreditaciones." />
                )}
              </Panel>
              <Panel
                title="Cambios de administración"
                subtitle="Registro de empresas, edición del catálogo y configuración de wallets."
              >
                <Table headings={["Fecha", "Empresa", "Cambio"]}>
                  {view.audit.map((a) => (
                    <tr key={a.id}>
                      <td>{date(a.date)}</td>
                      <td>
                        {companies.find((c) => c.id === a.companyId)?.name}
                      </td>
                      <td>{a.action}</td>
                    </tr>
                  ))}
                </Table>
                {!view.audit.length && (
                  <BusinessEmpty text="Aún no se han realizado cambios de administración." />
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
      {editor?.kind === "company" && (
        <CompanyEditor
          company={editor.item}
          onClose={() => setEditor(undefined)}
          onSave={(draft) =>
            mutate((s) => saveCompany(s, draft, editor.item?.id))
          }
        />
      )}
      {editor?.kind === "client" && (
        <ClientEditor
          item={editor.item}
          companies={global ? state.companies : own ? [own] : []}
          onClose={() => setEditor(undefined)}
          onSave={(draft) =>
            mutate((s) => saveClient(s, draft, editor.item?.id))
          }
        />
      )}
      {clientImport && (
        <ClientCsvImport
          companies={global ? state.companies : own ? [own] : []}
          defaultCompany={global ? undefined : own}
          existingEmails={new Set(
            state.accounts.map((account) => account.email.toLowerCase()),
          )}
          onClose={() => setClientImport(false)}
          onImport={onImportClients}
        />
      )}
      {editor?.kind === "rules" && (
        <PointRulesEditor
          company={editor.item}
          onClose={() => setEditor(undefined)}
          onSave={(rules) =>
            mutate((s) => savePointRules(s, editor.item.id, rules))
          }
        />
      )}
      {editor?.kind === "bike" && (
        <BikeEditor
          item={editor.item}
          companies={companies}
          initialCompany={brand || own?.name}
          onClose={() => setEditor(undefined)}
          onSave={(companyId, draft) =>
            mutate((s) => saveBike(s, companyId, draft, editor.item?.id))
          }
        />
      )}
      {editor?.kind === "reward" && (
        <RewardEditor
          item={editor.item}
          companies={companies}
          initialCompany={brand || own?.name}
          onClose={() => setEditor(undefined)}
          onSave={(companyId, draft) =>
            mutate((s) => saveReward(s, companyId, draft, editor.item?.id))
          }
        />
      )}
      {editor?.kind === "wallet" && (
        <WalletEditor
          company={editor.item}
          onClose={() => setEditor(undefined)}
          onSave={(address) =>
            mutate((s) => saveWallet(s, editor.item.id, address))
          }
        />
      )}
      {editor?.kind === "delete" && (
        <DeleteDialog
          label={"name" in editor.item ? editor.item.name : editor.item.title}
          onClose={() => setEditor(undefined)}
          onSave={() =>
            mutate((s) => archiveItem(s, editor.type, editor.item.id, true))
          }
        />
      )}
      {customer && (
        <Modal
          title={`Cliente · ${customer.name}`}
          onClose={() => setCustomer(undefined)}
          wide
        >
          <div className="customer-detail">
            <div>
              <h3>{customer.name}</h3>
              <p>
                {customer.email} · {customer.phone ?? "Sin celular"}
              </p>
              <span>
                Registro:{" "}
                {customer.createdAt
                  ? date(customer.createdAt)
                  : "fecha anterior no registrada"}
              </span>
            </div>
            <div className="customer-detail-stats">
              <span>
                <strong>{clientStats(customer).units}</strong>Motos
              </span>
              <span>
                <strong>{fmt(clientStats(customer).paid)}</strong>USDT demo
              </span>
              <span>
                <strong>{fmt(clientStats(customer).spent)}</strong>Puntos
                canjeados
              </span>
            </div>
            <h4>Compras en el ámbito seleccionado</h4>
            <Purchases
              view={view}
              purchases={view.purchases.filter(
                (p) => p.ownerId === customer.id,
              )}
            />
            <h4>Beneficios y puntos utilizados</h4>
            <Coupons
              view={view}
              coupons={view.coupons.filter((c) => c.ownerId === customer.id)}
            />
          </div>
        </Modal>
      )}
    </section>
  );
}
function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="business-panel">
      <div className="business-panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Table({
  headings,
  children,
}: {
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className="dashboard-table-scroll">
      <table className="dashboard-table">
        <caption className="sr-only">{headings.join(", ")}</caption>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h} scope="col">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Status({ status }: { status: Company["status"] }) {
  return (
    <span className={`company-status ${status}`}>
      {status === "active"
        ? "Publicada"
        : status === "pending"
          ? "Pendiente"
          : "Suspendida"}
    </span>
  );
}
function BusinessEmpty({ text }: { text: string }) {
  return (
    <div className="business-empty">
      <BarChart3 size={28} />
      <p>{text}</p>
    </div>
  );
}
function SearchBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label className="search-field dashboard-search">
      <Search size={16} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
      />
    </label>
  );
}
function Purchases({
  view,
  purchases,
}: {
  view: BusinessView;
  purchases: BusinessView["purchases"];
}) {
  return purchases.length ? (
    <Table
      headings={[
        "Compra / fecha",
        "Cliente",
        "Empresa / modelo",
        "Total USDT demo",
        "Puntos",
      ]}
    >
      {purchases.map((p) => (
        <tr key={p.id}>
          <td>
            <code title={p.id}>{p.id.slice(0, 13)}…</code>
            <small>{date(p.createdAt)}</small>
          </td>
          <td>
            <strong>
              {view.clients.find((a) => a.id === p.ownerId)?.name ?? "Cliente"}
            </strong>
            <small>{view.clients.find((a) => a.id === p.ownerId)?.email}</small>
          </td>
          <td>
            <strong>{p.model}</strong>
            <small>{p.brand}</small>
          </td>
          <td>{fmt(p.amountUSDT)}</td>
          <td>+{fmt(p.points)}</td>
        </tr>
      ))}
    </Table>
  ) : (
    <BusinessEmpty text="Aún no hay compras en este período. Las compras de prueba del marketplace aparecerán aquí." />
  );
}
function Coupons({
  view,
  coupons,
}: {
  view: BusinessView;
  coupons: BusinessView["coupons"];
}) {
  return coupons.length ? (
    <Table
      headings={[
        "Cliente",
        "Beneficio / empresa",
        "Puntos gastados",
        "Canje / vigencia",
        "Estado",
      ]}
    >
      {coupons.map((c) => (
        <tr key={c.id}>
          <td>
            {view.clients.find((a) => a.id === c.ownerId)?.name ?? "Cliente"}
          </td>
          <td>
            <strong>{c.title}</strong>
            <small>
              {c.brand} · {c.id.slice(-8)}
            </small>
          </td>
          <td>{fmt(c.points)}</td>
          <td>
            {date(c.issuedAt)}
            <small>Hasta {date(c.expiresAt)}</small>
          </td>
          <td>
            <span className={`status-pill ${c.usedAt ? "used" : ""}`}>
              {c.usedAt
                ? "Utilizado"
                : new Date(c.expiresAt) <= new Date()
                  ? "Vencido"
                  : "Disponible"}
            </span>
            {c.usedAt && <small>{c.workshop}</small>}
          </td>
        </tr>
      ))}
    </Table>
  ) : (
    <BusinessEmpty text="Aún no hay canjes en este período." />
  );
}
function ModelSales({ view }: { view: BusinessView }) {
  const models = [...new Set(view.purchases.map((p) => p.bikeId))]
    .map((id) => ({
      name: view.purchases.find((p) => p.bikeId === id)!.model,
      units: view.purchases.filter((p) => p.bikeId === id).length,
      total: view.purchases
        .filter((p) => p.bikeId === id)
        .reduce((n, p) => n + p.amountUSDT, 0),
    }))
    .sort((a, b) => b.units - a.units);
  return models.length ? (
    <div className="model-sales">
      {models.map((m) => (
        <div key={m.name}>
          <BikeIcon size={24} />
          <span>
            <strong>{m.name}</strong>
            <small>{fmt(m.total)} USDT demo</small>
          </span>
          <b>{m.units} motos</b>
        </div>
      ))}
    </div>
  ) : (
    <BusinessEmpty text="El ranking de modelos aparecerá con tu primera venta." />
  );
}

function ClientStatus({
  status,
}: {
  status: "active" | "blocked" | "deleted";
}) {
  return (
    <span className={`client-status ${status}`}>
      {status === "active"
        ? "Activo"
        : status === "blocked"
          ? "Bloqueado"
          : "Dado de baja"}
    </span>
  );
}

function TrendChart({
  view,
  accent,
}: {
  view: BusinessView;
  accent?: string;
}) {
  const points = trendSeries(view, 14);
  const maximum = Math.max(
    1,
    ...points.map((point) =>
      Math.max(point.registrations, point.redemptions, point.sales / 1000),
    ),
  );
  return (
    <div className="trend-chart" role="img" aria-label="Tendencias de registros, ventas y canjes durante los últimos 14 días">
      <div className="trend-legend">
        <span><i className="registrations" /> Registros</span>
        <span><i className="sales" /> Ventas · cada barra representa miles de USDT demo</span>
        <span><i className="redemptions" /> Canjes</span>
      </div>
      <div className="trend-bars">
        {points.map((point) => (
          <div className="trend-day" key={point.key}>
            <div className="trend-columns">
              <i
                className="registrations"
                style={{ height: `${Math.max(2, (point.registrations / maximum) * 100)}%` }}
                title={`${point.registrations} registros`}
              />
              <i
                className="sales"
                style={{
                  height: `${Math.max(2, (point.sales / 1000 / maximum) * 100)}%`,
                  background: accent,
                }}
                title={`${fmt(point.sales)} USDT demo`}
              />
              <i
                className="redemptions"
                style={{ height: `${Math.max(2, (point.redemptions / maximum) * 100)}%` }}
                title={`${point.redemptions} canjes`}
              />
            </div>
            <span>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState("");
  async function fileChange(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 600000
    ) {
      setError("Usa PNG, JPEG o WebP de hasta 600 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result));
      setError("");
    };
    reader.onerror = () => setError("No pudimos leer esta imagen.");
    reader.readAsDataURL(file);
  }
  return (
    <div className="image-editor">
      <label>
        {label}
        <input
          aria-label={label}
          value={value.startsWith("data:") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… o /assets/…"
        />
      </label>
      <label className="image-file">
        O subir una imagen
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void fileChange(e.target.files?.[0])}
        />
      </label>
      {value && (
        <img
          src={value}
          alt={`Vista previa de ${label}`}
          onError={() => setError("No se puede cargar la imagen de esa URL.")}
        />
      )}
      <small>PNG, JPEG o WebP · máximo 600 KB.</small>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ClientCsvImport({
  companies,
  defaultCompany,
  existingEmails,
  onClose,
  onImport,
}: {
  companies: Company[];
  defaultCompany?: Company;
  existingEmails: Set<string>;
  onClose: () => void;
  onImport: (rows: ClientImportRow[]) => Promise<ClientImportOutcome[]>;
}) {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ClientImportParseResult>();
  const [outcomes, setOutcomes] = useState<ClientImportOutcome[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function downloadTemplate() {
    const blob = new Blob(
      ["\uFEFF" + clientCsvTemplate(defaultCompany?.name)],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plantilla-clientes-${defaultCompany?.name.toLowerCase() ?? "rideclub"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function selectFile(file?: File) {
    if (!file) return;
    setError("");
    setOutcomes(undefined);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Selecciona un archivo con extensión .csv.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("El CSV no puede superar 1 MB.");
      return;
    }
    try {
      const result = parseClientCsv(
        await file.text(),
        companies,
        defaultCompany,
      );
      setFileName(file.name);
      setParsed(result);
    } catch {
      setError("No se pudo leer el CSV. Descarga la plantilla y revisa su formato.");
    }
  }

  async function runImport() {
    if (!parsed?.rows.length) return;
    setBusy(true);
    setError("");
    try {
      setOutcomes(await onImport(parsed.rows));
    } catch (importError) {
      setError((importError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const created = outcomes?.filter((item) => item.result === "created").length ?? 0;
  const updated = outcomes?.filter((item) => item.result === "updated").length ?? 0;
  const failed = outcomes?.filter((item) => item.result === "error").length ?? 0;
  return (
    <Modal title="Importar clientes desde CSV" onClose={onClose} wide>
      <div className="csv-import">
        <div className="csv-import-intro">
          <FileSpreadsheet size={31} />
          <div>
            <h3>Sincroniza una base de clientes existente</h3>
            <p>
              Los correos nuevos crean perfiles confirmados sin enviar mensajes.
              Los correos existentes actualizan sus datos y empresa vinculada.
            </p>
          </div>
          <button className="button secondary small" onClick={downloadTemplate}>
            <Download size={15} /> Descargar plantilla
          </button>
        </div>
        <div className="csv-columns">
          <strong>Columnas aceptadas</strong>
          <code>nombre;correo;celular;empresa;estado</code>
          <small>
            {defaultCompany
              ? `La columna empresa es opcional y todos los registros se asignarán a ${defaultCompany.name}.`
              : "Empresa debe coincidir con el nombre de una empresa registrada."}
            {" "}Estado: active, blocked o deleted. Celular en formato internacional.
          </small>
        </div>
        {!outcomes && (
          <label className="csv-dropzone">
            <FileUp size={25} />
            <span>{fileName || "Seleccionar archivo CSV"}</span>
            <small>Máximo 250 filas y 1 MB · separador coma o punto y coma</small>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
          </label>
        )}
        {parsed && !outcomes && (
          <>
            <div className="csv-import-summary">
              <span className="valid"><strong>{parsed.rows.length}</strong> filas válidas</span>
              <span className={parsed.issues.length ? "invalid" : ""}>
                <strong>{parsed.issues.length}</strong> observaciones
              </span>
              <span><strong>{parsed.rows.filter((row) => existingEmails.has(row.email)).length}</strong> actualizaciones detectadas</span>
            </div>
            {!!parsed.rows.length && (
              <div className="table-wrap csv-preview">
                <table>
                  <caption className="sr-only">Vista previa de clientes que se importarán</caption>
                  <thead><tr><th scope="col">Fila</th><th scope="col">Cliente</th><th scope="col">Correo</th><th scope="col">Empresa</th><th scope="col">Estado</th><th scope="col">Acción</th></tr></thead>
                  <tbody>
                    {parsed.rows.slice(0, 25).map((row) => (
                      <tr key={`${row.row}-${row.email}`}>
                        <td>{row.row}</td>
                        <td><strong>{row.name}</strong><small>{row.phone ?? "Sin celular"}</small></td>
                        <td>{row.email}</td>
                        <td>{row.companyName}</td>
                        <td><ClientStatus status={row.status} /></td>
                        <td>{existingEmails.has(row.email) ? "Actualizar" : "Crear"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 25 && <p className="fine-print">Se muestran 25 de {parsed.rows.length} filas válidas.</p>}
              </div>
            )}
            {!!parsed.issues.length && (
              <div className="csv-issues" role="alert">
                <strong>Filas que no se importarán</strong>
                <ul>
                  {parsed.issues.slice(0, 20).map((issue) => (
                    <li key={`${issue.row}-${issue.message}`}>Fila {issue.row}: {issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              className="button primary full"
              disabled={!parsed.rows.length || busy}
              onClick={() => void runImport()}
            >
              {busy ? "Importando clientes…" : `Importar ${parsed.rows.length} clientes válidos`}
            </button>
          </>
        )}
        {outcomes && (
          <div className="csv-result" role="status">
            <Check size={32} />
            <h3>Importación finalizada</h3>
            <div className="csv-import-summary">
              <span className="valid"><strong>{created}</strong> creados</span>
              <span><strong>{updated}</strong> actualizados</span>
              <span className={failed ? "invalid" : ""}><strong>{failed}</strong> rechazados</span>
            </div>
            {failed > 0 && (
              <div className="csv-issues">
                <ul>{outcomes.filter((item) => item.result === "error").map((item) => <li key={item.row}>Fila {item.row}: {item.message}</li>)}</ul>
              </div>
            )}
            <p>Los clientes ya aparecen en el dashboard. La importación no envió ningún correo.</p>
            <button className="button dark full" onClick={onClose}>Cerrar y ver clientes</button>
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

function ClientEditor({
  item,
  companies,
  onClose,
  onSave,
}: {
  item?: Account;
  companies: Company[];
  onClose: () => void;
  onSave: (draft: ClientDraft) => SaveResult;
}) {
  const [form, setForm] = useState<ClientDraft>({
    name: item?.name ?? "",
    email: item?.email ?? "",
    phone: item?.phone ?? "+591",
    brand: item?.brand ?? companies.find((company) => company.status === "active")?.name,
    status: item?.status ?? "active",
  });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await onSave(form);
    if (result) setError(result);
  }
  return (
    <Modal title={item ? `Editar cliente · ${item.name}` : "Registrar cliente"} onClose={onClose}>
      <form className="stack-form dashboard-editor" onSubmit={submit}>
        <label>
          Nombre completo
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label>
          Correo electrónico
          <input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          Celular internacional
          <input required value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+59170000000" />
        </label>
        <label>
          Empresa vinculada
          {companies.length > 1 ? (
            <select
              required
              value={form.brand ?? ""}
              onChange={(event) =>
                setForm({ ...form, brand: event.target.value })
              }
            >
              {companies.map((company) => (
                <option key={company.id} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>
          ) : (
            <input value={form.brand ?? ""} readOnly aria-readonly="true" />
          )}
          <small>
            {companies.length > 1
              ? "El administrador puede asignar el cliente a cualquier empresa."
              : "La empresa se asigna automáticamente desde tu sesión."}
          </small>
        </label>
        <label>
          Estado de la cuenta
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ClientDraft["status"] })}>
            <option value="active">Activa</option>
            <option value="blocked">Bloqueada temporalmente</option>
            <option value="deleted">Dada de baja</option>
          </select>
          <small>
            Bloquear impide el acceso hasta reactivar la cuenta. Dar de baja la
            retira de la operación habitual, pero conserva compras, canjes y
            auditoría.
          </small>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full" type="submit">
          {item ? "Guardar cliente" : "Registrar cliente"}
        </button>
      </form>
    </Modal>
  );
}

function PointRulesEditor({
  company,
  onClose,
  onSave,
}: {
  company: Company;
  onClose: () => void;
  onSave: (rules: PointRuleSet) => SaveResult;
}) {
  const [rules, setRules] = useState<PointRuleSet>(structuredClone(company.pointRules));
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await onSave(rules);
    if (result) setError(result);
  }
  return (
    <Modal title={`Reglas de puntos · ${company.name}`} onClose={onClose} wide>
      <form className="stack-form dashboard-editor" onSubmit={submit}>
        <div className="rule-editor-grid">
          {Object.entries(rules).map(([kind, rule]) => (
            <fieldset key={kind}>
              <legend>{pointRuleLabels[kind as keyof PointRuleSet]}</legend>
              <label>
                Puntos entregados
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  required
                  value={rule.points}
                  onChange={(event) => setRules({ ...rules, [kind]: { ...rule, points: Number(event.target.value) } })}
                />
              </label>
              <label>
                Vencimiento en días
                <input
                  type="number"
                  min="1"
                  max="3650"
                  step="1"
                  required
                  value={rule.expiryDays}
                  onChange={(event) => setRules({ ...rules, [kind]: { ...rule, expiryDays: Number(event.target.value) } })}
                />
              </label>
            </fieldset>
          ))}
        </div>
        <p className="fine-print">
          Compra, referido y evento indican puntos que el cliente gana. El valor
          de mantenimiento también actualiza el costo del beneficio principal
          de mantenimiento en la landing. Las reglas se aplican a nuevas
          acreditaciones y los puntos ya entregados conservan su fecha original.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full" type="submit">Guardar reglas</button>
      </form>
    </Modal>
  );
}

function CompanyEditor({
  company,
  onClose,
  onSave,
}: {
  company?: Company;
  onClose: () => void;
  onSave: (d: CompanyDraft) => SaveResult;
}) {
  const [form, setForm] = useState<CompanyDraft>({
    name: company?.name ?? "",
    email: company?.email ?? "",
    subtitle: company?.subtitle ?? "",
    logo: company?.logo ?? "",
    color: company?.color ?? "#c6f46a",
    url: company?.url ?? "",
    status: company?.status ?? "pending",
    walletAddress: company?.wallet.address ?? "",
  });
  const [error, setError] = useState("");
  function field<K extends keyof CompanyDraft>(key: K, value: CompanyDraft[K]) {
    setForm({ ...form, [key]: value });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = await onSave(form);
    if (err) setError(err);
  }
  return (
    <Modal
      title={
        company ? `Editar empresa · ${company.name}` : "Registrar nueva empresa"
      }
      onClose={onClose}
    >
      <form className="stack-form dashboard-editor" onSubmit={submit}>
        <label>
          Nombre de empresa
          <input
            aria-label="Nombre de empresa"
            required
            maxLength={45}
            value={form.name}
            readOnly={!!company}
            onChange={(e) => field("name", e.target.value)}
          />
        </label>
        <label>
          Correo de acceso de la empresa
          <input
            aria-label="Correo de acceso de la empresa"
            type="email"
            required
            value={form.email}
            onChange={(e) => field("email", e.target.value)}
            placeholder="empresa@gmail.com"
          />
        </label>
        <label>
          Lema o descripción corta
          <input
            required
            value={form.subtitle}
            onChange={(e) => field("subtitle", e.target.value)}
            maxLength={120}
          />
        </label>
        <div className="form-row">
          <label>
            Permiso de publicación
            <select
              aria-label="Permiso de publicación"
              value={form.status}
              onChange={(e) =>
                field("status", e.target.value as Company["status"])
              }
            >
              <option value="pending">Pendiente de aprobación</option>
              <option value="active">Publicada y autorizada</option>
              <option value="suspended">Suspendida</option>
            </select>
          </label>
          <label>
            Color de empresa
            <input
              type="color"
              value={form.color}
              onChange={(e) => field("color", e.target.value)}
            />
          </label>
        </div>
        <label>
          Sitio web <span className="optional">Opcional</span>
          <input
            type="url"
            value={form.url}
            onChange={(e) => field("url", e.target.value)}
          />
        </label>
        <ImageField
          label="Logo de empresa"
          value={form.logo}
          onChange={(v) => field("logo", v)}
        />
        <p className="fine-print">
          El correo permite solicitar el enlace de acceso al dashboard. Al
          publicar la empresa, aparecerá en la landing y en el registro de
          clientes; al suspenderla, se revoca su acceso operativo.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" type="submit">
          {company ? "Guardar empresa" : "Crear empresa y acceso"}
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
function CompanySelect({
  companies,
  value,
  onChange,
  disabled,
}: {
  companies: Company[];
  value: string;
  onChange: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <label>
      Empresa del producto
      <select
        aria-label="Empresa del producto"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function BikeEditor({
  item,
  companies,
  initialCompany,
  onClose,
  onSave,
}: {
  item?: Bike;
  companies: Company[];
  initialCompany?: string;
  onClose: () => void;
  onSave: (id: string, d: BikeDraft) => SaveResult;
}) {
  const [companyId, setCompanyId] = useState(
    companies.find((c) => c.name === (item?.brand ?? initialCompany))?.id ??
      companies[0]?.id ??
      "",
  );
  const [form, setForm] = useState<BikeDraft>({
    name: item?.name ?? "",
    category: item?.category ?? "Naked",
    tag: item?.tag ?? "",
    description: item?.description ?? "",
    image: item?.image ?? "",
    price: item?.price,
    source: item?.source ?? "",
    region: item?.region ?? "Catálogo de empresa",
    specs: item?.specs ?? [],
  });
  const [specs, setSpecs] = useState(
    item?.specs.map(([k, v]) => `${k}: ${v}`).join("\n") ?? "",
  );
  const [error, setError] = useState("");
  function field<K extends keyof BikeDraft>(key: K, value: BikeDraft[K]) {
    setForm({ ...form, [key]: value });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const lines = specs
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.some((l) => !l.includes(":"))) {
      setError("Cada especificación debe tener nombre: valor.");
      return;
    }
    const pairs = lines.map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()] as [string, string];
    });
    const err = await onSave(companyId, { ...form, specs: pairs });
    if (err) setError(err);
  }
  return (
    <Modal
      title={item ? `Editar moto · ${item.name}` : "Agregar moto"}
      onClose={onClose}
    >
      <form className="stack-form dashboard-editor" onSubmit={submit}>
        <CompanySelect
          companies={companies}
          value={companyId}
          onChange={setCompanyId}
          disabled={!!item || companies.length === 1}
        />
        <label>
          Modelo de moto
          <input
            aria-label="Modelo de moto"
            required
            value={form.name}
            onChange={(e) => field("name", e.target.value)}
            maxLength={80}
          />
        </label>
        <div className="form-row">
          <label>
            Categoría
            <input
              required
              value={form.category}
              onChange={(e) => field("category", e.target.value)}
              list="bike-categories"
            />
            <datalist id="bike-categories">
              <option>Adventure</option>
              <option>Scrambler</option>
              <option>Naked</option>
              <option>Eléctrica</option>
            </datalist>
          </label>
          <label>
            Precio USDT
            <input
              aria-label="Precio USDT"
              type="number"
              min="0.01"
              step="0.01"
              value={form.price ?? ""}
              onChange={(e) =>
                field(
                  "price",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="Vacío: consultar precio"
            />
          </label>
        </div>
        <label>
          Descripción
          <textarea
            required
            value={form.description}
            onChange={(e) => field("description", e.target.value)}
            rows={3}
          />
        </label>
        <label>
          Lema corto
          <input
            value={form.tag}
            onChange={(e) => field("tag", e.target.value)}
            maxLength={80}
          />
        </label>
        <label>
          Región / catálogo
          <input
            required
            value={form.region}
            onChange={(e) => field("region", e.target.value)}
          />
        </label>
        <label>
          Enlace de origen <span className="optional">Opcional</span>
          <input
            type="url"
            value={form.source}
            onChange={(e) => field("source", e.target.value)}
          />
        </label>
        <label>
          Especificaciones
          <textarea
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
            rows={3}
            placeholder={"Motor: 150 cc\nTransmisión: 6 velocidades"}
          />
          <small>Una especificación por línea: nombre: valor.</small>
        </label>
        <ImageField
          label="Foto de moto"
          value={form.image}
          onChange={(v) => field("image", v)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" type="submit">
          Guardar moto
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
function RewardEditor({
  item,
  companies,
  initialCompany,
  onClose,
  onSave,
}: {
  item?: Reward;
  companies: Company[];
  initialCompany?: string;
  onClose: () => void;
  onSave: (id: string, d: RewardDraft) => SaveResult;
}) {
  const [companyId, setCompanyId] = useState(
    companies.find((c) => c.name === (item?.brand ?? initialCompany))?.id ??
      companies[0]?.id ??
      "",
  );
  const [form, setForm] = useState<RewardDraft>({
    title: item?.title ?? "",
    kind: item?.kind ?? "service",
    category: item?.category ?? "Servicio",
    points: item?.points ?? 500,
    detail: item?.detail ?? "",
    terms: item?.terms ?? "",
    days: item?.days ?? 60,
    stock: item?.stock ?? 20,
    image: item?.image ?? "",
  });
  const [error, setError] = useState("");
  function field<K extends keyof RewardDraft>(key: K, value: RewardDraft[K]) {
    setForm({ ...form, [key]: value });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = await onSave(companyId, form);
    if (err) setError(err);
  }
  return (
    <Modal
      title={item ? `Editar recompensa · ${item.title}` : "Agregar recompensa"}
      onClose={onClose}
    >
      <form className="stack-form dashboard-editor" onSubmit={submit}>
        <CompanySelect
          companies={companies}
          value={companyId}
          onChange={setCompanyId}
          disabled={!!item || companies.length === 1}
        />
        <label>
          Nombre del beneficio
          <input
            aria-label="Nombre del beneficio"
            required
            value={form.title}
            onChange={(e) => field("title", e.target.value)}
            maxLength={100}
          />
        </label>
        <div className="form-row">
          <label>
            Tipo
            <select
              value={form.kind}
              onChange={(e) => field("kind", e.target.value as Reward["kind"])}
            >
              <option value="service">Mantenimiento / servicio</option>
              <option value="parts">Repuestos / accesorios</option>
              <option value="care">Cuidado / limpieza</option>
            </select>
          </label>
          <label>
            Categoría
            <input
              required
              value={form.category}
              onChange={(e) => field("category", e.target.value)}
            />
          </label>
        </div>
        <label>
          Puntos para canjear
          <input
            aria-label="Puntos para canjear"
            type="number"
            required
            min={1}
            step={1}
            value={form.points}
            onChange={(e) => field("points", Number(e.target.value))}
          />
        </label>
        <div className="form-row">
          <label>
            Vigencia en días
            <input
              aria-label="Vigencia en días"
              type="number"
              required
              min={1}
              max={3650}
              step={1}
              value={form.days}
              onChange={(e) => field("days", Number(e.target.value))}
            />
          </label>
          <label>
            Cupos totales
            <input
              aria-label="Cupos totales"
              type="number"
              required
              min={0}
              step={1}
              value={form.stock}
              onChange={(e) => field("stock", Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          Descripción del beneficio
          <textarea
            required
            rows={3}
            value={form.detail}
            onChange={(e) => field("detail", e.target.value)}
          />
        </label>
        <label>
          Condiciones de uso
          <textarea
            required
            rows={3}
            value={form.terms}
            onChange={(e) => field("terms", e.target.value)}
          />
        </label>
        <ImageField
          label="Imagen del beneficio"
          value={form.image ?? ""}
          onChange={(v) => field("image", v)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" type="submit">
          Guardar recompensa
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
function WalletEditor({
  company,
  onClose,
  onSave,
}: {
  company: Company;
  onClose: () => void;
  onSave: (s: string) => SaveResult;
}) {
  const [address, setAddress] = useState(company.wallet.address ?? "");
  const [error, setError] = useState("");
  return (
    <Modal title={`Dirección de cobro · ${company.name}`} onClose={onClose}>
      <form
        className="stack-form dashboard-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await onSave(address);
          if (err) setError(err);
        }}
      >
        <label>
          Dirección EVM
          <input
            aria-label="Dirección EVM"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
          />
          <small>
            Base Sepolia · 0x y 40 caracteres hexadecimales. Vacío: pendiente de
            conexión.
          </small>
        </label>
        <p className="fine-print">
          Esta configuración no crea una wallet ni verifica su titularidad. Los
          pagos y el saldo real se conectarán en la etapa de blockchain.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" type="submit">
          Guardar dirección
          <Check size={17} />
        </button>
      </form>
    </Modal>
  );
}
function DeleteDialog({
  label,
  onClose,
  onSave,
}: {
  label: string;
  onClose: () => void;
  onSave: () => SaveResult;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title="Eliminar del catálogo" onClose={onClose}>
      <h3>{label}</h3>
      <p>
        Dejará de estar disponible para nuevas compras o canjes. Sus compras y
        beneficios emitidos permanecerán en el historial. Puedes restaurarlo
        desde el dashboard.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button dark full"
        onClick={async () => {
          const err = await onSave();
          if (err) setError(err);
        }}
      >
        <Trash2 size={17} />
        Eliminar del catálogo
      </button>
    </Modal>
  );
}
