// Utilidades compartidas por las funciones de la API.
import { getStore } from "@netlify/blobs";

export const CATEGORIAS = ["Tractor", "Cosechadora", "Pulverizadora", "Sembradora", "Otro"];
export const TIPOS = ["Usado", "Nuevo"];
export const ESTADOS = ["disponible", "reservado", "vendido"];
// Departamentos de Paraguay (más Asunción) para asignar vendedores por zona.
export const DEPARTAMENTOS = [
  "Asunción", "Concepción", "San Pedro", "Cordillera", "Guairá", "Caaguazú", "Caazapá", "Itapúa", "Misiones",
  "Paraguarí", "Alto Paraná", "Central", "Ñeembucú", "Amambay", "Canindeyú", "Presidente Hayes", "Boquerón", "Alto Paraguay",
];

// Campos que ve el público. Todo lo demás queda solo para el panel.
const PUBLICOS = ["id", "ref", "tipo", "categoria", "modelo", "anio", "horas", "precio", "moneda", "estado", "fotos", "destacado", "actualizado"];

export function stockStore() {
  return getStore({ name: "stock", consistency: "strong" });
}
export function fotosStore() {
  return getStore({ name: "fotos" });
}

export async function leerStock() {
  return (await stockStore().get("maquinas", { type: "json" })) || [];
}
export async function guardarStock(lista) {
  await stockStore().setJSON("maquinas", lista);
}
export async function leerConfig() {
  return (await stockStore().get("config", { type: "json" })) || {
    empresa: "H.Petersen",
    subtitulo: "Stock Case IH, nuevos y usados",
    whatsapp: process.env.WHATSAPP || "",
    telefono: "",
    email: "",
    aviso: "",
    vendedores: [],
  };
}
export async function guardarConfig(cfg) {
  await stockStore().setJSON("config", cfg);
}

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors(), ...extra },
  });
}
export function error(status, mensaje, detalle) {
  return json({ error: mensaje, ...(detalle ? { detalle } : {}) }, status);
}
export function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
  };
}
export function preflight() {
  return new Response(null, { status: 204, headers: cors() });
}

// Escritura protegida con un token fijo (variable de entorno ADMIN_TOKEN en Netlify).
export function autorizado(req) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const h = req.headers.get("authorization") || "";
  const dado = h.replace(/^Bearer\s+/i, "").trim();
  if (dado.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= dado.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export function publico(m) {
  const o = {};
  for (const k of PUBLICOS) if (m[k] !== undefined) o[k] = m[k];
  return o;
}

function entero(v) {
  // Números enteros. Acepta "4.850", "4,850" o "USD 118.000" (separador de miles paraguayo).
  if (v === "" || v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? Math.max(0, Math.round(v)) : NaN;
  const s = String(v).replace(/[.,](\d{1,2})$/, "").replace(/\D/g, "");
  return s ? Number(s) : NaN;
}

// Valida y normaliza una máquina. Devuelve { ok, valor } o { ok:false, errores }.
export function normalizar(entrada, previo = {}) {
  const m = { ...previo, ...entrada };
  const errores = [];
  m.modelo = String(m.modelo || "").trim();
  if (!m.modelo) errores.push("modelo es obligatorio");
  m.ref = String(m.ref || "").trim();
  if (!m.ref) errores.push("ref es obligatoria (código interno de la máquina)");
  m.tipo = TIPOS.includes(m.tipo) ? m.tipo : (String(m.tipo || "").toLowerCase().startsWith("n") ? "Nuevo" : "Usado");
  if (!CATEGORIAS.includes(m.categoria)) m.categoria = "Otro";
  if (!ESTADOS.includes(m.estado)) m.estado = "disponible";
  m.anio = entero(m.anio);
  if (Number.isNaN(m.anio) || (m.anio && (m.anio < 1950 || m.anio > 2100))) errores.push("anio inválido");
  m.horas = entero(m.horas);
  if (Number.isNaN(m.horas)) errores.push("horas inválidas");
  m.precio = entero(m.precio);
  if (Number.isNaN(m.precio)) errores.push("precio inválido (use 0 o vacío para 'Consultar')");
  m.moneda = m.moneda === "Gs." || m.moneda === "PYG" ? "Gs." : "USD";
  m.destacado = !!m.destacado;
  m.fotos = Array.isArray(m.fotos) ? m.fotos.map(String).filter(Boolean).slice(0, 20) : [];
  m.actualizado = new Date().toISOString();
  return errores.length ? { ok: false, errores } : { ok: true, valor: m };
}

export function nuevoId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Valida la lista de vendedores: [{ id, nombre, whatsapp, zonas: [departamentos] }].
export function normalizarVendedores(lista) {
  if (!Array.isArray(lista)) return { ok: false, errores: ["vendedores debe ser una lista"] };
  if (lista.length > 100) return { ok: false, errores: ["máximo 100 vendedores"] };
  const errores = [], valor = [];
  lista.forEach((v, i) => {
    const nombre = String(v?.nombre || "").trim().slice(0, 60);
    const whatsapp = String(v?.whatsapp || "").trim().slice(0, 30);
    const digitos = whatsapp.replace(/\D/g, "");
    if (!nombre) errores.push(`vendedor ${i + 1}: falta el nombre`);
    if (digitos.length < 8) errores.push(`vendedor ${i + 1}: el WhatsApp debe tener código de país y número`);
    const zonas = [...new Set((Array.isArray(v?.zonas) ? v.zonas : []).filter((z) => DEPARTAMENTOS.includes(z)))];
    valor.push({ id: String(v?.id || "") || "v" + Math.random().toString(36).slice(2, 9), nombre, whatsapp, zonas });
  });
  return errores.length ? { ok: false, errores } : { ok: true, valor };
}
