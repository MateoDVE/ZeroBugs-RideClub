import { type CSSProperties } from "react";
import { ArrowRight, Coins, Clock, Ticket, ArrowUpRight } from "lucide-react";
import { type Brand, type Reward } from "../data/catalog";
import { useCatalog } from "../data/CatalogContext";
import type { Account, Coupon } from "../lib/demo";
import { BrandLogo, fmt, Modal, RewardIcon, SectionHead } from "./ui";
export default function Rewards({
  filter,
  setFilter,
  account,
  coupons,
  onSelect,
  onJoin,
  staffMode = false,
}: {
  filter: Brand | "Todas";
  setFilter: (b: Brand | "Todas") => void;
  account?: Account;
  coupons: Coupon[];
  onSelect: (r: Reward) => void;
  onJoin: () => void;
  staffMode?: boolean;
}) {
  const { brands, rewards, brandInfo } = useCatalog();
  const selectedCompany = filter === "Todas" ? undefined : brandInfo[filter];
  return (
    <section
      className={`page-section rewards-page ${selectedCompany ? "brand-context-page" : ""}`}
      style={
        selectedCompany
          ? ({ "--brand-accent": selectedCompany.color } as CSSProperties)
          : undefined
      }
    >
      <div className="page-intro">
        <span className="eyebrow">BIENVENIDO AL LADO BUENO DE RODAR</span>
        <h1>
          {selectedCompany ? `Tus tokens ${filter}.` : "Tus tokens."}
          <br />
          <em>
            {selectedCompany
              ? selectedCompany.subtitle
              : "Tu próxima recompensa."}
          </em>
        </h1>
        <p>
          Cuida tu moto, completa tu equipo y vuelve al camino.
          <br />
          Quema tokens de cada marca y recibe un NFT de beneficio de un solo uso.
        </p>
      </div>
      <div className="rewards-summary">
        <div>
          <Coins size={23} />
          <span>
            {account
              ? "Tokens disponibles en tu wallet"
              : staffMode
                ? "Sesión de administración activa"
                : "Beneficios por marca"}
            <small>
              {staffMode
                ? "Puedes revisar el catálogo y volver a tu dashboard cuando quieras."
                : "Cada saldo pertenece a un token distinto."}
            </small>
          </span>
        </div>
        {account ? (
          <div className="balance-chips">
            {brands.map((b) => (
              <span key={b}>
                {b} Token
                <strong>{fmt(account.points[b])}</strong>
              </span>
            ))}
          </div>
        ) : (
          <button className="button dark" onClick={onJoin}>
            {staffMode ? "Volver al dashboard" : "Crear cuenta"} <ArrowUpRight size={17} />
          </button>
        )}
      </div>
      <SectionHead eyebrow="ALGO BUENO TE ESPERA" title="Elige tu beneficio.">
        <span className="count-label">Canje único / cupón digital</span>
      </SectionHead>
      <div className="brand-tabs reward-tabs">
        {(["Todas", ...brands] as const).map((b) => (
          <button
            key={b}
            className={filter === b ? "active" : ""}
            onClick={() => setFilter(b)}
          >
            {b}
            {filter === b && <span />}
          </button>
        ))}
      </div>
      {selectedCompany && (
        <div
          className="brand-focus-banner rewards-brand-focus"
          style={{ "--brand-accent": selectedCompany.color } as CSSProperties}
        >
          <div>
            <span className="eyebrow">BENEFICIOS {filter.toUpperCase()}</span>
            <h2>{selectedCompany.subtitle}</h2>
            <p>Estos tokens y beneficios pertenecen exclusivamente al ecosistema {filter}.</p>
          </div>
          <BrandLogo brand={filter} />
        </div>
      )}
      <div className="reward-grid">
        {rewards
          .filter((r) => filter === "Todas" || r.brand === filter)
          .map((r) => {
            const left =
              r.stock - coupons.filter((c) => c.rewardId === r.id).length;
            return (
              <article
                className={`reward-card brand-product-card ${r.brand.toLowerCase()}`}
                key={r.id}
                style={{
                  "--brand-accent": brandInfo[r.brand]?.color ?? "#c6f46a",
                } as CSSProperties}
              >
                <div className={`reward-art ${r.image ? "with-photo" : ""}`}>
                  {r.image && (
                    <img className="reward-cover" src={r.image} alt={r.title} />
                  )}
                  <span className="reward-icon">
                    <RewardIcon kind={r.kind} size={46} />
                  </span>
                  <BrandLogo brand={r.brand} />
                  <span className="reward-art-word" aria-hidden="true">
                    {r.kind === "service"
                      ? "CARE"
                      : r.kind === "parts"
                        ? "GEAR"
                        : "RIDE"}
                  </span>
                  <span className="category-tag">{r.category}</span>
                </div>
                <div className="reward-info">
                  <span className="eyebrow muted">
                    {r.brand} / CUPÓN DE UN SOLO USO
                  </span>
                  <h3>{r.title}</h3>
                  <p>{r.detail}</p>
                  <div className="reward-meta">
                    <span>
                      <Clock size={14} />
                      {r.days} días de vigencia
                    </span>
                    <span>{left} cupos demo</span>
                  </div>
                  <div className="reward-bottom">
                    <strong>
                      <Coins size={19} />
                      {fmt(r.points)} <small>{r.brand} Token</small>
                    </strong>
                    <button
                      className="button small dark"
                      onClick={() => onSelect(r)}
                      disabled={left <= 0}
                    >
                      {left <= 0 ? "Agotado" : "Ver beneficio"}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
export function RewardDetail({
  reward,
  account,
  onClose,
  onConfirm,
  onJoin,
  error,
  submitting,
}: {
  reward: Reward;
  account?: Account;
  onClose: () => void;
  onConfirm: () => void;
  onJoin: () => void;
  error: string;
  submitting: boolean;
}) {
  const balance = account?.points[reward.brand] ?? 0;
  return (
    <Modal title="Tu próxima recompensa" onClose={onClose}>
      <div className="reward-dialog-top">
        <span className="reward-icon">
          <RewardIcon kind={reward.kind} size={39} />
        </span>
        <BrandLogo brand={reward.brand} />
      </div>
      <h3 className="dialog-title">{reward.title}</h3>
      <p>{reward.detail}</p>
      <div className="redeem-calculation">
        <div>
          <span>Costo del beneficio</span>
          <strong>
            {fmt(reward.points)} {reward.brand} Token
          </strong>
        </div>
        {account && (
          <>
            <div>
              <span>Tu saldo disponible</span>
              <strong>{fmt(balance)} {reward.brand} Token</strong>
            </div>
            <div>
              <span>Saldo después del canje</span>
              <strong>
                {fmt(Math.max(0, balance - reward.points))} {reward.brand} Token
              </strong>
            </div>
          </>
        )}
      </div>
      <h4>Qué incluye y cómo usarlo</h4>
      <p className="fine-print">
        {reward.terms} Válido durante {reward.days} días desde el canje, en un
        establecimiento participante de {reward.brand}. Cupón personal, sin
        transferencias.
      </p>
      <div className="notice">
        <Ticket size={23} />
        <span>
          Recibes un cupón de un solo uso.
          <small>
            En el taller, el cliente confirma y el empleado valida su uso. El
            cupón queda en tu historial.
          </small>
        </span>
      </div>
      <p className="fine-print">
        Beneficio propuesto. Canje simulado; la emisión del NFT en Base Sepolia
        se conectará en la próxima etapa.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {account && balance < reward.points && (
        <p className="form-error">
          Te faltan {fmt(reward.points - balance)} {reward.brand} Token.
        </p>
      )}
      <button
        className="button primary full"
        disabled={submitting || (!!account && balance < reward.points)}
        onClick={account ? onConfirm : onJoin}
      >
        {submitting
          ? "Procesando canje…"
          : account
          ? `Quemar ${fmt(reward.points)} tokens y mintear NFT`
          : "Únete al club para canjear"}
        <ArrowRight size={18} />
      </button>
    </Modal>
  );
}
