import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestLogin, requestPasswordReset, requestRegistration, updatePassword } from "./api";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("./client", () => ({ supabaseClient: () => ({ auth }) }));

beforeEach(() => {
  vi.resetAllMocks();
  for (const method of Object.values(auth)) method.mockResolvedValue({ error: null });
  vi.stubGlobal("window", { location: { origin: "https://rideclub.example" } });
});
afterEach(() => vi.unstubAllGlobals());

describe("autenticación con contraseña", () => {
  it("registra el correo normalizado y conserva la contraseña exacta", async () => {
    await requestRegistration({ name: " Ana ", email: " ANA@EXAMPLE.COM ", password: " pass1234 ", phone: "+59170000000", brand: "Zontes" });
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "ana@example.com", password: " pass1234 ",
      options: expect.objectContaining({ emailRedirectTo: "https://rideclub.example/?auth=callback" }),
    }));
  });
  it("propaga el rechazo de credenciales", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Credenciales inválidas" } });
    await expect(requestLogin(" ANA@EXAMPLE.COM ", "incorrecta")).rejects.toThrow("Credenciales inválidas");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "ana@example.com", password: "incorrecta" });
  });
  it("redirige la recuperación sin interferir con el hash de sesión", async () => {
    await requestPasswordReset(" ANA@EXAMPLE.COM ");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("ana@example.com", { redirectTo: "https://rideclub.example/?auth=recovery" });
  });
  it("propaga un error al actualizar la contraseña", async () => {
    auth.updateUser.mockResolvedValue({ error: { message: "Sesión vencida" } });
    await expect(updatePassword("nueva1234")).rejects.toThrow("Sesión vencida");
  });
});
