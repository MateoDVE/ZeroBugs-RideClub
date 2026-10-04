import { useState, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Search,
  SlidersHorizontal,
  Zap,
  ChevronRight,
  Check,
  Wrench,
  Users,
  Gift,
  Coins,
} from "lucide-react";
import { type Brand, type Bike } from "../data/catalog";
import { useCatalog } from "../data/CatalogContext";
import { BrandLogo, ExternalLink, fmt, Modal, SectionHead } from "./ui";
export function BikeCard({
  bike,
  favorite,
  onFavorite,
  onOpen,
}: {
  bike: Bike;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  const { brandInfo } = useCatalog();
  const identity = brandInfo[bike.brand];
  return (
    <article
      className="bike-card brand-product-card"
      style={{ "--brand-accent": identity?.color ?? "#c6f46a" } as CSSProperties}
    >
      <div className="bike-image">
        <span className="bike-brand-badge">
          <BrandLogo brand={bike.brand} />
        </span>
        <span
          className={`category-tag ${bike.brand === "NIU" ? "electric" : ""}`}
        >
          {bike.brand === "NIU" && <Zap size={12} />} {bike.category}
        </span>
        <button
          onClick={onFavorite}
          className={`favorite-button ${favorite ? "selected" : ""}`}
          aria-label={`${favorite ? "Quitar" : "Guardar"} ${bike.name} en favoritas`}
          aria-pressed={favorite}
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
        <button
          className="image-link"
          onClick={onOpen}
          aria-label={`Ver ${bike.brand} ${bike.name}`}
        >
          <img
            src={bike.image}
            alt={`${bike.brand} ${bike.name}`}
            loading="lazy"
          />
        </button>
      </div>
      <div className="bike-info">
        <span className="eyebrow muted">
          {bike.brand} <span> / {bike.tag}</span>
        </span>
        <button className="bike-title" onClick={onOpen}>
          {bike.name}
          <ArrowUpRight size={23} />
        </button>
        <div className="bike-specs">
          {bike.specs.slice(0, 2).map(([k, v]) => (
            <span key={k}>{v}</span>
          ))}
        </div>
        <div className="bike-price">
          <div>
            {bike.price ? (
              <>
                <strong>
                  {fmt(bike.price)} <small>USDT</small>
                </strong>
                <span>Precio de catálogo</span>
              </>
            ) : (
              <>
                <strong>Consultar precio</strong>
                <span>{bike.region} · disponibilidad local por confirmar</span>
              </>
            )}
          </div>
          <button
            className="round-button"
            onClick={onOpen}
            aria-label={`Detalles de ${bike.name}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function BikeDetail({
  bike,
  onClose,
  onReward,
  onBuy,
}: {
  bike: Bike;
  onClose: () => void;
  onReward: (brand: Brand) => void;
  onBuy: (bike: Bike) => void;
}) {
  const { allCompanies } = useCatalog();
  const purchaseRule = allCompanies.find(
    (company) => company.name === bike.brand,
  )?.pointRules.Compra;
  return (
    <Modal title={`${bike.brand} ${bike.name}`} onClose={onClose} wide>
      <div className="product-detail">
        <div className="detail-picture">
          <img src={bike.image} alt={`${bike.brand} ${bike.name}`} />
          <span className="category-tag">{bike.category}</span>
        </div>
        <div>
          <BrandLogo brand={bike.brand} />
          <h3>{bike.name}</h3>
          <p>{bike.description}</p>
          <div className="detail-price">
            {bike.price ? `${fmt(bike.price)} USDT` : "Precio a consultar"}
          </div>
          <p className="fine-print">
            {bike.region}. Precio de referencia, sujeto a confirmación
            comercial. Las compras de prueba usan saldo ficticio y no reservan
            una moto.
          </p>
          <dl className="spec-grid">
            {bike.specs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="notice">
            <Gift size={22} />
            <span>
              Tu próxima compra puede darte{" "}
              <strong>
                {fmt(purchaseRule?.points ?? 1000)} {bike.brand} Token
              </strong>
              .
              <small>
                Vencen en {purchaseRule?.expiryDays ?? 365} días; requiere
                compra confirmada por la tienda.
              </small>
            </span>
          </div>
          {bike.price && (
            <button
              className="button primary full purchase-button"
              onClick={() => onBuy(bike)}
            >
              Comprar con USDT de prueba <ArrowRight size={17} />
            </button>
          )}
          {bike.source && (
            <ExternalLink href={bike.source}>
              Consultar modelo en la tienda
            </ExternalLink>
          )}
          <button
            className="button secondary full"
            onClick={() => onReward(bike.brand)}
          >
            Explorar recompensas {bike.brand}
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
export default function Marketplace({
  filter,
  setFilter,
  favorites,
  onFavorite,
  onBike,
  onRewards,
  onJoin,
}: {
  filter: Brand | "Todas";
  setFilter: (brand: Brand | "Todas") => void;
  favorites: string[];
  onFavorite: (id: string) => void;
  onBike: (bike: Bike) => void;
  onRewards: () => void;
  onJoin: () => void;
}) {
  const { bikes, brands, brandInfo } = useCatalog();
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState("Todos");
  const [sort, setSort] = useState("featured");
  const [onlyFav, setOnlyFav] = useState(false);
  const selectedCompany = filter === "Todas" ? undefined : brandInfo[filter];
  const visible = bikes
    .filter(
      (b) =>
        (filter === "Todas" || b.brand === filter) &&
        (style === "Todos" || b.category === style) &&
        `${b.name} ${b.brand} ${b.category}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!onlyFav || favorites.includes(b.id)),
    )
    .sort((a, b) =>
      sort === "price"
        ? (a.price ?? Infinity) - (b.price ?? Infinity)
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : 0,
    );
  const showroomBrands = brands.filter((brand) =>
    visible.some((bike) => bike.brand === brand),
  );
  return (
    <div
      className={`marketplace-page ${selectedCompany ? "brand-context-page" : ""}`}
      style={
        selectedCompany
          ? ({ "--brand-accent": selectedCompany.color } as CSSProperties)
          : undefined
      }
    >
      <section id="catalogo" className="catalog-section marketplace-direct-catalog">
        <SectionHead
          eyebrow="MARKETPLACE RIDECLUB"
          title={selectedCompany ? `Motos ${filter}.` : "Todas las motos, directamente."}
        >
          <div className="marketplace-head-actions">
            <span className="count-label">
              {visible.length} modelos / {brands.length} empresas
            </span>
            <button className="button secondary small" onClick={onRewards}>
              Ver recompensas <Gift size={15} />
            </button>
          </div>
        </SectionHead>
        <div className="marketplace-brand-selector" aria-label="Filtrar por empresa">
          <button
            className={filter === "Todas" ? "active" : ""}
            onClick={() => setFilter("Todas")}
          >
            <span className="all-brands-mark">R</span>
            <span>
              <strong>Todas las motos</strong>
              <small>{bikes.length} modelos disponibles</small>
            </span>
          </button>
          {brands.map((brand) => (
            <button
              key={brand}
              className={filter === brand ? "active" : ""}
              style={{ "--brand-accent": brandInfo[brand].color } as CSSProperties}
              onClick={() => setFilter(brand)}
            >
              <BrandLogo brand={brand} />
              <span>
                <strong>{brand}</strong>
                <small>{brandInfo[brand].subtitle}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="catalog-toolbar">
          <p className="marketplace-result-label">
            {selectedCompany
              ? `Catálogo de ${filter} · ${selectedCompany.subtitle}`
              : "Catálogo de todas las empresas autorizadas"}
          </p>
          <label className="search-field">
            <Search size={18} />
            <input
              placeholder="Busca tu próxima moto"
              aria-label="Buscar motos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="filter-row">
          <div className="filter-select">
            <SlidersHorizontal size={16} />
            <label>
              Estilo
              <select
                aria-label="Estilo de moto"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                {["Todos", ...new Set(bikes.map((b) => b.category))].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <button
              className={`favorite-filter ${onlyFav ? "active" : ""}`}
              aria-pressed={onlyFav}
              onClick={() => setOnlyFav(!onlyFav)}
            >
              <Heart size={14} /> Favoritas
            </button>
          </div>
          <label className="sort-label">
            Ordenar por
            <select
              aria-label="Ordenar motos"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="featured">Destacadas</option>
              <option value="price">Precio menor a mayor</option>
              <option value="name">Nombre</option>
            </select>
          </label>
        </div>
        <div className="marketplace-showrooms">
          {showroomBrands.map((brand) => {
            const company = brandInfo[brand];
            const brandBikes = visible.filter((bike) => bike.brand === brand);
            return (
              <section
                className="brand-showroom"
                key={brand}
                style={{ "--brand-accent": company.color } as CSSProperties}
              >
                <header className="showroom-header">
                  <div className="showroom-identity">
                    <span className="showroom-logo"><BrandLogo brand={brand} /></span>
                    <span>
                      <small>SHOWROOM OFICIAL RIDECLUB</small>
                      <h2>{company.subtitle}</h2>
                    </span>
                  </div>
                  <div className="showroom-token">
                    <Coins size={18} />
                    <span>
                      TOKEN DE LA MARCA
                      <strong>{brand} Token</strong>
                    </span>
                  </div>
                  <button className="showroom-link" onClick={() => setFilter(brand)}>
                    {brandBikes.length} modelos <ArrowRight size={15} />
                  </button>
                </header>
                <div className="bike-grid showroom-grid">
                  {brandBikes.map((bike) => (
                    <BikeCard
                      key={bike.id}
                      bike={bike}
                      favorite={favorites.includes(bike.id)}
                      onFavorite={() => onFavorite(bike.id)}
                      onOpen={() => onBike(bike)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        {visible.length === 0 && (
          <div className="empty-state">
            <Search size={30} />
            <h3>No encontramos motos con esos filtros.</h3>
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setStyle("Todos");
                setFilter("Todas");
                setOnlyFav(false);
              }}
            >
              Ver todo el catálogo
            </button>
          </div>
        )}
        <p className="catalog-note">
          Modelos y precios de referencia. Zontes y NIU: catálogos Bolivia.
          Kiden: referencias internacionales; disponibilidad local por
          confirmar.
        </p>
      </section>
      <section className="club-banner">
        <div className="club-banner-copy">
          <span className="eyebrow">CADA COMPRA, UNA NUEVA RECOMPENSA</span>
          <h2>
            No solo compres una moto.
            <br />
            <em>Forma parte del club.</em>
          </h2>
          <p>
            Tus compras, tus cuidados y tus referidos suman.
            <br />
            Cámbialos por beneficios para seguir disfrutando el camino.
          </p>
          <button className="button primary" onClick={onJoin}>
            Quiero ser parte <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="steps">
          <div>
            <span>01</span>
            <Users size={21} />
            <h3>Únete</h3>
            <p>Crea tu cuenta con correo y recibe tu número de referido.</p>
          </div>
          <div>
            <span>02</span>
            <Wrench size={21} />
            <h3>Recibe tokens</h3>
            <p>Tokens separados por compras, mantenimientos y referidos.</p>
          </div>
          <div>
            <span>03</span>
            <Gift size={21} />
            <h3>Disfruta</h3>
            <p>Quema tokens, recibe un NFT y úsalo una vez en la empresa.</p>
          </div>
        </div>
      </section>
      <section className="closing-line">
        <Check size={17} />
        <span>Tu experiencia, en un solo lugar.</span>
        <span>Motos. Comunidad. Recompensas.</span>
      </section>
    </div>
  );
}
