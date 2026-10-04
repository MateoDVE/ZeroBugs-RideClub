# Operación, despliegue y recuperación

## Despliegue del frontend

El archivo `vercel.json` compila el proyecto desde `frontend/`, conserva la navegación SPA y agrega cabeceras de seguridad. En Vercel:

1. Importa `MateoDVE/rideclub` y deja el directorio raíz en la raíz del repositorio. La configuración ejecuta `npm --prefix frontend ci`, `npm --prefix frontend run build` y publica `frontend/dist`.
2. Agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para Production y Preview.
3. Despliega y copia la URL HTTPS asignada.
4. En Supabase abre **Authentication → URL Configuration**: usa esa URL como `Site URL` y agrega la misma URL y `https://tu-dominio/**` a Redirect URLs.
5. Prueba confirmación de registro, ingreso con contraseña y recuperación desde una ventana privada. Los enlaces deben regresar al dominio configurado. `supabase/config.toml` contiene `https://ride-club.vercel.app` como URL prevista; ajústala al dominio real y verifica la configuración remota.

Las claves `SUPABASE_SERVICE_ROLE_KEY`, `BOOTSTRAP_SECRET` e `INTEGRATION_API_KEY` nunca se configuran en Vercel ni con prefijo `VITE_`; pertenecen exclusivamente a Supabase Edge Functions.

## Lista de comprobación de producción

Esta es una lista pendiente de ejecución, no evidencia de despliegue realizado.

- `npx supabase db push` aplicado sin errores.
- `manage-user` e `integration-api` desplegadas; `bootstrap-admin` retirada o con secreto rotado después del alta inicial.
- Ingreso, cierre de sesión, bloqueo y baja probados con usuarios diferentes.
- RLS y pruebas de base ejecutadas con `npx supabase test db`.
- Navegación directa a `/`, `/#marketplace`, `/#rewards` y `/#club` verificada.
- API externa rechaza una clave incorrecta y no duplica una factura repetida.
- Ninguna service role, clave privada o secreto aparece en el navegador o repositorio.

## Respaldos y recuperación

RideClub incluye `.github/workflows/database-backup.yml`, programado para las 08:00 UTC (04:00 de Bolivia). Tras configurar secretos, exporta roles, esquema y datos mediante Supabase CLI 2.119.0, empaqueta los SQL y cifra con AES-256-CBC y PBKDF2. Solo sube el archivo cifrado como artefacto con retención de 14 días; los archivos sin cifrar se eliminan también ante fallo. Los permisos de acceso al artefacto dependen del repositorio y GitHub. La programación puede demorarse o fallar: revisar cada ejecución. No se configuraron secretos ni se ejecutó un respaldo real durante esta publicación.

Es una copia lógica con límites: no contiene archivos de Storage, configuración de Auth, secretos ni despliegues de Edge Functions. Los esquemas administrados y sus personalizaciones requieren revisión separada; conservar las migraciones del repositorio, incluido el trigger de Auth. Los dumps se hacen en llamadas separadas y no garantizan una instantánea común durante cambios concurrentes. Antes de adoptarlo, hacer un simulacro completo siguiendo la [guía de Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). El cifrado CBC no aporta autenticación criptográfica del archivo; custodiar y transferir el artefacto por canales de confianza.

Configura en **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

- `SUPABASE_ACCESS_TOKEN`: token personal creado en Supabase Account → Access Tokens.
- `SUPABASE_DB_PASSWORD`: contraseña de la base del proyecto.
- `SUPABASE_PROJECT_REF`: identificador del proyecto Supabase.
- `BACKUP_ENCRYPTION_PASSWORD`: contraseña larga y única para cifrar y recuperar copias.

Cuando decidas habilitarlo, abre **GitHub → Actions → Encrypted database backup → Run workflow**. Una ejecución verde con artefacto acredita la generación de una copia, no su restaurabilidad: hace falta completar el simulacro. Conserva la contraseña fuera de GitHub y mantén las versiones antiguas mientras existan copias cifradas con ellas.

Una vez al mes, y antes de cambios importantes:

1. Confirma en GitHub Actions la fecha del último respaldo automático exitoso.
2. Descarga un artefacto cifrado y conserva una segunda copia fuera de GitHub.
3. Realiza la recuperación en un proyecto Supabase separado, nunca sobre producción durante una prueba.
4. Verifica conteos de empresas, perfiles, compras, movimientos y cupones, además de una sesión de cada rol.
5. Registra fecha, responsable, resultado y tiempo de recuperación.

Para descifrar un artefacto descargado:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -in rideclub-FECHA.tar.gz.enc \
  -out rideclub-FECHA.tar.gz
tar -xzf rideclub-FECHA.tar.gz
```

OpenSSL solicita la contraseña de cifrado. Extrae en un directorio privado. Revisa los SQL antes de cargarlos en un proyecto Supabase nuevo y compatible; no apliques primero todas las migraciones si luego vas a restaurar el esquema completo. Con credenciales del proyecto de prueba configuradas de forma segura para `psql`, la secuencia orientativa es:

```bash
psql --dbname "$RESTORE_DATABASE_URL" --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles-FECHA.sql --file schema-FECHA.sql \
  --command 'SET session_replication_role = replica' \
  --file data-FECHA.sql
```

Esta secuencia no se ejecutó aquí. Revisa compatibilidad de roles/extensiones y restaura por separado las personalizaciones excluidas de Auth/Storage; no reapliques a ciegas migraciones que ya están en el dump. Reconfigura Auth, funciones y secretos, y verifica relaciones, conteos, saldos, roles e ingreso antes de considerar recuperado el sistema. Elimina de forma segura los SQL descifrados tras el simulacro.

Objetivos sugeridos para la presentación: pérdida máxima de 24 horas de datos (RPO) y recuperación en menos de 4 horas (RTO). Son objetivos operativos, no garantías, hasta completar un simulacro real.

## Monitoreo e incidentes

- Revisa errores de Edge Functions y PostgreSQL en los logs de Supabase.
- Usa `integration_logs.request_id` para correlacionar llamadas externas sin guardar el cuerpo o datos personales.
- Ante una clave expuesta, rótala con `npx supabase secrets set`, actualiza el sistema autorizado y revisa la bitácora.
- Ante un incidente, suspende la empresa afectada si hace falta, preserva auditoría y evita borrar compras o movimientos históricos.

## Mantenimiento

Las carpetas separan frontend, base, funciones, contratos y documentación. Cada cambio de esquema se añade como una migración nueva; no se modifica una migración ya aplicada en producción. Antes de publicar: pruebas, build, revisión del diff, commit y despliegue controlado.
