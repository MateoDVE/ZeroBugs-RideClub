import { useEffect, useState } from "react";
import { useCatalog } from "../data/CatalogContext";
import QRCode from "qrcode";
import {
  ArrowRight,
  Copy,
  Coins,
  Gift,
  Users,
  Wallet,
  Ticket,
  ArrowUpRight,
  LogOut,
  Check,
  Clock,
  Heart,
  Wrench,
} from "lucide-react";
import { type Bike, type Brand } from "../data/catalog";
import type { Account, Activity, Coupon, Demo } from "../lib/demo";
import { BikeCard } from "./Marketplace";
import { BrandLogo, date, fmt, Modal, SectionHead } from "./ui";
export function CouponDialog({
  coupon,
  onClose,
  onWorkshop,
}: {
  coupon: Coupon;
  onClose: () => void;
  onWorkshop: (coupon: Coupon) => void;
}) {
  const { allRewards: rewards } = useCatalog();
  const [showQR, setShowQR] = useState(false);
  const [qr, setQr] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(coupon.id, {
      width: 240,
      margin: 4,
      color: { dark: "#101412", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [coupon.id]);
  const reward = rewards.find((r) => r.id === coupon.rewardId);
  const expired = new Date(coupon.expiresAt) <= new Date();
  return (
    <Modal title="Tu beneficio RideClub" onClose={onClose}>
      <div className="coupon-dialog">
        <div className={`nft-art ${coupon.usedAt ? "consumed" : ""}`}>
          <img
            src={coupon.image ?? "/assets/maintenance-benefit.webp"}
            alt={coupon.title}
          />
          <div>
            <span>RIDECLUB / BENEFICIO NFT · DEMO</span>
            <strong>{coupon.title}</strong>
            <small>
              {coupon.brand} · #{coupon.id.slice(-8)}
            </small>
          </div>
          {coupon.usedAt && <b>CONSUMIDO · QUEMA SIMULADA</b>}
        </div>
        <BrandLogo brand={coupon.brand} />
        <span className={`status-pill ${coupon.usedAt ? "used" : ""}`}>
          {coupon.usedAt ? "Utilizado" : expired ? "Vencido" : "Disponible"}
        </span>
        <h3>{coupon.title}</h3>
        <span className="fine-print">
          NFT de beneficio de un solo uso · estado simulado en Base Sepolia
        </span>
        {!coupon.usedAt && !expired && (
          <>
            <button
              className="button secondary full qr-toggle"
              onClick={() => setShowQR(!showQR)}
              aria-expanded={showQR}
            >
              {showQR
                ? "Ocultar QR de validación"
                : "Mostrar QR para el taller"}
            </button>
            {showQR &&
              (qr ? (
                <img
                  className="qr"
                  src={qr}
                  alt={`QR del cupón ${coupon.id}`}
                />
              ) : (
                <p>
                  {failed
                    ? "Usa el código del cupón para validar."
                    : "Preparando QR…"}
                </p>
              ))}
            <p>
              Muestra tu beneficio en el taller participante. Abre el QR al
              validar el servicio.
              <br />
              <small>
                El cliente debe autorizar el uso y el taller validarlo.
              </small>
            </p>
          </>
        )}
        <code className="coupon-code">{coupon.id}</code>
        <dl className="coupon-details">
          <div>
            <dt>Fecha de canje</dt>
            <dd>{date(coupon.issuedAt)}</dd>
          </div>
          <div>
            <dt>Válido hasta</dt>
            <dd>{date(coupon.expiresAt)}</dd>
          </div>
          <div>
            <dt>Tokens quemados</dt>
            <dd>
              {fmt(coupon.points)} {coupon.brand}
            </dd>
          </div>
          {coupon.usedAt && (
            <>
              <div>
                <dt>Fecha de uso</dt>
                <dd>{date(coupon.usedAt)}</dd>
              </div>
              <div>
                <dt>Taller</dt>
                <dd>{coupon.workshop}</dd>
              </div>
            </>
          )}
        </dl>
        <p className="fine-print">{coupon.terms ?? reward?.terms}</p>
        {!coupon.usedAt && !expired && (
          <button
            className="button dark full"
            onClick={() => onWorkshop(coupon)}
          >
            Probar validación en taller
            <ArrowRight size={18} />
          </button>
        )}
        <p className="fine-print">
          El QR representa el NFT de esta demostración. Al confirmar el
          servicio, la empresa cambia su estado de válido a consumido y queda
          un comprobante permanente en tu historial.
        </p>
      </div>
    </Modal>
  );
}
export default function Club({
  account,
  state,
  onJoin,
  onLogout,
  onRewards,
  onCoupon,
  onFavorite,
  onBike,
  onCopy,
  onBrand,
  onFund,
  onLinkBrand,
}: {
  account?: Account;
  state: Demo;
  onJoin: () => void;
  onLogout: () => void;
  onRewards: () => void;
  onCoupon: (c: Coupon) => void;
  onFavorite: (id: string) => void;
  onBike: (b: Bike) => void;
  onCopy: (v: string) => void;
  onBrand: (b: Brand) => void;
  onFund: () => void;
  onLinkBrand: (b: Brand) => void;
}) {
  const { brands, bikes, allBikes, allCompanies } = useCatalog();
  const referralRule = allCompanies.find(
    (company) => company.name === account?.brand,
  )?.pointRules.Referido;
  const [tab, setTab] = useState("benefits");
  const [used, setUsed] = useState(false);
  if (!account)
    return (
      <section className="join-page">
        <span className="eyebrow">TU COMUNIDAD. TU PRÓXIMA RUTA.</span>
        <div className="join-icon">
          <Users size={48} />
        </div>
        <h1>
          Todo empieza
          <br />
          con <em>ser parte.</em>
        </h1>
        <p>
          Crea tu cuenta y encuentra tus tokens, beneficios y referidos en un
          solo lugar.
        </p>
        <button className="button primary" onClick={onJoin}>
          Entrar a RideClub
          <ArrowUpRight size={19} />
        </button>
        <div className="join-perks">
          <span>
            <Coins size={20} /> Tokens por marca
          </span>
          <span>
            <Gift size={20} /> Beneficios exclusivos
          </span>
          <span>
            <Users size={20} /> Tu código de referido
          </span>
        </div>
      </section>
    );
  const coupons = state.coupons.filter((c) => c.ownerId === account.id);
  const active = coupons.filter(
    (c) => !c.usedAt && new Date(c.expiresAt) > new Date(),
  );
  const history = state.activities.filter((a) => a.accountId === account.id);
  const referrals = state.accounts.filter((a) => a.referredBy === account.code);
  const refURL = `${window.location.origin}${window.location.pathname}?ref=${account.code}#club`;
  return (
    <section className="page-section club-page">
      <div className="club-heading">
        <div>
          <span className="eyebrow">TU PRÓXIMA RUTA, CON MÁS BENEFICIOS</span>
          <h1>
            Hola, {account.name.split(" ")[0]}
            <span className="lime">.</span>
          </h1>
          <p>Qué bueno verte de vuelta en el club.</p>
        </div>
        <button className="button secondary small" onClick={onLogout}>
          <LogOut size={16} /> Salir de la demo
        </button>
      </div>
      <div className="demo-wallet-bar">
        <div className="wallet-heading">
          <Wallet size={25} />
          <span>
            WALLET DEMO CONECTADA
            <strong>
              {fmt(account.balanceUSDT)} <small>USDT</small>
            </strong>
          </span>
        </div>
        <button
          className="wallet-address"
          onClick={() => onCopy(account.wallet.address ?? "")}
          title="Copiar dirección"
        >
          <span>BASE SEPOLIA · 84532</span>
          <code>
            {account.wallet.address?.slice(0, 8)}…{account.wallet.address?.slice(-6)}
          </code>
          <Copy size={15} />
        </button>
        <p>El USDT y los tokens de lealtad se muestran como activos separados.</p>
        <button className="button secondary small" onClick={onFund}>
          Recargar 20.000 USDT demo
        </button>
      </div>
      <div className="club-dashboard">
        <div className="points-panel">
          <div className="points-top">
            <span className="eyebrow">TUS TOKENS POR MARCA</span>
            <Coins size={22} />
          </div>
          <h2 className="token-wallet-title">Activos de lealtad</h2>
          <p>Cada marca tiene su propio token. Los saldos nunca se mezclan.</p>
          <div className="brand-balances">
            {allCompanies
              .map((c) => c.name)
              .map((b) => (
                <button key={b} onClick={() => onBrand(b)}>
                  <BrandLogo brand={b} />
                  <span>{b} Token</span>
                  <strong>{fmt(account.points[b])}</strong>
                  <ArrowUpRight size={14} />
                </button>
              ))}
          </div>
          <button className="button primary full" onClick={onRewards}>
            Explorar recompensas
            <ArrowRight size={17} />
          </button>
          <span className="points-note">
            Tokens demo separados por contrato y empresa.
          </span>
        </div>
        <div className="referral-panel">
          <span className="eyebrow">LAS BUENAS RUTAS SE COMPARTEN</span>
          <Users size={28} />
          <h2>
            Invita a tu próximo
            <br />
            compañero de ruta.
          </h2>
          <p>
            Comparte tu número. Por un referido confirmado, puedes ganar{" "}
            <strong>{referralRule?.points ?? 200} tokens</strong>.
          </p>
          <button
            className="ref-copy"
            onClick={() => onCopy(account.code)}
            aria-label="Copiar número de referido"
          >
            <span>{account.code}</span>
            <Copy size={20} />
          </button>
          <button className="text-link" onClick={() => onCopy(refURL)}>
            Copiar enlace de invitación
            <ArrowUpRight size={16} />
          </button>
          <small>
            {referrals.length} riders registrados con tu código · recompensa
            después de confirmar una compra válida.
          </small>
        </div>
        <div className="profile-panel">
          <div className="profile-avatar">
            {account.name.slice(0, 1).toUpperCase()}
          </div>
          <h3>{account.name}</h3>
          <p>{account.email}</p>
          <span className="profile-phone">
            {account.phone ?? "Celular pendiente de agregar"}
          </span>
          <hr />
          <span className="eyebrow">TU WALLET</span>
          <div className="wallet-status">
            <Wallet size={21} />
            <span>
              Base Sepolia<small>Wallet demo activa · chain 84532</small>
            </span>
          </div>
          <button
            className="profile-wallet-address"
            onClick={() => onCopy(account.wallet.address ?? "")}
          >
            <code>{account.wallet.address}</code>
            <Copy size={14} />
          </button>
          <p className="fine-print">
            Esta dirección demo se crea junto con tu cuenta y se mantiene
            estable para representar tus activos blockchain.
          </p>
          <span className="demo-badge">Cuenta de demostración</span>
          <div className="profile-affiliation">
            <span className="profile-role">
              Rol: {account.role === "admin" ? "Administrador" : "Cliente"}
            </span>
            <label>
              Marca vinculada
              <select
                aria-label="Marca vinculada al perfil"
                value={account.brand ?? ""}
                onChange={(e) => onLinkBrand(e.target.value as Brand)}
              >
                <option value="" disabled>
                  Selecciona tu marca
                </option>
                {account.brand && !brands.includes(account.brand) && (
                  <option value={account.brand} disabled>
                    {account.brand} · sin publicación
                  </option>
                )}
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            {account.brand ? (
              <BrandLogo brand={account.brand} />
            ) : (
              <small>Vincula tu perfil para completar tu registro.</small>
            )}
          </div>
        </div>
      </div>
      <div className="club-tabs">
        {[
          ["benefits", "Mis beneficios", Ticket],
          ["activity", "Actividad", Clock],
          ["purchases", "Mis compras", Wallet],
          ["favorites", "Favoritas", Heart],
          ["referrals", "Referidos", Users],
        ].map(([key, label, Icon]) => {
          const I = Icon as typeof Ticket;
          return (
            <button
              key={key as string}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key as string)}
            >
              <I size={17} />
              {label as string}
              {key === "benefits" && <span>{active.length}</span>}
            </button>
          );
        })}
      </div>
      {tab === "benefits" && (
        <>
          <SectionHead
            eyebrow="LISTOS PARA LA PRÓXIMA RUTA"
            title="Tus beneficios."
          >
            <div className="segmented">
              <button
                className={!used ? "active" : ""}
                onClick={() => setUsed(false)}
              >
                Disponibles ({active.length})
              </button>
              <button
                className={used ? "active" : ""}
                onClick={() => setUsed(true)}
              >
                Utilizados y vencidos
              </button>
            </div>
          </SectionHead>
          <div className="coupon-grid">
            {(used
              ? coupons.filter(
                  (c) => c.usedAt || new Date(c.expiresAt) <= new Date(),
                )
              : active
            ).map((c) => (
              <button
                className="coupon-card"
                key={c.id}
                onClick={() => onCoupon(c)}
              >
                <div>
                  <BrandLogo brand={c.brand} />
                  <span className={`status-pill ${c.usedAt ? "used" : ""}`}>
                    {c.usedAt
                      ? "Utilizado"
                      : new Date(c.expiresAt) <= new Date()
                        ? "Vencido"
                        : "Disponible"}
                  </span>
                </div>
                <img
                  className="benefit-thumbnail"
                  src={c.image ?? "/assets/maintenance-benefit.webp"}
                  alt={c.title}
                />
                <h3>{c.title}</h3>
                <p>
                  {c.usedAt
                    ? `Utilizado el ${date(c.usedAt)}`
                    : `Válido hasta ${date(c.expiresAt)}`}
                </p>
                <span className="text-link">
                  Ver beneficio
                  <ArrowUpRight size={16} />
                </span>
              </button>
            ))}
          </div>
          {(used ? coupons.length - active.length : active.length) === 0 && (
            <Empty
              title={
                used
                  ? "Tu historial de beneficios empieza aquí."
                  : "Tu próxima recompensa te espera."
              }
              text={
                used
                  ? "Los cupones utilizados o vencidos se conservarán en esta sección."
                  : "Quema tus tokens y encuentra aquí tus NFTs disponibles."
              }
              onClick={onRewards}
            />
          )}
        </>
      )}
      {tab === "purchases" && (
        <>
          <SectionHead
            eyebrow="TU GARAGE EMPIEZA AQUÍ"
            title="Tus compras de prueba."
          />
          <div className="purchase-list">
            {state.purchases
              .filter((p) => p.ownerId === account.id)
              .map((p) => (
                <article className="purchase-row" key={p.id}>
                  <img
                    src={allBikes.find((b) => b.id === p.bikeId)?.image}
                    alt={`${p.brand} ${p.model}`}
                  />
                  <div>
                    <strong>
                      {p.brand} {p.model}
                    </strong>
                    <span>{date(p.createdAt)} · Compra simulada</span>
                    <code>{p.id}</code>
                  </div>
                  <div className="purchase-totals">
                    <strong>{fmt(p.amountUSDT)} USDT demo</strong>
                    <span>
                      +{fmt(p.points)} {p.brand} Token
                    </span>
                  </div>
                </article>
              ))}
            {!state.purchases.some((p) => p.ownerId === account.id) && (
              <Empty
                title="Tu primera compra te espera."
                text="Elige una moto con precio en el marketplace y usa tu saldo de prueba."
              />
            )}
          </div>
        </>
      )}
      {tab === "activity" && (
        <>
          <SectionHead
            eyebrow="CADA EXPERIENCIA CUENTA"
            title="Tu actividad."
          />
          <div className="activity-list">
            {history.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
            {history.length === 0 && (
              <Empty
                title="Aún no tienes movimientos."
                text="Tus compras y canjes aparecerán aquí."
                onClick={onRewards}
              />
            )}
          </div>
        </>
      )}
      {tab === "favorites" && (
        <>
          <SectionHead
            eyebrow="MOTOS QUE TE HACEN MIRAR DOS VECES"
            title="Tu lista de deseos."
          />
          <div className="bike-grid">
            {bikes
              .filter((b) => account.favorites.includes(b.id))
              .map((b) => (
                <BikeCard
                  key={b.id}
                  bike={b}
                  favorite
                  onFavorite={() => onFavorite(b.id)}
                  onOpen={() => onBike(b)}
                />
              ))}
          </div>
          {account.favorites.length === 0 && (
            <Empty
              title="Guarda esa moto que te gusta."
              text="Pulsa el corazón en el catálogo para tenerla siempre a mano."
            />
          )}
        </>
      )}
      {tab === "referrals" && (
        <>
          <SectionHead
            eyebrow="TU COMUNIDAD CRECE CONTIGO"
            title="Tus referidos."
          />
          <div className="notice">
            <Users size={24} />
            <span>
              Registrarse no acredita tokens automáticamente.
              <small>
                La primera compra de prueba mintea {referralRule?.points ?? 200} tokens al rider que
                invitó. Esos tokens vencen en {referralRule?.expiryDays ?? 365} días.
              </small>
            </span>
          </div>
          <div className="activity-list">
            {referrals.map((a) => (
              <div className="activity-row" key={a.id}>
                <div className="activity-icon">
                  <Users size={21} />
                </div>
                <div>
                  <strong>{a.name}</strong>
                  <span>
                    {a.brand
                      ? `Perfil vinculado a ${a.brand}`
                      : "Marca pendiente de vincular"}
                  </span>
                </div>
                <span className="status-pill">
                  {state.activities.some(
                    (x) =>
                      x.kind === "Referido" &&
                      x.label === `Referido confirmado: ${a.id}`,
                  )
                    ? "Premiado"
                    : "Pendiente de compra"}
                </span>
              </div>
            ))}
          </div>
          {referrals.length === 0 && (
            <Empty
              title="Tu primer compañero aún está por llegar."
              text="Comparte tu código o enlace de invitación para empezar."
            />
          )}
        </>
      )}
    </section>
  );
}
function Empty({
  title,
  text,
  onClick,
}: {
  title: string;
  text: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <Gift size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onClick && (
        <button className="button secondary" onClick={onClick}>
          Explorar beneficios
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function ActivityRow({ activity: a }: { activity: Activity }) {
  return (
    <div className="activity-row">
      <div className="activity-icon">
        {a.points > 0 ? (
          <Coins size={21} />
        ) : a.points < 0 ? (
          <Ticket size={21} />
        ) : (
          <Check size={21} />
        )}
      </div>
      <div>
        <strong>
          {a.label.startsWith("Referido confirmado:")
            ? "Referido confirmado"
            : a.label}
        </strong>
        <span>
          {date(a.date)} · {a.brand}
          {a.points > 0 && a.expiresAt && (
            <> · {a.expiredAt ? "Vencidos" : `Vencen ${date(a.expiresAt)}`}</>
          )}
        </span>
      </div>
      <strong className={a.points > 0 ? "positive" : ""}>
        {a.points > 0 ? "+" : ""}
        {fmt(a.points)}
        <small> {a.brand} Token</small>
      </strong>
    </div>
  );
}
