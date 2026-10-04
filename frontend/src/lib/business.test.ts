import { describe, expect, it } from "vitest";
import {
  applyPointExpirations,
  buy,
  enterAdminDemo,
  initialDemo,
  loadDemo,
  login,
} from "./demo";
import {
  readBusiness,
  saveBike,
  saveClient,
  saveCompany,
  savePointRules,
  saveReward,
} from "./business";

describe("RideClub business dashboards", () => {
  it("lets the global admin register and publish a company", () => {
    const admin = enterAdminDemo(initialDemo());
    const next = saveCompany(admin, {
      name: "Demo Motors",
      email: "empresa@demo.com",
      subtitle: "Muévete diferente",
      logo: "/assets/motorcycle-placeholder.svg",
      color: "#123456",
      url: "https://example.com",
      status: "active",
    });
    expect(next.companies.find((c) => c.name === "Demo Motors")?.status).toBe(
      "active",
    );
    expect(next.audit[0].action).toBe("Empresa registrada");
  });

  it("creates a company session from its assigned email and scopes its data", () => {
    let state = enterAdminDemo(initialDemo());
    state = saveCompany(state, {
      name: "Demo Motors",
      email: "empresa@demo.com",
      subtitle: "Muévete diferente",
      logo: "/assets/motorcycle-placeholder.svg",
      color: "#123456",
      url: "https://example.com",
      status: "active",
    });
    state = login(state, "empresa@demo.com");
    const view = readBusiness(state);
    expect(view.companies.map((c) => c.name)).toEqual(["Demo Motors"]);
    expect(() => readBusiness(state, "Zontes")).toThrow(
      "No puedes consultar otra empresa",
    );
  });

  it("prevents a company from adding a motorcycle to another company", () => {
    const state = login(initialDemo(), "zontes@gmail.com");
    const niu = state.companies.find((c) => c.name === "NIU")!;
    expect(() =>
      saveBike(state, niu.id, {
        name: "Modelo ajeno",
        category: "Urbana",
        tag: "Demo",
        description: "No debe poder guardarse",
        image: "/assets/motorcycle-placeholder.svg",
        price: 1000,
        source: "https://example.com",
        region: "Bolivia",
        specs: [],
      }),
    ).toThrow("No tienes acceso");
  });

  it("applies company-specific point values and expiration dates", () => {
    let state = login(initialDemo(), "zontes@gmail.com");
    const zontes = state.companies.find((company) => company.name === "Zontes")!;
    state = savePointRules(state, zontes.id, {
      ...zontes.pointRules,
      Compra: { points: 750, expiryDays: 30 },
    });
    state = login(state, "manuel@rideclub.demo");
    const result = buy(state, "demo-rider", "z703f", "CUSTOM-RULE");
    expect(result.purchase.points).toBe(750);
    const activity = result.state.activities.find(
      (item) => item.reference === result.purchase.id && item.kind === "Compra",
    )!;
    expect(
      Math.round(
        (new Date(activity.expiresAt!).getTime() -
          new Date(activity.date).getTime()) /
          86400000,
      ),
    ).toBe(30);
  });

  it("expires earned points and preserves a trace in the activity history", () => {
    const state = initialDemo();
    const future = new Date(Date.now() + 366 * 86400000);
    const expired = applyPointExpirations(state, future);
    expect(expired.accounts[0].points.Zontes).toBe(0);
    expect(expired.activities[0].label).toBe("Vencimiento de puntos");
    expect(applyPointExpirations(expired, future).accounts[0].points.Zontes).toBe(
      0,
    );
  });

  it("lets a company create and edit its client, and blocks subsequent access", () => {
    let state = login(initialDemo(), "niu@gmail.com");
    state = saveClient(state, {
      name: "Cliente prueba",
      email: "cliente@demo.com",
      phone: "+59170000001",
      brand: "NIU",
      status: "active",
    });
    const client = state.accounts.find(
      (account) => account.email === "cliente@demo.com",
    )!;
    expect(login(state, "cliente@demo.com").currentId).toBe(client.id);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => JSON.stringify(state) },
    });
    expect(login(loadDemo(), "cliente@demo.com").currentId).toBe(client.id);
    delete (globalThis as { localStorage?: unknown }).localStorage;
    state = login(state, "niu@gmail.com");
    state = saveClient(
      state,
      { ...client, name: "Cliente actualizado", status: "blocked" },
      client.id,
    );
    expect(state.accounts.find((account) => account.id === client.id)?.name).toBe(
      "Cliente actualizado",
    );
    expect(() => login(state, "cliente@demo.com")).toThrow("bloqueada");
  });

  it("lets the global administrator manage clients and loyalty for every company", () => {
    let state = enterAdminDemo(initialDemo());
    const zontes = state.companies.find((company) => company.name === "Zontes")!;
    state = saveClient(state, {
      name: "Cliente prueba",
      email: "cliente@demo.com",
      phone: "+59170000001",
      brand: "Zontes",
      status: "active",
    });
    expect(state.accounts.some((account) => account.email === "cliente@demo.com")).toBe(true);
    state = savePointRules(state, zontes.id, {
      ...zontes.pointRules,
      Evento: { points: 90, expiryDays: 180 },
    });
    expect(state.companies.find((company) => company.id === zontes.id)?.pointRules.Evento.points).toBe(90);
  });

  it("keeps the maintenance rule and published service reward synchronized", () => {
    let state = login(initialDemo(), "zontes@gmail.com");
    const zontes = state.companies.find((company) => company.name === "Zontes")!;
    state = savePointRules(state, zontes.id, {
      ...zontes.pointRules,
      Mantenimiento: { points: 900, expiryDays: 365 },
    });
    expect(state.catalogRewards.find((reward) => reward.id === "Zontes-service")?.points).toBe(900);
    const service = state.catalogRewards.find((reward) => reward.id === "Zontes-service")!;
    state = saveReward(state, zontes.id, { ...service, points: 700 }, service.id);
    expect(state.companies.find((company) => company.id === zontes.id)?.pointRules.Mantenimiento.points).toBe(700);
  });

  it("prevents a company from changing clients registered under another brand", () => {
    let state = login(initialDemo(), "niu@gmail.com");
    expect(() =>
      saveClient(
        state,
        {
          name: "Manuel",
          email: "manuel@rideclub.demo",
          phone: "+59170000000",
          brand: "NIU",
          status: "active",
        },
        "demo-rider",
      ),
    ).toThrow("tu empresa");
  });
});
