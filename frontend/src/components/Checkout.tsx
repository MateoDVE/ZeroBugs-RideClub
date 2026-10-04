import { ArrowRight, Check, Coins, Wallet } from "lucide-react";
import type { Bike } from "../data/catalog";
import type { Account, Purchase } from "../lib/demo";
import { useCatalog } from "../data/CatalogContext";
import { BrandLogo, fmt, Modal } from "./ui";
export default function Checkout({
  bike,
  account,
  error,
  purchase,
  onClose,
  onConfirm,
  onClub,
}: {
  bike: Bike;
  account: Account;
  error: string;
  purchase?: Purchase;
  onClose: () => void;
  onConfirm: () => void;
  onClub: () => void;
}) {
  const { allCompanies } = useCatalog();
  const purchasePoints =
    purchase?.points ??
    allCompanies.find((company) => company.name === bike.brand)?.pointRules
      .Compra.points ??
    1000;
  return (
    <Modal
      title={
        purchase
          ? "Compra de prueba completada"
          : "Tu próxima moto · compra demo"
      }
      onClose={onClose}
    >
      <div className="checkout">
        <img
          className="checkout-photo"
          src={bike.image}
          alt={`${bike.brand} ${bike.name}`}
        />
        <BrandLogo brand={bike.brand} />
        <h3>
          {bike.brand} {bike.name}
        </h3>
        {purchase ? (
          <div className="purchase-success">
            <Check size={24} />
            <strong>¡Se mintearon {fmt(purchasePoints)} {bike.brand} Token!</strong>
          </div>
        ) : (
          <p>Prueba el recorrido completo con tu saldo USDT de demostración.</p>
        )}
        <dl className="checkout-summary">
          <div>
            <dt>{purchase ? "Total descontado" : "Precio de prueba"}</dt>
            <dd>{fmt(purchase?.amountUSDT ?? bike.price!)} USDT</dd>
          </div>
          <div>
            <dt>
              <Wallet size={16} /> Saldo {purchase ? "actual" : "disponible"}
            </dt>
            <dd>{fmt(account.balanceUSDT)} USDT</dd>
          </div>
          {!purchase && (
            <div>
              <dt>Saldo después de comprar</dt>
              <dd>
                {account.balanceUSDT < bike.price!
                  ? "Saldo insuficiente"
                  : `${fmt(account.balanceUSDT - bike.price!)} USDT`}
              </dd>
            </div>
          )}
          <div>
            <dt>
              <Coins size={16} />{" "}
              {purchase ? "Tokens minteados" : "Recibes con esta compra"}
            </dt>
            <dd>+{fmt(purchasePoints)} {bike.brand}</dd>
          </div>
          {purchase && (
            <div>
              <dt>Saldo de {bike.brand} Token</dt>
              <dd>
                {fmt(account.points[bike.brand] ?? 0)} {bike.brand}
              </dd>
            </div>
          )}
        </dl>
        {purchase && <code className="coupon-code">{purchase.id}</code>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="fine-print">
          Flujo blockchain simulado: el USDT demo se transfiere a la empresa y
          la wallet operadora mintea los tokens de la marca. No se mueve dinero
          real ni se reserva una moto.
        </p>
        <button
          className="button primary full"
          disabled={!purchase && account.balanceUSDT < bike.price!}
          onClick={purchase ? onClub : onConfirm}
        >
          {purchase
            ? "Ver mi saldo y mis compras"
            : "Confirmar compra de prueba"}
          <ArrowRight size={18} />
        </button>
        {!purchase && account.balanceUSDT < bike.price! && (
          <button className="button secondary full" onClick={onClub}>
            Ir a Mi club para recargar
          </button>
        )}
      </div>
    </Modal>
  );
}
