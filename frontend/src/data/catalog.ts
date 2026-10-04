export const brands = ["Zontes", "NIU", "Kiden"] as const;
export type Brand = string;
export type Bike = {
  id: string;
  brand: Brand;
  name: string;
  category: string;
  tag: string;
  description: string;
  image: string;
  price?: number;
  source: string;
  region: string;
  specs: [string, string][];
  archived?: boolean;
};
export const brandInfo: Record<
  Brand,
  { logo: string; subtitle: string; color: string; url: string }
> = {
  Zontes: {
    logo: "/assets/zontes-logo.png",
    subtitle: "Tecnología que abre caminos",
    color: "#c6f46a",
    url: "https://zontesbolivia.com/",
  },
  NIU: {
    logo: "/assets/niu-logo.png",
    subtitle: "La ciudad se mueve en eléctrico",
    color: "#ff6d6d",
    url: "https://niubolivia.com/",
  },
  Kiden: {
    logo: "/assets/kiden-logo.png",
    subtitle: "Tu ritmo. Tus propias reglas.",
    color: "#ffb86b",
    url: "https://m.kiden.cn/",
  },
};
export const bikes: Bike[] = [
  {
    id: "z703f",
    brand: "Zontes",
    name: "703F",
    category: "Adventure",
    tag: "Sin límites",
    description:
      "Una adventure de tres cilindros para descubrir lo que hay más allá del asfalto.",
    image: "/assets/zontes-703f.jpg",
    price: 11490,
    source: "https://zontesbolivia.com/moto/zontes-703f/",
    region: "Catálogo Bolivia",
    specs: [
      ["Motor", "699 cc"],
      ["Transmisión", "6 velocidades"],
      ["Seguridad", "ABS doble canal"],
      ["Tanque", "22 litros"],
    ],
  },
  {
    id: "zgk350",
    brand: "Zontes",
    name: "GK350",
    category: "Scrambler",
    tag: "Espíritu libre",
    description:
      "Diseño scrambler, inyección Bosch y una personalidad que se reconoce a primera vista.",
    image: "/assets/zontes-gk350.jpg",
    price: 6500,
    source: "https://zontesbolivia.com/moto/zontes-gk350/",
    region: "Catálogo Bolivia",
    specs: [
      ["Motor", "348 cc"],
      ["Potencia", "29 kW"],
      ["Seguridad", "ABS doble canal"],
      ["Tanque", "17 litros"],
    ],
  },
  {
    id: "zgk200",
    brand: "Zontes",
    name: "GK200",
    category: "Scrambler",
    tag: "Hazla tuya",
    description:
      "Una compañera ágil para la ciudad, con iluminación LED y frenos ABS.",
    image: "/assets/zontes-gk200.jpg",
    price: 4190,
    source: "https://zontesbolivia.com/moto/zontes-gk200/",
    region: "Catálogo Bolivia",
    specs: [
      ["Motor", "198 cc"],
      ["Potencia", "16,1 kW"],
      ["Seguridad", "ABS doble canal"],
      ["Transmisión", "6 velocidades"],
    ],
  },
  {
    id: "nnqi",
    brand: "NIU",
    name: "NQi Sport MY26",
    category: "Eléctrica",
    tag: "Make life electric",
    description:
      "Movilidad urbana eléctrica con batería extraíble y conectividad desde tu teléfono.",
    image: "/assets/niu-nqi-sport.webp",
    price: 2490,
    source: "https://niubolivia.com/item/nqi-sport-my26/",
    region: "Catálogo Bolivia",
    specs: [
      ["Autonomía", "Hasta 50 km"],
      ["Velocidad", "25 / 45 km/h"],
      ["Batería", "NIU Energy™"],
      ["Transmisión", "Automática"],
    ],
  },
  {
    id: "nnqix300",
    brand: "NIU",
    name: "NQiX 300 MY26",
    category: "Eléctrica",
    tag: "Redefine tu ciudad",
    description:
      "Doble batería y tecnología conectada para ampliar tus recorridos de cada día.",
    image: "/assets/niu-nqix300.webp",
    price: 3590,
    source: "https://niubolivia.com/item/nqix-300-my26/",
    region: "Catálogo Bolivia",
    specs: [
      ["Autonomía", "Hasta 140 km"],
      ["Potencia máxima", "4.100 W"],
      ["Seguridad", "ABS / TCS"],
      ["Baterías", "2 × 28 Ah"],
    ],
  },
  {
    id: "nnqix500",
    brand: "NIU",
    name: "NQiX 500 MY26",
    category: "Eléctrica",
    tag: "Más lejos, más libre",
    description:
      "La alternativa eléctrica de alto rendimiento en el catálogo NIU Bolivia.",
    image: "/assets/niu-nqix500.webp",
    price: 4500,
    source: "https://niubolivia.com/item/nqix-500-my26/",
    region: "Catálogo Bolivia",
    specs: [
      ["Autonomía", "Hasta 140 km"],
      ["Velocidad", "Hasta 100 km/h"],
      ["Potencia máxima", "9.900 W"],
      ["Transmisión", "Automática"],
    ],
  },
  {
    id: "k150z",
    brand: "Kiden",
    name: "KD150-Z",
    category: "Naked",
    tag: "Tu día, a tu manera",
    description:
      "Una naked orientada a los trayectos diarios. Referencia de MotoFun Argentina.",
    image: "/assets/kiden-kd150z.jpg",
    source: "https://motofun.com.ar/product/kiden-kd150-z/",
    region: "Referencia Argentina",
    specs: [
      ["Segmento", "Naked"],
      ["Motor", "Gasolina"],
      ["Uso", "Urbano"],
      ["Disponibilidad Bolivia", "Por confirmar"],
    ],
  },
  {
    id: "k250v",
    brand: "Kiden",
    name: "KD250-V",
    category: "Naked",
    tag: "Retro, muy actual",
    description:
      "Estética retro con inyección electrónica, horquilla invertida y frenos de disco.",
    image: "/assets/kiden-kd250v.jpg",
    source: "https://motofun.com.ar/product/kd250-v/",
    region: "Referencia Argentina",
    specs: [
      ["Inyección", "Electrónica"],
      ["Suspensión", "Horquilla invertida"],
      ["Frenos", "Disco"],
      ["Disponibilidad Bolivia", "Por confirmar"],
    ],
  },
  {
    id: "k150gk",
    brand: "Kiden",
    name: "KD150-GK",
    category: "Scrambler",
    tag: "Deja tu propia huella",
    description:
      "Una scrambler con motor refrigerado por agua, encendido sin llave y ABS.",
    image: "/assets/kiden-kd150gk.jpg",
    source:
      "https://m.kiden.cn/shopmall/products/ModelsDetailed.aspx?Cid=59B3FE3E912CFBC6",
    region: "Catálogo internacional",
    specs: [
      ["Motor", "150 cc"],
      ["Potencia", "14 kW"],
      ["Seguridad", "ABS doble canal"],
      ["Disponibilidad Bolivia", "Por confirmar"],
    ],
  },
];
export type Reward = {
  id: string;
  brand: Brand;
  title: string;
  kind: "service" | "parts" | "care";
  category: string;
  points: number;
  detail: string;
  terms: string;
  days: number;
  stock: number;
  image?: string;
  archived?: boolean;
};
export const rewards: Reward[] = brands.flatMap((brand) => [
  {
    id: `${brand}-service`,
    brand,
    title: brand === "NIU" ? "Diagnóstico eléctrico" : "Mantenimiento básico",
    kind: "service" as const,
    category: "Servicio",
    points: 500,
    detail:
      brand === "NIU"
        ? "Revisión de batería, frenos y sistema eléctrico. Cuida la energía de tu próxima ruta."
        : "Revisión general y mano de obra de mantenimiento preventivo. Tu moto lista para la próxima ruta.",
    terms:
      brand === "NIU"
        ? "Una revisión de diagnóstico. No incluye reparación, batería ni repuestos."
        : "Una revisión y ajuste preventivo. No incluye aceite, consumibles ni repuestos.",
    days: 60,
    stock: 20,
  },
  {
    id: `${brand}-parts`,
    brand,
    title:
      brand === "NIU" ? "Accesorios para tu NIU" : "Repuestos para tu moto",
    kind: "parts" as const,
    category: brand === "NIU" ? "Accesorios" : "Repuestos",
    points: 350,
    detail:
      "Un 10% de descuento en una compra de productos compatibles. Completa tu experiencia sobre dos ruedas.",
    terms:
      "10% sobre una compra de hasta 100 USDT (máximo 10 USDT de descuento). Sujeto a compatibilidad y disponibilidad; no acumulable.",
    days: 30,
    stock: 30,
  },
  {
    id: `${brand}-care`,
    brand,
    title: "Limpieza y revisión",
    kind: "care" as const,
    category: "Cuidado",
    points: 250,
    detail:
      "Una puesta a punto visual y limpieza exterior para volver a salir con todo.",
    terms:
      "Limpieza exterior y revisión visual. No incluye reparación, desmontaje ni tratamiento especializado.",
    days: 30,
    stock: 25,
  },
]);
export const pointsRules = {
  Compra: 1000,
  Mantenimiento: 500,
  Referido: 200,
  Evento: 50,
} as const;
export type ActivityKind = keyof typeof pointsRules;
