// Datos de contacto, vendedores por zona y textos de la portada.
//   GET /api/config   público
//   PUT /api/config   con token
import { leerConfig, guardarConfig, json, error, preflight, autorizado, normalizarVendedores, DEPARTAMENTOS } from "../lib/common.mjs";

const CAMPOS = ["empresa", "subtitulo", "whatsapp", "telefono", "email", "aviso"];

export default async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method === "GET") {
    const c = await leerConfig();
    return json({ ...c, vendedores: c.vendedores || [], departamentos: DEPARTAMENTOS });
  }
  if (req.method !== "PUT") return error(405, "Método no permitido");
  if (!autorizado(req)) return error(401, "Falta el token de administración o no es válido");
  let body;
  try { body = await req.json(); } catch { return error(400, "El cuerpo debe ser JSON"); }
  const actual = await leerConfig();
  for (const k of CAMPOS) if (body[k] !== undefined) actual[k] = String(body[k]).trim().slice(0, 300);
  if (body.vendedores !== undefined) {
    const r = normalizarVendedores(body.vendedores);
    if (!r.ok) return error(400, "Vendedores inválidos", r.errores);
    actual.vendedores = r.valor;
  }
  await guardarConfig(actual);
  return json({ ...actual, vendedores: actual.vendedores || [], departamentos: DEPARTAMENTOS });
};

export const config = { path: "/api/config" };
