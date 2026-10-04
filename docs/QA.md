# Verificación de RideClub

Fecha: 3 de octubre de 2026. Actualización de frontend y backend Supabase.

## Comprobaciones de código

- `npm run build`: TypeScript y compilación Vite completadas.
- `npm test`: veinticinco pruebas Vitest completadas.
- `git diff --check`: sin errores de espacios.
- `npx supabase test db`: prueba de esquema disponible en `supabase/tests/database.test.sql`; requiere Docker/Supabase CLI y se ejecuta después de `supabase db reset`.

Las pruebas cubren canje y consumo de un solo uso, saldo por marca, vigencia, consentimiento, cupos, registro y referido, teléfonos regionales, compras con descuento USDT y puntos atómicos, saldo insuficiente, modelos sin precio, reintentos idempotentes, recargas y migración de cuentas anteriores. También validan marcas, actualización del perfil sin pérdida de saldo, roles cliente/administrador/empresa, aislamiento entre empresas, control global del administrador, CRUD empresarial de clientes, inicio de sesión de una cuenta creada y persistida, bloqueo de acceso, sincronización entre mantenimiento y recompensa, reglas de puntos por empresa y vencimiento trazable. Comprueban que no se repone saldo gastado al recargar y que un referido no se premia dos veces, incluso entre marcas o después de una confirmación manual del taller.

## Recorrido real de navegador

Chromium headless con Playwright. Resultado: **PASS**, sin errores de JavaScript.

1. El botón superior **Iniciar sesión** abre el ingreso por correo. El registro exige seleccionar una marca vinculada (Zontes, NIU o Kiden).
2. Cambio de región Estados Unidos (+1) a Bolivia (+591); registro con celular local de ocho dígitos y referido `10002026` y marca NIU. El perfil guarda la marca y el rol cliente; vincular Kiden desde Mi club conserva saldos.
3. La cuenta nueva guarda `+59170000000`, recibe 20.000 USDT ficticios y empieza con cero puntos.
4. En una pantalla de 1.978 px, el margen lateral de Mi club mide 48 px.
5. Compra de Zontes 703F por 11.490 USDT de prueba: saldo 8.510, 1.000 puntos Zontes al comprador y 200 al invitador.
6. Comprobante mostrado en **Mis compras**. Recargar el navegador conserva compra y saldos.
7. Recarga demo: el saldo pasa de 8.510 a 28.510 USDT ficticios.
8. Canje de mantenimiento por 500 puntos: saldo resultante 500. Tarjeta con foto cargada, marca y estado. El QR está oculto inicialmente y se despliega al solicitarlo.
9. El cliente no ve formularios operativos. El acceso con la cuenta de la empresa permite el uso autorizado en el taller; segundo intento con nueva autorización rechazado, sin otro descuento de puntos.
10. Al volver al correo del cliente, el beneficio sigue en **Utilizados y vencidos**, marcado **Consumido · quema simulada**, sin un QR reutilizable.
11. Migración de un estado anterior sin saldo USDT ni compras: añade 20.000 USDT de prueba y conserva cuenta, puntos y cupón usado.
12. Las cuatro vistas (`marketplace`, `club`, `recompensas`, `taller`) revisadas a 360, 390, 768 y 1.978 px: 16 combinaciones sin desbordamiento horizontal ni imágenes locales rotas.
13. Perfil móvil: el celular y la información de wallet ocupan filas separadas. La pestaña de compras muestra el comprobante y los totales sin desbordamiento.

14. Exportación CSV permitida desde la cuenta administradora; el selector de clientes excluye a administradores.

## Accesibilidad

- Enlace visible al enfocarse para saltar directamente al contenido principal.
- Foco visible en enlaces, botones, campos y selectores.
- El cambio de vista mueve el foco al contenido nuevo sin alterar la navegación durante una actualización Realtime.
- Los diálogos nativos reciben el foco, se cierran con `Escape`, anuncian un título único y lo devuelven al control que los abrió.
- Navegación principal con `aria-current`; formularios con etiquetas; errores y confirmaciones con regiones `alert`/`status`.
- Tablas administrativas, CSV y taller con descripción accesible y encabezados de columna.
- Animaciones y desplazamiento desactivados cuando el sistema solicita movimiento reducido.
- Imágenes informativas con texto alternativo y controles de icono con nombre accesible.

Capturas del frontend ejecutado: [registro con marca](preview-registration.jpg), [escritorio](preview-desktop.jpg), [móvil](preview-mobile.jpg), [club](preview-club.jpg), [club móvil](preview-mobile-club.jpg), [recompensas](preview-rewards.jpg), [compra](preview-checkout.jpg) y [beneficio](preview-benefit.jpg). La foto ilustrativa del mantenimiento se generó con imagegen; las capturas muestran la aplicación real.

## Backend

Con las variables de Supabase configuradas, el registro e ingreso usan correo, los datos son compartidos y la separación de roles se aplica con RLS y funciones transaccionales. El esquema de pruebas comprueba tablas, funciones, RLS y el seed. Supabase Cron ejecuta diariamente el vencimiento de puntos a las 04:00 UTC (medianoche de Bolivia), aunque ningún cliente abra la aplicación. En este entorno no estaba disponible Docker ni Supabase CLI, por lo que la migración debe ejecutarse localmente con los comandos de [BACKEND.md](BACKEND.md) antes del despliegue.

## Límites

No hay verificación de celular, creación de wallet, fondos reales, pagos, contratos ni transacciones de Base Sepolia. La autorización criptográfica del taller y la quema on-chain todavía no existen; el consumo de cupón sí se impide en el backend. La base de clientes externa todavía no está conectada. Disponibilidad comercial de Kiden en Bolivia y aprobación de las recompensas pendientes.
