import type { CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Check,
  Gift,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import type { Brand } from "../data/catalog";
import { useCatalog } from "../data/CatalogContext";
import { BrandLogo, fmt } from "./ui";

export default function Landing({
  onMarketplace,
  onRewards,
  onJoin,
  onBrand,
}: {
  onMarketplace: () => void;
  onRewards: () => void;
  onJoin: () => void;
  onBrand: (brand: Brand, destination: "marketplace" | "rewards") => void;
}) {
  const { brands, bikes, rewards, brandInfo } = useCatalog();
  const featured = bikes[0];
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">MOTOS, PUNTOS Y BENEFICIOS EN UN SOLO CLUB</span>
          <h1>
            Tu moto te lleva lejos.
            <em> RideClub te da más.</em>
          </h1>
          <p>
            Descubre motos de distintas marcas, suma puntos por tu relación con
            cada empresa y canjéalos por servicios, repuestos y experiencias.
          </p>
          <div className="landing-actions">
            <button className="button primary" onClick={onMarketplace}>
              Ver marketplace <ArrowUpRight size={18} />
            </button>
            <button className="button secondary" onClick={onRewards}>
              Explorar recompensas <Gift size={17} />
            </button>
          </div>
          <div className="landing-trust">
            <span><Check size={15} /> {brands.length} empresas vinculadas</span>
            <span><Check size={15} /> {bikes.length} motos publicadas</span>
            <span><Check size={15} /> {rewards.length} beneficios disponibles</span>
          </div>
        </div>
        <div className="landing-hero-visual">
          <span className="landing-watermark">RIDE</span>
          {featured && (
            <img src={featured.image} alt={`${featured.brand} ${featured.name}`} />
          )}
          <div className="landing-featured-card">
            <span>MOTO DESTACADA</span>
            <strong>{featured?.brand} {featured?.name}</strong>
            <button onClick={onMarketplace}>Conocerla <ArrowRight size={15} /></button>
          </div>
        </div>
      </section>

      <section className="landing-how">
        <div>
          <span className="eyebrow">ASÍ FUNCIONA</span>
          <h2>Una experiencia sencilla, con beneficios reales.</h2>
        </div>
        <div className="landing-steps">
          <article><span>01</span><Users /><h3>Únete</h3><p>Crea tu perfil y elige la empresa con la que quieres comenzar.</p></article>
          <article><span>02</span><ShoppingBag /><h3>Suma</h3><p>Compra una moto o registra actividades confirmadas con la marca.</p></article>
          <article><span>03</span><Gift /><h3>Canjea</h3><p>Usa tus puntos en recompensas exclusivas de esa empresa.</p></article>
        </div>
      </section>

      <section className="landing-brands">
        <div className="landing-section-heading">
          <div>
            <span className="eyebrow">CADA MARCA, SU PROPIO MUNDO</span>
            <h2>Elige cómo quieres rodar.</h2>
          </div>
          <p>Catálogo, colores, puntos y beneficios diferenciados para cada empresa.</p>
        </div>
        <div className="landing-brand-grid">
          {brands.map((brand) => {
            const companyBikes = bikes.filter((bike) => bike.brand === brand);
            const companyRewards = rewards.filter((reward) => reward.brand === brand);
            const offer = companyBikes[0];
            const benefit = companyRewards[0];
            const info = brandInfo[brand];
            return (
              <article
                key={brand}
                className="landing-brand-card"
                style={{ "--brand-accent": info.color } as CSSProperties}
              >
                <div className="landing-brand-top">
                  <BrandLogo brand={brand} />
                  <span>{companyBikes.length} motos · {companyRewards.length} beneficios</span>
                </div>
                <h3>{info.subtitle}</h3>
                {offer && (
                  <div className="landing-brand-offer">
                    <img src={offer.image} alt={`${brand} ${offer.name}`} />
                    <span>
                      <small>DESTACADA</small>
                      <strong>{offer.name}</strong>
                      <b>{offer.price ? `${fmt(offer.price)} USDT` : "Precio a consultar"}</b>
                    </span>
                  </div>
                )}
                {benefit && (
                  <p><Sparkles size={15} /> {benefit.title} desde {fmt(benefit.points)} puntos</p>
                )}
                <div className="landing-brand-actions">
                  <button onClick={() => onBrand(brand, "marketplace")}>
                    Ver motos <Bike size={15} />
                  </button>
                  <button onClick={() => onBrand(brand, "rewards")}>
                    Ver beneficios <Gift size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <span className="eyebrow">TU PRÓXIMA RUTA EMPIEZA AQUÍ</span>
          <h2>Compra, suma y vuelve por más.</h2>
          <p>Un solo perfil para descubrir empresas y administrar tus puntos por marca.</p>
        </div>
        <button className="button primary" onClick={onJoin}>
          Crear mi cuenta <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}
