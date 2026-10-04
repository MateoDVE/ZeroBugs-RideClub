# Requisitos no funcionales

## Matriz de cumplimiento

| Requisito | Estado de implementación | Evidencia |
|---|---|---|
| Seguridad: autenticación | Código implementado; flujo real pendiente | Correo y contraseña, confirmación y recuperación; 4 pruebas con cliente simulado |
| Seguridad: cifrado de datos sensibles | Parcial; despliegue pendiente | HTTPS previsto y respaldo cifrado; no hay cifrado aplicativo de datos personales en tablas |
| Seguridad: acceso no autorizado | Definido; validación SQL/remota pendiente | RLS, comprobaciones en RPC/Edge Functions, estados bloqueado/baja y auditoría |
| Escalabilidad: nuevas marcas | Implementado | Empresas, identidad, catálogos y reglas son datos dinámicos; no requieren una vista nueva |
| Escalabilidad: nuevas funcionalidades | Implementado a nivel arquitectónico | Frontend, adaptador, funciones, migraciones y contratos separados por módulo |
| Integración con facturación/CRM | Código de API central; ejecución pendiente | Clave global de confianza, vínculos externos, referencias únicas por empresa y bitácora; sin CRM real verificado |
| Disponibilidad: despliegue confiable | Configurado; requiere publicar | `vercel.json`, build reproducible, HTTPS y guía de comprobación |
| Disponibilidad: respaldo periódico | Workflow publicado; operación pendiente | Programación diaria, AES-256-CBC/PBKDF2 y retención de 14 días; requiere secretos, ejecución y simulacro de restauración |
| Mantenibilidad: documentación | Implementado | README, arquitectura, backend, API, QA y operación |
| Mantenibilidad: control de versiones | Implementado | Git/GitHub y migraciones inmutables |
| Mantenibilidad: carpetas claras | Implementado | `frontend/`, `supabase/`, `contracts/` y `docs/` |

## Qué significa “configurado; requiere publicar”

El código no puede crear por sí solo una cuenta o plan de hosting, ni activar o verificar un respaldo de un proyecto privado sin autorización de esa plataforma. Para cerrar esos dos puntos como **operativos**, el responsable debe:

1. desplegar el repositorio y configurar las dos variables públicas de Supabase;
2. probar ingreso y navegación en la URL HTTPS;
3. configurar los cuatro secretos del workflow y comprobar una ejecución verde con artefacto cifrado;
4. registrar un simulacro de restauración en un proyecto separado.

Hasta entonces la aplicación está preparada técnicamente, pero no corresponde afirmar que la disponibilidad productiva o la restauración ya fueron comprobadas.
