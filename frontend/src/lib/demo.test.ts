import { describe, expect, it } from "vitest";
import { bikes, rewards } from "../data/catalog";
import {
  linkBrand,
  enterAdminDemo,
  adminAction,
  buy,
  fundDemo,
  loadDemo,
  storageKey,
  credit,
  initialDemo,
  login,
  redeem,
  register,
  useCoupon,
} from "./demo";
const phone = { region: "BO", number: "70000000" };
const maintenance = rewards.find((r) => r.id === "Zontes-service")!;
describe("RideClub demo lifecycle", () => {
  it("redeems 500 points atomically and preserves the used coupon without a second debit", () => {
    const s = initialDemo();
    const { state, coupon } = redeem(s, "demo-rider", maintenance);
    expect(s.accounts[0].points.Zontes).toBe(1000);
    expect(state.accounts[0].points.Zontes).toBe(500);
    const used = useCoupon(state, coupon.id, "Zontes", true, "Taller demo");
    expect(used.coupons[0].usedAt).toBeDefined();
    expect(used.accounts[0].points.Zontes).toBe(500);
    expect(() =>
      useCoupon(used, coupon.id, "Zontes", true, "Taller demo"),
    ).toThrow("ya fue utilizado");
  });
  it("rejects insufficient balance, another workshop brand, missing consent and expiry", () => {
    const s = initialDemo();
    expect(() =>
      redeem(
        s,
        "demo-rider",
        rewards.find((r) => r.brand === "NIU")!,
      ),
    ).toThrow("Necesitas");
    const { state, coupon } = redeem(
      s,
      "demo-rider",
      maintenance,
      new Date("2026-01-01"),
    );
    expect(() =>
      useCoupon(
        state,
        coupon.id,
        "NIU",
        true,
        "Taller",
        new Date("2026-01-02"),
      ),
    ).toThrow("otra marca");
    expect(() =>
      useCoupon(
        state,
        coupon.id,
        "Zontes",
        false,
        "Taller",
        new Date("2026-01-02"),
      ),
    ).toThrow("autoriza");
    expect(() =>
      useCoupon(
        state,
        coupon.id,
        "Zontes",
        true,
        "Taller",
        new Date("2026-04-01"),
      ),
    ).toThrow("vencido");
  });
  it("does not issue a coupon after the last demo slot is taken", () => {
    const one = { ...maintenance, stock: 1 };
    const demo = initialDemo();
    demo.catalogRewards = demo.catalogRewards.map((reward) =>
      reward.id === one.id ? one : reward,
    );
    const { state } = redeem(demo, "demo-rider", one);
    expect(() => redeem(state, "demo-rider", one)).toThrow("agotó");
    expect(state.coupons).toHaveLength(1);
  });
  it("creates unique eight-digit referral numbers and no blockchain wallet or initial points", () => {
    let s = register(
      initialDemo(),
      "Ana",
      " ANA@example.com ",
      phone,
      "10002026",
      "NIU",
    );
    const ana = s.accounts[1];
    expect(ana.email).toBe("ana@example.com");
    expect(ana.code).toMatch(/^\d{8}$/);
    expect(ana.wallet.status).toBe("ready");
    expect(ana.wallet.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(ana.points.NIU).toBe(0);
    s = register(s, "Luis", "luis@example.com", phone, "", "NIU");
    expect(s.accounts[2].code).not.toBe(ana.code);
    expect(() =>
      register(s, "Ana", "ana@example.com", phone, "", "NIU"),
    ).toThrow("ya tiene");
    expect(() =>
      register(s, "Eva", "eva@example.com", phone, "99999999", "NIU"),
    ).toThrow("No encontramos");
    expect(login(s, "ana@example.com").currentId).toBe(ana.id);
  });
  it("rewards the inviter only after a confirmed activity and prevents repeat referral awards", () => {
    const s = register(
      initialDemo(),
      "Ana",
      "ana@example.com",
      phone,
      "10002026",
      "NIU",
    );
    const ana = s.accounts[1];
    expect(s.accounts[0].points.NIU).toBe(0);
    expect(() => credit(s, ana.id, "NIU", "Referido", "SALE-1", false)).toThrow(
      "Confirma",
    );
    const next = credit(s, ana.id, "NIU", "Referido", "SALE-1", true);
    expect(next.accounts[0].points.NIU).toBe(200);
    expect(next.accounts[1].points.NIU).toBe(0);
    expect(() =>
      credit(next, ana.id, "NIU", "Referido", "SALE-2", true),
    ).toThrow("ya recibió");
  });
  it("rejects duplicate references per brand even for different customers", () => {
    const s = register(
      initialDemo(),
      "Ana",
      "ana@example.com",
      phone,
      "",
      "NIU",
    );
    const credited = credit(
      s,
      s.accounts[1].id,
      "NIU",
      "Compra",
      "invoice-2",
      true,
    );
    expect(credited.accounts[1].points.NIU).toBe(1000);
    expect(() =>
      credit(credited, "demo-rider", "NIU", "Compra", " INVOICE-2 ", true),
    ).toThrow("ya fue acreditada");
    expect(
      credit(credited, "demo-rider", "Kiden", "Compra", "INVOICE-2", true)
        .accounts[0].points.Kiden,
    ).toBe(1000);
  });
});

describe("phone, simulated purchases and migration", () => {
  it("registers a normalized phone with a linked brand and client role", () => {
    const s = register(
      initialDemo(),
      "Ana",
      "ana@example.com",
      phone,
      "",
      "NIU",
    );
    expect(s.accounts[1].phone).toBe("+59170000000");
    expect(s.accounts[1].balanceUSDT).toBe(20000);
    expect(s.accounts[1].brand).toBe("NIU");
    expect(s.accounts[1].role).toBe("client");
    expect(() =>
      register(
        s,
        "Eva",
        "eva@example.com",
        { region: "BO", number: "123" },
        "",
        "NIU",
      ),
    ).toThrow("celular");
    expect(
      register(
        s,
        "Eva",
        "eva@example.com",
        { region: "US", number: "2025550123" },
        "",
        "NIU",
      ).accounts[2].phone,
    ).toBe("+12025550123");
  });
  it("debits USDT and awards points with a receipt, safely retrying a checkout", () => {
    const s = initialDemo();
    const { state, purchase } = buy(s, "demo-rider", "z703f", "CHECKOUT-1");
    expect(state.accounts[0].balanceUSDT).toBe(8510);
    expect(state.accounts[0].points.Zontes).toBe(2000);
    expect(state.purchases).toEqual([purchase]);
    expect(s.accounts[0].balanceUSDT).toBe(20000);
    expect(buy(state, "demo-rider", "z703f", "CHECKOUT-1").state).toBe(state);
    expect(() => buy(state, "demo-rider", "nnqi", "CHECKOUT-1")).toThrow(
      "otra compra",
    );
    expect(() => buy(state, "demo-rider", "z703f", "CHECKOUT-2")).toThrow(
      "insuficiente",
    );
    const unpriced = bikes.find((b) => !b.price)!;
    expect(() => buy(s, "demo-rider", unpriced.id, "CHECKOUT-3")).toThrow(
      "cotización",
    );
    expect(fundDemo(state, "demo-rider").accounts[0].balanceUSDT).toBe(28510);
  });
  it("automatically awards a referral on the first checkout only, across brands and admin validation", () => {
    const s = register(
      initialDemo(),
      "Ana",
      "ana@example.com",
      phone,
      "10002026",
      "NIU",
    );
    const ana = s.accounts[1];
    const first = buy(s, ana.id, "nnqi", "A").state;
    expect(first.accounts[0].points.NIU).toBe(200);
    expect(first.accounts[1].points.NIU).toBe(1000);
    const second = buy(first, ana.id, "zgk200", "B").state;
    expect(second.accounts[0].points.Zontes).toBe(1000);
    expect(() =>
      credit(second, ana.id, "Zontes", "Referido", "ADMIN-3", true),
    ).toThrow("ya recibió");
    expect(() =>
      credit(second, ana.id, "NIU", "Compra", first.purchases[0].id, true),
    ).toThrow("ya fue acreditada");
  });
  it("preserves existing accounts and coupons, funds legacy accounts once and restores purchases", () => {
    const legacy = redeem(initialDemo(), "demo-rider", maintenance).state;
    const old = JSON.parse(JSON.stringify(legacy));
    delete old.accounts[0].balanceUSDT;
    delete old.purchases;
    const storage = { getItem: () => JSON.stringify(old) };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    const migrated = loadDemo();
    expect(migrated.accounts[0].balanceUSDT).toBe(20000);
    expect(migrated.accounts[0].points.Zontes).toBe(500);
    expect(migrated.coupons).toEqual(legacy.coupons);
    const purchased = buy(migrated, "demo-rider", "z703f", "MIGRATION").state;
    storage.getItem = () => JSON.stringify(purchased);
    expect(loadDemo().accounts[0].balanceUSDT).toBe(8510);
    expect(loadDemo().purchases).toEqual(purchased.purchases);
    expect(storageKey).toBe("rideclub-demo-v1");
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});

describe("linked profiles and demo roles", () => {
  it("requires a valid brand and can update a legacy profile without changing its balances", () => {
    const s = { ...initialDemo(), currentId: "demo-rider" };
    expect(() =>
      register(s, "Ana", "ana@example.com", phone, "", "Other" as never),
    ).toThrow("marca vinculada");
    const next = linkBrand(s, "demo-rider", "Kiden");
    expect(next.accounts[0].brand).toBe("Kiden");
    expect(next.accounts[0].points).toEqual(s.accounts[0].points);
    expect(next.accounts[0].balanceUSDT).toBe(20000);
    expect(() =>
      linkBrand({ ...s, currentId: null }, "demo-rider", "NIU"),
    ).toThrow("Inicia sesión");
  });
  it("keeps client data when switching to admin and rejects admin actions from a client", () => {
    const s = { ...initialDemo(), currentId: "demo-rider" };
    expect(() =>
      adminAction(s, (s) =>
        credit(s, "demo-rider", "NIU", "Compra", "INV-ROLE", true),
      ),
    ).toThrow("administrador");
    const admin = enterAdminDemo(s);
    expect(admin.accounts[0]).toEqual(s.accounts[0]);
    expect(admin.accounts.find((a) => a.id === admin.currentId)?.role).toBe(
      "admin",
    );
    expect(enterAdminDemo(admin).accounts).toHaveLength(2);
    const credited = adminAction(admin, (s) =>
      credit(s, "demo-rider", "NIU", "Compra", "INV-ROLE", true),
    );
    expect(credited.accounts[0].points.NIU).toBe(1000);
    expect(login(credited, "manuel@rideclub.demo").currentId).toBe(
      "demo-rider",
    );
  });
  it("migrates missing role and brand without resetting a profile, and preserves its saved brand", () => {
    const old = JSON.parse(JSON.stringify(initialDemo()));
    delete old.accounts[0].role;
    const storage = { getItem: () => JSON.stringify(old) };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    });
    expect(loadDemo().accounts[0].role).toBe("client");
    expect(loadDemo().accounts[0].brand).toBe("Zontes");
    delete old.accounts[0].brand;
    expect(loadDemo().accounts[0].brand).toBeUndefined();
    expect(loadDemo().accounts[0].points.Zontes).toBe(1000);
    expect(loadDemo().accounts[0].code).toBe("10002026");
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
