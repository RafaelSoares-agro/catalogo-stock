// Datos de contacto y textos de la portada.
//   GET /api/config   público
//   PUT /api/config   con token
import { leerConfig, guardarConfig, json, error, preflight, autorizado } from "../lib/common.mjs";

const CAMPOS = ["empresa", "subtitulo", "whatsapp", "telefono", "email", "aviso"];

export default async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method === "GET") return json(await leerConfig());
  if (req.method !== "PUT") return error(405, "Método no permitido");
  if (!autorizado(req)) return error(401, "Falta el token de administración o no es válido");
  let body;
  try { body = await req.json(); } catch { return error(400, "El cuerpo debe ser JSON"); }
  const actual = await leerConfig();
  for (const k of CAMPOS) if (body[k] !== undefined) actual[k] = String(body[k]).trim().slice(0, 300);
  await guardarConfig(actual);
  return json(actual);
};

export const config = { path: "/api/config" };
