# Catálogo de stock Case IH · H.Petersen

Página pública con el stock de máquinas nuevas y usadas (foto, modelo, año, horas, precio o "Consultar" y botón de WhatsApp), más una API propia y un panel de carga. Todo corre en Netlify: la página es estática, la API usa Netlify Functions y los datos y las fotos se guardan en Netlify Blobs. No hace falta otra base de datos.

## Publicar en Netlify

1. En Netlify: **Add new site → Import an existing project → GitHub** y elegir este repositorio. Netlify toma la configuración de `netlify.toml`; no hay que tocar nada más.
2. En **Site configuration → Environment variables** crear `ADMIN_TOKEN` con una clave larga (por ejemplo 32 caracteres al azar). Es la clave del panel y de la API.
3. Volver a desplegar (**Deploys → Trigger deploy**).
4. Entrar a `https://SU-SITIO.netlify.app/admin`, ingresar la clave y cargar el número de WhatsApp en **Datos de contacto**.
5. Para usar un dominio propio: **Domain management → Add a domain**.

## Páginas

| Ruta | Para qué |
|---|---|
| `/` | Catálogo público. Filtros por nuevo/usado y categoría, búsqueda, orden, ficha por máquina (`/#maquina-<id>`). |
| `/admin` | Panel con clave: cargar, editar y eliminar máquinas, subir fotos, datos de contacto y **generar flyers** (botón "Flyer" en cada máquina: imagen 1080×1080 para feed o 1080×1920 para historias, más el texto para la publicación). |

## WhatsApp por zona

En `/admin → Vendedores` se carga cada vendedor con su WhatsApp y se marcan los departamentos que atiende (un departamento puede tener varios vendedores). En el catálogo, el botón WhatsApp abre la lista de departamentos; si la zona tiene varios vendedores, el cliente elige con cuál hablar, con el mensaje de la máquina ya escrito. La zona elegida se recuerda en ese navegador. Los departamentos sin vendedor van al WhatsApp central de *Datos de contacto*. Sin vendedores cargados, el botón va directo al número central.

## API

Las lecturas son públicas. Las escrituras llevan el encabezado `Authorization: Bearer <ADMIN_TOKEN>`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/maquinas` | Máquinas no vendidas, solo campos públicos. |
| GET | `/api/maquinas?todas=1` | (con clave) Todas, con todos los campos. |
| GET | `/api/maquinas/:id` | Una máquina (acepta id o ref). |
| POST | `/api/maquinas` | Crea una máquina. |
| PUT | `/api/maquinas/:id` | Reemplaza una máquina. |
| PATCH | `/api/maquinas/:id` | Cambia solo los campos enviados (por ejemplo `{"estado":"vendido"}`). |
| DELETE | `/api/maquinas/:id` | Elimina una máquina. |
| PUT | `/api/maquinas` | **Sincroniza el stock completo** desde el portal de stock (ver abajo). |
| POST | `/api/fotos` | Sube una foto (cuerpo = imagen JPG/PNG/WebP, máx. 5 MB). Devuelve `{ "url": "/api/fotos/..." }`. |
| GET | `/api/fotos/:key` | Devuelve la foto. |
| GET / PUT | `/api/config` | Empresa, subtítulo, WhatsApp central, teléfono, correo, aviso de portada y `vendedores` (`[{nombre, whatsapp, zonas: [departamentos]}]`). |

### Campos de una máquina

| Campo | Tipo | Notas |
|---|---|---|
| `ref` | texto | **Obligatorio.** Código interno del portal de stock; es la clave para sincronizar. |
| `modelo` | texto | **Obligatorio.** Ej.: `Puma 200`. |
| `tipo` | `Nuevo` / `Usado` | |
| `categoria` | `Tractor`, `Cosechadora`, `Pulverizadora`, `Sembradora`, `Otro` | |
| `anio` | número | |
| `horas` | número | Acepta `4.850`. |
| `precio` | número | `0` o vacío muestra "Consultar". |
| `moneda` | `USD` / `Gs.` | |
| `estado` | `disponible`, `reservado`, `vendido` | Las vendidas no se muestran. |
| `destacado` | sí/no | Aparece primero. |
| `fotos` | lista de URLs | La primera es la portada. |

Cualquier otro campo que se envíe (costo, chasis, etc.) se guarda pero **nunca se muestra al público**.

### Sincronizar desde el portal de stock

El portal manda la lista completa con `PUT /api/maquinas`. Lo que no venga en la lista se quita del catálogo. Las máquinas que ya existían (misma `ref`) conservan su id y sus fotos si la fila no trae `fotos`. Si una fila tiene errores no se guarda nada y la respuesta dice cuál falló.

```bash
curl -X PUT https://SU-SITIO.netlify.app/api/maquinas \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '[{"ref":"U-0101","tipo":"Usado","categoria":"Tractor","modelo":"Puma 200","anio":2019,"horas":4850,"precio":118000},
       {"ref":"N-0201","tipo":"Nuevo","categoria":"Tractor","modelo":"Farmall 90C","anio":2026,"horas":0,"precio":0}]'
# → {"guardadas":2,"nuevas":2,"quitadas":0}
```

## Desarrollo

```bash
npm install
npm test            # prueba la API con un almacenamiento en memoria
npx netlify dev     # sitio + API en http://localhost:8888 (pide ADMIN_TOKEN en .env)
```
