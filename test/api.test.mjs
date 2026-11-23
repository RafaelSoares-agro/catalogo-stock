// Prueba la API sin Netlify: copia las funciones a una carpeta temporal con un
// @netlify/blobs falso en memoria y llama a los handlers directamente.
import { cpSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "api-"));
cpSync(join(raiz, "netlify"), join(tmp, "netlify"), { recursive: true });
const fake = join(tmp, "node_modules/@netlify/blobs");
mkdirSync(fake, { recursive: true });
writeFileSync(join(fake, "package.json"), JSON.stringify({ name: "@netlify/blobs", type: "module", main: "index.js" }));
writeFileSync(join(fake, "index.js"), `
const stores = new Map();
export function getStore(o) { const name = typeof o === "string" ? o : o.name;
  if (!stores.has(name)) stores.set(name, new Map()); const m = stores.get(name);
  return {
    async get(k, opt) { if (!m.has(k)) return null; const v = m.get(k).data; return opt?.type === "json" ? JSON.parse(v) : v; },
    async getWithMetadata(k) { return m.has(k) ? m.get(k) : null; },
    async setJSON(k, v) { m.set(k, { data: JSON.stringify(v), metadata: {} }); },
    async set(k, v, opt) { m.set(k, { data: v, metadata: opt?.metadata || {} }); },
    async delete(k) { m.delete(k); },
  }; }`);

process.env.ADMIN_TOKEN = "secreto-de-prueba";
const maq = (await import(join(tmp, "netlify/functions/maquinas.mjs"))).default;
const fotos = (await import(join(tmp, "netlify/functions/fotos.mjs"))).default;
const conf = (await import(join(tmp, "netlify/functions/config.mjs"))).default;

const H = { authorization: "Bearer secreto-de-prueba", "content-type": "application/json" };
const call = async (fn, method, path, { body, headers, params } = {}) => {
  const r = await fn(new Request("https://x.test" + path, { method, headers, body: body === undefined ? undefined : (typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body)) }), { params: params || {} });
  const ct = r.headers.get("content-type") || "";
  return { status: r.status, body: ct.includes("json") ? await r.json() : await r.arrayBuffer(), headers: r.headers };
};
let ok = 0; const t = async (n, f) => { await f(); ok++; console.log("✓", n); };

await t("lista vacía al inicio", async () => { const r = await call(maq, "GET", "/api/maquinas"); assert.equal(r.status, 200); assert.deepEqual(r.body, []); });
await t("escribir sin token da 401", async () => { const r = await call(maq, "POST", "/api/maquinas", { body: { modelo: "X", ref: "1" }, headers: { "content-type": "application/json" } }); assert.equal(r.status, 401); });
await t("token incorrecto da 401", async () => { const r = await call(maq, "POST", "/api/maquinas", { body: { modelo: "X", ref: "1" }, headers: { ...H, authorization: "Bearer otro" } }); assert.equal(r.status, 401); });
let creada;
await t("crear máquina", async () => {
  const r = await call(maq, "POST", "/api/maquinas", { body: { modelo: "Puma 200", ref: "U-1", tipo: "usado", categoria: "Tractor", anio: "2019", horas: "4.850", precio: 118000, costo: 90000 }, headers: H });
  assert.equal(r.status, 201); creada = r.body; assert.equal(creada.tipo, "Usado"); assert.equal(creada.horas, 4850); assert.equal(creada.anio, 2019);
});
await t("ref repetida da 409", async () => { const r = await call(maq, "POST", "/api/maquinas", { body: { modelo: "Otra", ref: "U-1" }, headers: H }); assert.equal(r.status, 409); });
await t("datos inválidos dan 400", async () => { const r = await call(maq, "POST", "/api/maquinas", { body: { ref: "U-2", anio: 1800 }, headers: H }); assert.equal(r.status, 400); assert.ok(r.body.detalle.length >= 2); });
await t("el público no ve campos internos", async () => { const r = await call(maq, "GET", "/api/maquinas"); assert.equal(r.body.length, 1); assert.equal(r.body[0].costo, undefined); assert.equal(r.body[0].modelo, "Puma 200"); });
await t("admin ve todos los campos", async () => { const r = await call(maq, "GET", "/api/maquinas?todas=1", { headers: H }); assert.equal(r.body[0].costo, 90000); });
await t("PATCH parcial", async () => { const r = await call(maq, "PATCH", "/api/maquinas/" + creada.id, { body: { precio: 0 }, headers: H, params: { id: creada.id } }); assert.equal(r.status, 200); assert.equal(r.body.precio, 0); assert.equal(r.body.modelo, "Puma 200"); });
await t("vendidas no aparecen al público", async () => {
  await call(maq, "PATCH", "/api/maquinas/" + creada.id, { body: { estado: "vendido" }, headers: H, params: { id: creada.id } });
  assert.equal((await call(maq, "GET", "/api/maquinas")).body.length, 0);
  assert.equal((await call(maq, "GET", "/api/maquinas/" + creada.id, { params: { id: creada.id } })).status, 404);
});
await t("sincronización completa por ref conserva fotos e id", async () => {
  await call(maq, "PATCH", "/api/maquinas/" + creada.id, { body: { estado: "disponible", fotos: ["/api/fotos/a.jpg"] }, headers: H, params: { id: creada.id } });
  const r = await call(maq, "PUT", "/api/maquinas", { body: [{ ref: "U-1", modelo: "Puma 200", anio: 2019, horas: 5000, precio: 115000 }, { ref: "N-1", tipo: "Nuevo", modelo: "Farmall 90C", anio: 2026 }], headers: H });
  assert.equal(r.status, 200); assert.deepEqual(r.body, { guardadas: 2, nuevas: 1, quitadas: 0 });
  const l = (await call(maq, "GET", "/api/maquinas?todas=1", { headers: H })).body;
  const u = l.find((m) => m.ref === "U-1"); assert.equal(u.id, creada.id); assert.deepEqual(u.fotos, ["/api/fotos/a.jpg"]); assert.equal(u.horas, 5000);
});
await t("sincronización con error no guarda nada", async () => {
  const r = await call(maq, "PUT", "/api/maquinas", { body: [{ ref: "U-1", modelo: "" }], headers: H }); assert.equal(r.status, 400);
  assert.equal((await call(maq, "GET", "/api/maquinas")).body.length, 2);
});
await t("eliminar", async () => { const r = await call(maq, "DELETE", "/api/maquinas/" + creada.id, { headers: H, params: { id: creada.id } }); assert.equal(r.status, 200); assert.equal((await call(maq, "GET", "/api/maquinas")).body.length, 1); });
await t("subir y leer foto", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const r = await call(fotos, "POST", "/api/fotos", { body: png, headers: { authorization: H.authorization, "content-type": "image/png" } });
  assert.equal(r.status, 201); assert.match(r.body.url, /^\/api\/fotos\/.+\.png$/);
  const g = await call(fotos, "GET", r.body.url, { params: { key: r.body.key } });
  assert.equal(g.status, 200); assert.equal(g.headers.get("content-type"), "image/png");
});
await t("foto con formato no admitido da 415", async () => { const r = await call(fotos, "POST", "/api/fotos", { body: "x", headers: { authorization: H.authorization, "content-type": "text/plain" } }); assert.equal(r.status, 415); });
await t("config pública y edición con token", async () => {
  assert.equal((await call(conf, "GET", "/api/config")).body.empresa, "H.Petersen");
  assert.equal((await call(conf, "PUT", "/api/config", { body: { whatsapp: "+595 981 000 000" } })).status, 401);
  const r = await call(conf, "PUT", "/api/config", { body: { whatsapp: "+595 981 000 000", otro: "x" }, headers: H });
  assert.equal(r.body.whatsapp, "+595 981 000 000"); assert.equal(r.body.otro, undefined);
});
console.log(`\n${ok} pruebas OK`);
