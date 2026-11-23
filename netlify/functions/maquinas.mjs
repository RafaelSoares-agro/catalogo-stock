// API de stock.
//   GET    /api/maquinas            público: máquinas no vendidas, solo campos públicos
//   GET    /api/maquinas?todas=1    con token: todas, con todos los campos
//   GET    /api/maquinas/:id        público: una máquina
//   POST   /api/maquinas            con token: crea una máquina
//   PUT    /api/maquinas            con token: sincroniza el stock completo (lista), por "ref"
//   PUT    /api/maquinas/:id        con token: reemplaza / actualiza una máquina
//   DELETE /api/maquinas/:id        con token: elimina una máquina
import { leerStock, guardarStock, json, error, preflight, autorizado, publico, normalizar, nuevoId } from "../lib/common.mjs";

export default async (req, context) => {
  if (req.method === "OPTIONS") return preflight();
  const id = context.params?.id;
  const url = new URL(req.url);

  if (req.method === "GET") {
    const lista = await leerStock();
    if (id) {
      const m = lista.find((x) => x.id === id || x.ref === id);
      if (!m || (m.estado === "vendido" && !autorizado(req))) return error(404, "Máquina no encontrada");
      return json(autorizado(req) ? m : publico(m));
    }
    if (url.searchParams.get("todas") && autorizado(req)) return json(lista);
    const visibles = lista.filter((m) => m.estado !== "vendido").map(publico);
    return json(visibles, 200, { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" });
  }

  if (!autorizado(req)) return error(401, "Falta el token de administración o no es válido");

  let body;
  if (req.method !== "DELETE") {
    try { body = await req.json(); } catch { return error(400, "El cuerpo debe ser JSON"); }
  }
  const lista = await leerStock();

  if (req.method === "POST" && !id) {
    if (lista.some((x) => x.ref === body.ref)) return error(409, "Ya existe una máquina con esa ref");
    const r = normalizar(body, { id: nuevoId(), creado: new Date().toISOString() });
    if (!r.ok) return error(400, "Datos inválidos", r.errores);
    lista.push(r.valor);
    await guardarStock(lista);
    return json(r.valor, 201);
  }

  if (req.method === "PUT" && !id) {
    // Sincronización completa desde el portal de stock: la lista recibida pasa a ser el stock.
    // Se conservan id, fotos y fecha de creación de las máquinas que ya existían (misma ref).
    const entrada = Array.isArray(body) ? body : body?.maquinas;
    if (!Array.isArray(entrada)) return error(400, "Envíe una lista de máquinas o { maquinas: [...] }");
    const porRef = new Map(lista.map((m) => [m.ref, m]));
    const nueva = [], errores = [];
    entrada.forEach((e, i) => {
      const previo = porRef.get(String(e.ref || "").trim());
      const base = previo ? { id: previo.id, creado: previo.creado, fotos: previo.fotos } : { id: nuevoId(), creado: new Date().toISOString() };
      const r = normalizar(e.fotos ? e : { ...e, fotos: base.fotos }, base);
      if (r.ok) nueva.push(r.valor); else errores.push({ fila: i, ref: e.ref, errores: r.errores });
    });
    if (errores.length) return error(400, "Hay filas con errores; no se guardó nada", errores);
    const refs = new Set(nueva.map((m) => m.ref));
    if (refs.size !== nueva.length) return error(400, "Hay refs repetidas en la lista");
    await guardarStock(nueva);
    return json({ guardadas: nueva.length, nuevas: nueva.filter((m) => !porRef.has(m.ref)).length, quitadas: lista.filter((m) => !refs.has(m.ref)).length });
  }

  const i = lista.findIndex((x) => x.id === id);
  if (i < 0) return error(404, "Máquina no encontrada");

  if (req.method === "PUT" || req.method === "PATCH") {
    if (body.ref && lista.some((x, j) => j !== i && x.ref === body.ref)) return error(409, "Ya existe otra máquina con esa ref");
    const r = normalizar({ ...body, id: lista[i].id, creado: lista[i].creado }, req.method === "PATCH" ? lista[i] : {});
    if (!r.ok) return error(400, "Datos inválidos", r.errores);
    lista[i] = r.valor;
    await guardarStock(lista);
    return json(r.valor);
  }

  if (req.method === "DELETE") {
    const [borrada] = lista.splice(i, 1);
    await guardarStock(lista);
    return json({ eliminada: borrada.id });
  }

  return error(405, "Método no permitido");
};

export const config = { path: ["/api/maquinas", "/api/maquinas/:id"] };
