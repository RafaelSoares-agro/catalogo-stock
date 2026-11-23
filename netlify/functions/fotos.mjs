// Fotos de las máquinas.
//   GET    /api/fotos/:key   público: devuelve la imagen
//   POST   /api/fotos        con token: cuerpo = imagen (image/jpeg, png o webp, hasta 5 MB). Devuelve { url }
//   DELETE /api/fotos/:key   con token
import { fotosStore, json, error, preflight, autorizado, cors } from "../lib/common.mjs";

const TIPOS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 5 * 1024 * 1024;

export default async (req, context) => {
  if (req.method === "OPTIONS") return preflight();
  const key = context.params?.key;
  const store = fotosStore();

  if (req.method === "GET") {
    if (!key) return error(404, "Foto no encontrada");
    const r = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!r) return error(404, "Foto no encontrada");
    return new Response(r.data, {
      headers: { "content-type": r.metadata?.type || "image/jpeg", "cache-control": "public, max-age=31536000, immutable", ...cors() },
    });
  }

  if (!autorizado(req)) return error(401, "Falta el token de administración o no es válido");

  if (req.method === "POST" && !key) {
    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!TIPOS[type]) return error(415, "Formato no admitido. Use JPG, PNG o WebP");
    const data = await req.arrayBuffer();
    if (!data.byteLength) return error(400, "La imagen está vacía");
    if (data.byteLength > MAX) return error(413, "La imagen supera 5 MB");
    const nombre = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + "." + TIPOS[type];
    await store.set(nombre, data, { metadata: { type } });
    return json({ key: nombre, url: "/api/fotos/" + nombre }, 201);
  }

  if (req.method === "DELETE" && key) {
    await store.delete(key);
    return json({ eliminada: key });
  }
  return error(405, "Método no permitido");
};

export const config = { path: ["/api/fotos", "/api/fotos/:key"] };
