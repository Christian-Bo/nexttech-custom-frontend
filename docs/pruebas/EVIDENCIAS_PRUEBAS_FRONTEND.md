# Evidencias de pruebas — Frontend (Integrante 5)

Proyecto Final Desarrollo Web 2027 · NextTech Custom
Herramienta: **Vitest 4** (con cobertura V8). Las pruebas están en `tests/`.

## Cómo ejecutarlas

```bash
npm install
npm test                # corre todas las pruebas una vez
npm run test:coverage   # además genera el reporte de cobertura (carpeta coverage/)
```

> Evidencia para el informe: captura de la terminal con `npm run test:coverage` y del reporte
> `coverage/index.html` abierto en el navegador.

## Resumen

| Tipo | Archivo | Qué se prueba | Casos |
|---|---|---|---|
| Unitaria | `tests/unit/format.test.ts` | Formato de quetzales, cifras compactas y "hace X min" | 8 |
| Unitaria | `tests/unit/jwt.test.ts` | Lectura de los datos de la sesión (JWT), acentos, rol de .NET, tokens inválidos | 6 |
| Unitaria | `tests/unit/portrait.test.ts` | Estudio de foto: límites, filtros y stickers (máximo 3) | 8 |
| Caja blanca | `tests/caja-blanca/apiErrors.test.ts` | Cada rama del manejo de errores del API (red, timeout, 4xx, 5xx, validación) | 13 |
| Caja blanca | `tests/caja-blanca/orderStatus.test.ts` | Conversión de los nombres de estado del backend a códigos | 14 |
| Caja blanca | `tests/caja-blanca/portraitCrop.test.ts` | Ramas del recorte del rostro (foto horizontal/vertical, zoom, desplazamiento) | 7 |
| Caja negra | `tests/caja-negra/orderCode.test.ts` | Búsqueda del pedido por teclado o QR (enunciado 4.a): clases de equivalencia y valor límite | 9 |
| Caja negra | `tests/caja-negra/httpClient.test.ts` | Cliente HTTP: JWT, 401, errores 500 sin detalles internos, errores de descargas | 7 |
| Caja negra | `tests/caja-negra/tracking.test.ts` | Seguimiento con la respuesta real del backend (enunciado 3.j) | 6 |
| Caja negra | `tests/caja-negra/credencial.test.ts` | Nombre del PDF y regla de aprobación de la verificación facial | 9 |
| **Total** | **10 archivos** | | **87** |

Resultado de la última ejecución: **87 de 87 pruebas aprobadas.**

## Criterios usados

- **Unitarias:** una función a la vez, con entradas y salidas conocidas.
- **Caja blanca:** se diseñó un caso por cada rama (`if`/`else`) del código, para que todas se ejecuten al menos una vez. La cobertura de ramas de `services/api` es de aproximadamente 98 %.
- **Caja negra:** los casos salen del enunciado y del contrato del API (kit de Postman), sin mirar la implementación. Se usan clases de equivalencia (entradas válidas e inválidas) y valores límite (por ejemplo, un código de 3 caracteres o el cuarto sticker).
- Las pruebas no usan el backend real: el API se simula para que los resultados no dependan de la red ni de la base de datos.

## Pruebas manuales (llenar con capturas)

| # | Caso | Pasos | Resultado esperado | Chrome | Firefox | Edge | Celular |
|---|---|---|---|---|---|---|---|
| 1 | Foto del registro | `/mi-foto?nuevo=1` → Tomar foto → Guardar | Recorte 3:4, se ve la original y la modificada | | | | |
| 2 | Filtros y stickers | En el estudio de foto, aplicar un filtro y 3 stickers; intentar un cuarto | El cuarto se rechaza con un aviso | | | | |
| 3 | Credencial PDF | Paso "Credencial" → Descargar | PDF con la foto modificada, nombre, rol y QR | | | | |
| 4 | Editor del llavero | `/personalizar` → texto, imagen, sticker, girar A/B | Vista previa en tiempo real, máximo 3 stickers por lado | | | | |
| 5 | Seguimiento | `/seguimiento/NTC-1045` | El estado cambia solo, hasta "Listo para entrega" | | | | |
| 6 | Producción | `/panel/produccion` → Marcar listo | El pedido pasa a "Listos"; alerta después de 60 s | | | | |
| 7 | Repartidor | `/repartidor/escanear` → escanear QR o teclear código | Abre el pedido correcto | | | | |
| 8 | Dashboard en presentación | `/panel/presentacion` → Pantalla completa | Día, semana y total; se actualiza solo | | | | |
