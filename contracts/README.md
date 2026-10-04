# Contratos RideClub

Base de contratos para representar el flujo que hoy se demuestra como mockup en el frontend:

1. `MockUSDT`: saldo de prueba con 6 decimales; nunca debe confundirse con USDT real.
2. `BrandLoyaltyToken`: un token no transferible distinto por empresa.
3. `RewardNFT`: NFT no transferible con estado `valid = true/false`.
4. `RideClubManager`: envía el pago a la treasury de la empresa, mintea tokens, los quema al canjear y emite/consume el NFT.

## Preparación local

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge build
```

## Modelo de permisos

- `owner`: wallet operadora de RideClub; para producción debe ser una multisig.
- `company.treasury`: recibe el pago y puede validar el consumo de sus NFTs.
- `user`: aprueba USDT, compra, recibe tokens de esa marca y los quema para canjear.

Estos contratos son un punto de partida de hackathon. Aún no están desplegados, conectados al frontend ni auditados. Antes de usar fondos reales faltan pruebas unitarias, firmas/multisig, pausas de emergencia, gestión segura de metadata y auditoría externa.
