# HEADBANG DEALERS — Game Save Adapter Guide

## Versiones independientes

La persistencia distingue tres versiones:

1. **Game build version**: V017, V019 o una futura V025.
2. **Local save format**: por ejemplo `hd_bt_campaign_save_v019`.
3. **Cloud save schema**: `HEADBANG_CLOUD_SAVE`, actualmente
   `cloudSchemaVersion: 1`.

Una build nueva no obliga a incrementar el esquema cloud. Solo se cambia
`cloudSchemaVersion` cuando el contrato canónico deja de ser compatible.

## Contrato

Cada adaptador registrado en
`src/headbang-game/persistence/adapters/saveAdapterRegistry.js` implementa:

```js
{
  id,
  localStorageKeys,
  canRead(storage),
  read(storage),
  toCanonical(localSave),
  fromCanonical(cloudSave, currentLocalSave),
  validateLocal(save),
  priority
}
```

Puede añadir `writeAuxiliary(storage, localSave)` cuando la build utiliza claves
secundarias, pero no debe escribir durante `read` o `toCanonical`.

## Implementación actual V019

V019 está registrada con prioridad 190 y utiliza
`hd_bt_campaign_save_v019`. Conserva las claves auxiliares
`hd_bt_selected_level_v013` y `hd_bt_selected_character_v005`, mantiene campos
desconocidos y permite el recorrido V017 → cloud canónico → V019.

## Añadir una versión futura

1. Identificar la clave real creada por la nueva build.
2. Capturar fixtures anonimizados de partida nueva, intermedia y avanzada.
3. Comparar V019 y la nueva versión y documentar campos nuevos, renombrados y
   eliminados.
4. Crear el nuevo archivo dentro de `adapters/`.
5. Implementar `canRead`, `read`, `toCanonical`, `fromCanonical` y
   `validateLocal`.
6. Asignar una prioridad superior a V019.
7. Registrar el nuevo adaptador con `registerSaveAdapter(...)`.
8. Convertir los campos conocidos al modelo canónico.
9. Conservar los campos locales desconocidos en `unknownLocalData`.
10. Al volver desde cloud, partir del save local actual y no reconstruirlo de
    cero.
11. Añadir pruebas V019 → cloud → nueva versión.
12. Añadir pruebas nueva versión → cloud → nueva versión.
13. Verificar fusión repetida, campos desconocidos y límite de 64 KB.
14. Confirmar que Auth, RLS, Supabase y la interfaz no necesitan cambios.
15. No editar el bundle minificado.

## Checklist de contenido

### Personajes

- Mapear IDs estables, desbloqueos, selección y secuencias vistas.
- Definir un personaje inicial seguro.
- No seleccionar un personaje bloqueado.

### Niveles, artistas, canciones y beatmaps

- Separar progreso de nivel de assets y datos musicales.
- No subir audio, imágenes ni beatmaps completos al cloud save.
- Mantener IDs desconocidos aunque el cliente actual no pueda mostrarlos.
- Verificar que el nivel seleccionado está desbloqueado.

### Objetos y colecciones

- Añadir arrays acumulativos solo si la unión es segura.
- Documentar cuándo un objeto puede consumirse y requiere autoridad de servidor.
- Evitar duplicados.

### Economía y merchandise

- Conservar el dominio como dato opaco.
- No sumar balances, compras, descuentos ni recompensas desde el cliente.
- Diseñar una RPC, Edge Function o backend autoritativo antes de activarlo.

### Logros

- Definir si son monotónicos o revocables.
- No conceder logros con premio únicamente desde el navegador.

### Eventos temporales

- Incluir IDs y versión del evento.
- No confiar en la hora del dispositivo para premios o caducidad.
- Preservar eventos desconocidos.

### Ajustes

- Añadir `extensions.fieldUpdatedAt["settings.<campo>"]` para preferencias
  reemplazables.
- Usar fechas ISO UTC.
- Sin metadata, el dispositivo actual prevalece sin borrar ajustes cloud
  desconocidos.

## Pruebas mínimas para cada adaptador

- Save inexistente y JSON corrupto.
- Save nuevo, intermedio y avanzado.
- Versión anterior coexistiendo con la nueva.
- Conversión ida y vuelta.
- Aplicación con backup y validación posterior.
- Campos futuros desconocidos.
- Arrays duplicados y valores no finitos.
- Tamaño superior a 64 KB.
- Claves `__proto__`, `constructor` y `prototype`.
- Ausencia de correo, contraseñas, tokens y binarios.

La migración SQL y el coordinador central no deben modificarse por una simple
actualización del bundle jugable.
