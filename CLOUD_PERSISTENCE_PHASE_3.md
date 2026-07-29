# HEADBANG DEALERS — Cloud Persistence Phase 3

## Estado

La implementación está terminada detrás de
`VITE_HEADBANG_CLOUD_SYNC_ENABLED`. La variable permanece en `false` en
`.env.example` y en GitHub Actions. El desarrollo local puede usar `true`.

La migración fue aplicada manualmente en Supabase y queda registrada en
`supabase/migrations/003_cloud_save_points_achievements.sql`. No debe volver a
ejecutarse automáticamente. No recrea tablas ni modifica RLS.

## Arquitectura

El identificador estable es `HEADBANG_CLOUD_SAVE` con
`cloudSchemaVersion: 1`. La versión de build y la clave local son metadata
independiente.

El coordinador:

1. Detecta el adaptador local activo.
2. Convierte a canónico.
3. Lee la fila del usuario autenticado.
4. Previsualiza la primera sincronización.
5. Fusiona por dominio.
6. Valida y limita el JSON a 64 KB.
7. Actualiza mediante una RPC con revisión esperada.
8. Convierte al formato de la build activa.
9. Crea backup, escribe, valida y recarga una única vez cuando procede.

## Fusión

- Booleanos de progreso: `true` prevalece.
- Niveles, personajes y colecciones: unión estable sin duplicados.
- Nivel máximo: máximo válido.
- Puntuación, precisión y combo: máximo por nivel.
- Rango: prioridad real del archivo de rangos V002.
- Intentos: máximo fiable para no duplicar sesiones repetidas.
- Selección y ajustes: metadata por campo; sin metadata prevalece el
  dispositivo actual si el valor es válido.
- `newUnlockPending`: unión menos secuencias ya vistas.
- Puntos: máximo monotónico temporal, nunca suma entre dispositivos.
- Logros: fusión por ID, `unlocked=true`, progreso máximo y primera fecha de
  desbloqueo. Los objetivos conocidos proceden de configuración.
- Economía comercial: dato opaco; nunca se suma ni concede desde el cliente.
- Campos desconocidos: se conservan en `extensions` y `unknownLocalData`.

## Offline y concurrencia

El detector usa un hash canónico y polling local moderado de 2,5 segundos. Los
cambios estables se agrupan durante 3 segundos. No hay escritura por frame,
golpe o evento BASS.

Sin red, el progreso local continúa y `pendingSync` queda activo. Al volver
online se realizan hasta tres reintentos con backoff. Tras la primera
sincronización, la recuperación usa combinación automática.

La RPC `sync_headbang_cloud_save`:

- obtiene el usuario exclusivamente mediante `auth.uid()`;
- no acepta `user_id`;
- exige `expected_revision`;
- incrementa `sync_revision` atómicamente;
- devuelve conflicto si otro dispositivo escribió antes;
- se ejecuta como invocador y continúa sujeto a RLS.

## Seguridad

- No hay `service_role`.
- No se guardan correo, contraseñas o tokens en el save.
- El device ID es un UUID aleatorio pseudónimo.
- Los backups contienen únicamente el save jugable.
- No se mezclan Auth, newsletter o Brevo.
- La clasificación pública solo lee `public.score_top_10` y no contiene API de
  escritura.
- El cliente no es autoridad para moneda premium, descuentos, compras,
  merchandise, recompensas comerciales, rankings con premio ni promociones.

Esos dominios requerirán una RPC, Edge Function, Worker o backend autoritativo.

## SCORE TOP 10

La pantalla pública consulta únicamente:

- `ranking_position`
- `player_name`
- `score`
- `level_id`
- `game_build_version`
- `submitted_at`

La consulta ocurre al entrar en la pantalla, ordena por puntuación descendente
y fecha ascendente en empates, y no utiliza polling. El navegador no inserta,
actualiza ni elimina puntuaciones. Los envíos futuros deben pasar por una
Supabase Edge Function autenticada.

## Limitaciones antes de producción

- Ejecutar QA real con una cuenta confirmada y dos dispositivos.
- Validar políticas RLS desde una sesión autenticada de pruebas.
- Validar la Edge Function de envío antes de habilitar puntuaciones públicas
  procedentes del juego.
- Definir la URL legal pendiente indicada en la Fase 2.
- Mantener la feature flag de producción desactivada hasta completar lo
  anterior.
