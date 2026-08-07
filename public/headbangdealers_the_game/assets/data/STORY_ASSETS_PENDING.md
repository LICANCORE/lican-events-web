# Modo Historia: estado de contenido

## Funcionalidad implementada

- Registro lineal de 15 niveles y persistencia versionada independiente.
- Separación entre Modo Historia y Modo Libre.
- Recompensas separadas de la progresión de nivel.
- Inventario de USB y contador de MASTER-PEN.
- Migración que elimina THE SIBERIAN y el antiguo segundo nivel de QVEENS.
- Entorno y tótem de THE SIBERIAN reasignados visualmente a HYDRAXXX FASE 1.

## Niveles pendientes

- HENRY RITUALS — FASE 1, FASE 2 y FASE 3.
- HYDRAXXX — FASE 1 (falta música/beatmap; entorno y tótem ya asignados) y FASE 2.
- MAGIC BITE.
- TREZE.
- DAVID NEON.

## USB personalizados completados

- FRANKALE, HENRY RITUALS, VIKO, EDDY CLASH, HYDRAXXX y BEUTNOISE.
- ONIONSTEP, FAYE, QVEENS, MAGIC BITE y DAVID NEON.

Cada asset conserva la estructura del MASTER-PEN, incorpora el nombre del artista y adapta su paleta al nivel correspondiente. Los once USB sustituyen al MASTER-PEN genérico en colección, expulsión del tótem, resultados y secuencia de desbloqueo.

## Recompensas provisionales

- LEVEL 13 — TREZE: MASTER-PEN, porque TREZE es el personaje inicial.

El MASTER-PEN se registra y aparece en Modo Libre, pero no se consume ni aplica un efecto todavía.

## Bypass de desarrollo

Abrir el juego con `?storyDev=1` permite marcar un placeholder desbloqueado como superado. El salto se guarda en `devCompletedLevels`, separado de `completedLevels`, y no concede recompensas.
