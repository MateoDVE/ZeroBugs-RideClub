export const phoneRegions = [
  { code: "BO", name: "Bolivia", prefix: "+591", min: 8, max: 8 },
  { code: "AR", name: "Argentina", prefix: "+54", min: 10, max: 11 },
  { code: "CL", name: "Chile", prefix: "+56", min: 9, max: 9 },
  { code: "PE", name: "Perú", prefix: "+51", min: 9, max: 9 },
  { code: "CO", name: "Colombia", prefix: "+57", min: 10, max: 10 },
  { code: "BR", name: "Brasil", prefix: "+55", min: 10, max: 11 },
  { code: "EC", name: "Ecuador", prefix: "+593", min: 9, max: 9 },
  { code: "MX", name: "México", prefix: "+52", min: 10, max: 10 },
  { code: "US", name: "Estados Unidos", prefix: "+1", min: 10, max: 10 },
  { code: "ES", name: "España", prefix: "+34", min: 9, max: 9 },
] as const;
export type PhoneInput = { region: string; number: string };
export function normalizePhone(phone: PhoneInput): string {
  const region = phoneRegions.find((r) => r.code === phone.region);
  const number = phone.number.replace(/[\s()-]/g, "");
  if (
    !region ||
    !/^\d+$/.test(number) ||
    number.length < region.min ||
    number.length > region.max
  )
    throw Error(
      "Revisa la región y el número de celular, sin el prefijo internacional.",
    );
  return region.prefix + number;
}
