import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Mail,
  ShieldCheck,
  Users,
  Wallet,
  LogIn,
} from "lucide-react";
import { type Brand } from "../data/catalog";
import { phoneRegions, type PhoneInput } from "../lib/phone";
import type { Account } from "../lib/demo";
import { useCatalog } from "../data/CatalogContext";
import { Modal } from "./ui";
export default function Auth({
  onClose,
  onRegister,
  onLogin,
  onDemo,
  onAdminDemo,
  created,
  error,
  notice,
  backendMode = false,
  initialMode = "register",
}: {
  onClose: () => void;
  onRegister: (
    name: string,
    email: string,
    phone: PhoneInput,
    code: string,
    brand: Brand,
  ) => void | Promise<void>;
  onLogin: (email: string) => void | Promise<void>;
  onDemo: () => void;
  onAdminDemo: () => void;
  created?: Account;
  error: string;
  notice?: string;
  backendMode?: boolean;
  initialMode?: "register" | "login";
}) {
  const { brands, companies } = useCatalog();
  const [login, setLogin] = useState(initialMode === "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [brand, setBrand] = useState<Brand | "">("");
  const [region, setRegion] = useState("BO");
  const [phone, setPhone] = useState("");
  const country = phoneRegions.find((r) => r.code === region)!;
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get("ref") ?? "",
  );
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (login) await onLogin(email);
      else
        await onRegister(
          name,
          email,
          { region, number: phone },
          code,
          brand as Brand,
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        created
          ? "Ya eres parte de RideClub"
          : login
            ? "Vuelve a tu club"
            : "Tu próxima ruta empieza aquí"
      }
      onClose={onClose}
    >
      {created ? (
        <div className="auth-success">
          <div className="success-mark">
            <Check size={30} />
          </div>
          <h3>Bienvenido, {created.name}.</h3>
          <p>
            Tu cuenta de demo está lista.
            <br />
            Este es tu número para invitar a otros riders:
          </p>
          <strong className="ref-number">{created.code}</strong>
          <div className="setup-list">
            <span>
              <Check size={18} /> Perfil y número de referido creados
            </span>
            <span>
              <Check size={18} /> Celular: {created.phone}
            </span>
            <span>
              <Check size={18} /> Perfil cliente vinculado a {created.brand}
            </span>
            <span>
              <Wallet size={18} /> Wallet preparada para Base Sepolia
            </span>
          </div>
          <p className="fine-print">
            La wallet se creará automáticamente al conectar el servicio de
            cuentas por correo en la siguiente etapa. En esta demo aún no existe
            una wallet ni claves reales.
          </p>
          <button className="button primary full" onClick={onClose}>
            Entrar a mi club <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="auth-tabs">
            <button
              className={!login ? "active" : ""}
              onClick={() => setLogin(false)}
            >
              Crear cuenta
            </button>
            <button
              className={login ? "active" : ""}
              onClick={() => setLogin(true)}
            >
              Iniciar sesión
            </button>
          </div>
          <p className="auth-description">
            {login
              ? "Ingresa con tu correo de cliente o el correo de acceso de tu empresa."
              : "Un correo, un club y muchas razones para seguir rodando."}
          </p>
          <form onSubmit={submit} className="stack-form">
            {!login && (
              <label>
                Tu nombre
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="¿Cómo te llamas?"
                  minLength={2}
                  maxLength={60}
                  required
                />
              </label>
            )}
            <label>
              Correo electrónico
              <div className="input-with-icon">
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  maxLength={160}
                  required
                />
              </div>
            </label>
            {!login && (
              <>
                <label>
                  Marca vinculada
                  <select
                    aria-label="Marca vinculada"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value as Brand)}
                    required
                  >
                    <option value="" disabled>
                      Selecciona tu marca
                    </option>
                    {brands.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                  <small>
                    Elige una empresa del club. Puedes explorar y comprar en
                    todas las empresas aprobadas.
                  </small>
                </label>
                <label>
                  Región
                  <select
                    aria-label="Región"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    autoComplete="country"
                  >
                    {phoneRegions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name} ({r.prefix})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Número de celular
                  <div className="phone-input">
                    <span>{country.prefix}</span>
                    <input
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, ""))
                      }
                      minLength={country.min}
                      maxLength={country.max}
                      pattern={`[0-9]{${country.min},${country.max}}`}
                      placeholder={
                        region === "BO" ? "70000000" : "Número sin prefijo"
                      }
                      required
                    />
                  </div>
                  <small>
                    Ingresa el número sin {country.prefix}. No se envía SMS en
                    esta demo.
                  </small>
                </label>
                <label>
                  Número de referido <span className="optional">Opcional</span>
                  <div className="input-with-icon">
                    <Users size={17} />
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      title="Introduce un número de 8 dígitos"
                      maxLength={8}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="Ej. 10002026"
                    />
                  </div>
                  <small>
                    ¿Un amigo te invitó? Ingresa su número de 8 dígitos. También
                    puedes registrarte sin uno.
                  </small>
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" required />
                  <span>
                    Entiendo que estoy creando una cuenta de demostración.
                  </span>
                </label>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="proposal-note" role="status">
                <Check size={18} /> {notice}
              </p>
            )}
            <button className="button primary full" type="submit" disabled={busy}>
              {busy
                ? "Enviando enlace…"
                : login
                  ? backendMode
                    ? "Enviar enlace de acceso"
                    : "Entrar a mi club"
                  : backendMode
                    ? "Crear y verificar mi cuenta"
                    : "Crear mi cuenta"}
              <ArrowRight size={18} />
            </button>
          </form>
          {!backendMode && (
            <>
              <div className="auth-demo">
                <span>¿Solo quieres explorar?</span>
                <button onClick={onDemo}>
                  <LogIn size={16} /> Entrar a la demo de Manuel
                </button>
              </div>
              <button className="admin-demo-login" onClick={onAdminDemo}>
                <ShieldCheck size={16} /> Entrar como administrador demo
              </button>
            </>
          )}
          {!backendMode && login && (
            <div className="company-demo-emails">
              <strong>Accesos de empresas · demo</strong>
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setEmail(c.email);
                  }}
                >
                  {c.email}
                </button>
              ))}
            </div>
          )}
          <div className="auth-footnote">
            <ShieldCheck size={16} />
            <span>
              {backendMode
                ? "Te enviaremos un enlace seguro al correo. Las cuentas bloqueadas o dadas de baja no pueden acceder a datos privados ni operar en RideClub."
                : "Frontend de demo: los datos existen solo en este perfil del navegador. Una ventana normal y una ventana de incógnito no comparten cuentas. No verifica el correo ni crea una sesión segura."}
            </span>
          </div>
        </>
      )}
    </Modal>
  );
}
