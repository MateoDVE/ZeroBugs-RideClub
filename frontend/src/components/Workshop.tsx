import { useState, type FormEvent } from "react";
import {
  BarChart3,
  Coins,
  Ticket,
  Users,
  Check,
  Download,
  Wrench,
} from "lucide-react";
import { type Brand, type ActivityKind } from "../data/catalog";
import { useCatalog } from "../data/CatalogContext";
import type { Demo } from "../lib/demo";
import { date, fmt, SectionHead } from "./ui";
export default function Workshop({
  state,
  couponCode,
  onCredit,
  onUse,
  onExport,
  companyBrand,
}: {
  state: Demo;
  couponCode: string;
  onCredit: (
    accountId: string,
    brand: Brand,
    kind: ActivityKind,
    ref: string,
    confirmed: boolean,
  ) => boolean | Promise<boolean>;
  onUse: (
    id: string,
    brand: Brand,
    confirmed: boolean,
    workshop: string,
  ) => boolean | Promise<boolean>;
  onExport: () => void;
  companyBrand?: Brand;
}) {
  const { allCompanies } = useCatalog();
  const brands = companyBrand
    ? [companyBrand]
    : allCompanies.map((c) => c.name);
  const clients = state.accounts.filter((a) => a.role === "client");
  const [client, setClient] = useState(clients[0]?.id ?? "");
  const [brand, setBrand] = useState<Brand>(companyBrand ?? "Zontes");
  const [kind, setKind] = useState<ActivityKind>("Mantenimiento");
  const [ref, setRef] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState(couponCode);
  const [useBrand, setUseBrand] = useState<Brand>(
    state.coupons.find((c) => c.id === couponCode)?.brand ?? "Zontes",
  );
  const [consent, setConsent] = useState(false);
  const [workshop, setWorkshop] = useState("Taller RideClub · demo");
  const [result, setResult] = useState("");
  const [creditResult, setCreditResult] = useState("");
  const activeRules =
    allCompanies.find((company) => company.name === brand)?.pointRules ??
    allCompanies[0]?.pointRules;
  const referenceExample =
    kind === "Mantenimiento"
      ? "Ej. ORDEN-TALLER-2026-002"
      : kind === "Referido"
        ? "Ej. REFERIDO-COMPRA-002"
        : "Ej. EVENTO-OCTUBRE-002";
  const clientLabel =
    kind === "Referido"
      ? "Cliente referido que realizó su compra"
      : kind === "Evento"
        ? "Cliente que asistió"
        : "Cliente que recibió el servicio";
  const creditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await onCredit(client, brand, kind, ref, confirmed)) {
      setRef("");
      setConfirmed(false);
      setCreditResult(
        "Actividad acreditada. El saldo y el historial del cliente ya se actualizaron.",
      );
    }
  };
  const useSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await onUse(code.trim().toUpperCase(), useBrand, consent, workshop)) {
      setConsent(false);
      setResult(
        "Cupón utilizado. Se conserva en el historial y un segundo uso será rechazado.",
      );
    }
  };
  const c = state.coupons.find((c) => c.id === code.trim().toUpperCase());
  return (
    <section className="page-section workshop-page">
      <div className="page-intro">
        <span className="eyebrow">EL OTRO LADO DE LA EXPERIENCIA</span>
        <h1>
          El club, en tus manos<span className="lime">.</span>
        </h1>
        <p>
          Registra actividades y acompaña al cliente en su próximo beneficio.
        </p>
      </div>
      <div className="proposal-note">
        <Wrench size={20} />
        <span>
          <strong>Panel operativo.</strong> Solo una empresa autorizada o la
          administración global puede acreditar puntos y validar cupones.
        </span>
      </div>
      <div className="metrics">
        {[
          [Users, clients.length, "Riders en el club"],
          [
            Coins,
            state.accounts.reduce(
              (s, a) => s + brands.reduce((n, b) => n + a.points[b], 0),
              0,
            ),
            "Puntos disponibles",
          ],
          [
            Ticket,
            state.coupons.filter(
              (c) => !c.usedAt && new Date(c.expiresAt) > new Date(),
            ).length,
            "Cupones disponibles",
          ],
          [
            BarChart3,
            state.coupons.filter((c) => c.usedAt).length,
            "Beneficios utilizados",
          ],
        ].map(([Icon, n, label]) => {
          const I = Icon as typeof Users;
          return (
            <div className="metric" key={label as string}>
              <I size={22} />
              <strong>{fmt(n as number)}</strong>
              <span>{label as string}</span>
            </div>
          );
        })}
      </div>
      <div className="workshop-forms">
        <form className="panel stack-form" onSubmit={creditSubmit}>
          <div className="panel-heading">
            <Coins size={24} />
            <div>
              <span className="eyebrow">CADA ACTIVIDAD SUMA</span>
              <h2>Registrar actividad y sumar puntos</h2>
            </div>
          </div>
          <p className="fine-print workshop-explanation">
            Usa este formulario cuando la empresa verifica una actividad que
            ocurrió fuera de la página, como un mantenimiento, un referido o
            un evento. Las compras de motos suman puntos automáticamente.
          </p>
          <label>
            {clientLabel}
            <select
              aria-label="Cliente"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            >
              {clients.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.email}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Marca
              <select
                aria-label="Marca"
                value={brand}
                onChange={(e) => setBrand(e.target.value as Brand)}
              >
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              Actividad
              <select
                aria-label="Actividad"
                value={kind}
                onChange={(e) => setKind(e.target.value as ActivityKind)}
              >
                {Object.keys(activeRules ?? {})
                  .filter((k) => k !== "Compra")
                  .map((k) => (
                  <option key={k}>{k}</option>
                  ))}
              </select>
              <small>
                Selecciona qué actividad comprobó la empresa. El valor se toma
                de las reglas de puntos configuradas para {brand}.
              </small>
            </label>
          </div>
          <div className="award-summary">
            <span>Puntos propuestos</span>
            <strong>
              +{fmt(activeRules?.[kind].points ?? 0)} {brand}
              <small>Vencen en {activeRules?.[kind].expiryDays ?? 365} días</small>
            </strong>
          </div>
          {kind === "Referido" && (
            <p className="fine-print">
              Selecciona al cliente invitado cuya compra se confirmó. Los {activeRules?.Referido.points ?? 0}
              puntos se acreditarán a quien lo refirió; solo una recompensa por invitado.
            </p>
          )}
          <label>
            Código único de respaldo
            <input
              value={ref}
              onChange={(e) => {
                setRef(e.target.value);
                setCreditResult("");
              }}
              required
              minLength={3}
              maxLength={80}
              placeholder={referenceExample}
            />
            <small>
              Puede ser el número de orden del taller, registro del evento o
              comprobante interno. No tiene que ser una factura. Cada código
              solo puede utilizarse una vez por marca para evitar duplicados.
            </small>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            <span>Confirmo que la empresa verificó esta actividad.</span>
          </label>
          {creditResult && (
            <p role="status" className="form-success">
              <Check size={16} />
              {creditResult}
            </p>
          )}
          <button className="button dark full" type="submit">
            Sumar +{fmt(activeRules?.[kind].points ?? 0)} {brand} Token
            <Coins size={18} />
          </button>
        </form>
        <form className="panel stack-form" onSubmit={useSubmit}>
          <div className="panel-heading">
            <Ticket size={24} />
            <div>
              <span className="eyebrow">UN BENEFICIO. UN SOLO USO.</span>
              <h2>Validar cupón</h2>
            </div>
          </div>
          <label>
            Código de cupón
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setResult("");
              }}
              required
              placeholder="RC-…"
            />
          </label>
          <label>
            O selecciona un cupón de la demo
            <select
              aria-label="Seleccionar cupón"
              value={state.coupons.some((x) => x.id === code) ? code : ""}
              onChange={(e) => {
                setCode(e.target.value);
                setUseBrand(
                  state.coupons.find((x) => x.id === e.target.value)?.brand ??
                    "Zontes",
                );
                setResult("");
              }}
            >
              <option value="">Selecciona un cupón</option>
              {state.coupons.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.brand} · {x.title} · {x.usedAt ? "Utilizado" : "Emitido"} ·{" "}
                  {x.id.slice(0, 11)}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Marca del taller
              <select
                aria-label="Marca del taller"
                value={useBrand}
                onChange={(e) => setUseBrand(e.target.value as Brand)}
              >
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              Nombre del taller
              <input
                value={workshop}
                onChange={(e) => setWorkshop(e.target.value)}
                maxLength={80}
                required
              />
            </label>
          </div>
          {c && (
            <div className="coupon-preview">
              <strong>{c.title}</strong>
              <span>
                {state.accounts.find((a) => a.id === c.ownerId)?.name} ·{" "}
                {c.brand}
              </span>
              <small>
                {c.usedAt
                  ? `Utilizado el ${date(c.usedAt)}`
                  : `Válido hasta ${date(c.expiresAt)}`}
              </small>
            </div>
          )}
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span>
              Comprobé al titular y el cliente autoriza usar este cupón.
            </span>
          </label>
          <p className="fine-print">
            La demo comprueba marca, vigencia y uso previo. En producción,
            titularidad y autorización deben verificarse en el servidor y el
            contrato.
          </p>
          {result && (
            <p role="status" className="form-success">
              <Check size={16} />
              {result}
            </p>
          )}
          <button type="submit" className="button primary full">
            Confirmar uso del cupón
            <Check size={18} />
          </button>
        </form>
      </div>
      <SectionHead eyebrow="MOVIMIENTOS DEL CLUB" title="Actividad reciente.">
        <button className="button secondary small" onClick={onExport}>
          <Download size={16} /> Exportar CSV
        </button>
      </SectionHead>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">
            Historial reciente de puntos acreditados a clientes
          </caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Actividad</th>
              <th scope="col">Marca</th>
              <th scope="col">Puntos</th>
              <th scope="col">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {state.activities.map((a) => (
              <tr key={a.id}>
                <td>
                  {state.accounts.find((x) => x.id === a.accountId)?.name}
                </td>
                <td>
                  {a.label.startsWith("Referido confirmado:")
                    ? "Referido confirmado"
                    : a.label}
                </td>
                <td>{a.brand}</td>
                <td className={a.points > 0 ? "positive" : ""}>
                  {a.points > 0 ? "+" : ""}
                  {fmt(a.points)}
                </td>
                <td>{date(a.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
