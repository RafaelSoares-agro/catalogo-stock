// Generador de flyers para redes y WhatsApp, dibujado en <canvas>.
// Uso: Flyer.render(canvas, maquina, config, "cuadrado" | "historia") -> Promise
(function (global) {
  "use strict";
  var C = { bg: "#0b0b0c", bg2: "#18181a", line: "#2c2c2f", fg: "#ededed", fg2: "#a9a9ad", fg3: "#75757a", red: "#c10b25", redHi: "#e3213d" };
  var DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif';
  var BODY = '"Barlow", Arial, sans-serif';
  // Medidas de cada formato: alto de foto, separaciones, tamaño máximo del modelo, alto de la barra inferior.
  var FORMATOS = {
    cuadrado: { w: 1080, h: 1080, foto: 0.42, top: 30, modelo: 120, gapSpecs: 36, gapPrecio: 214, precio: 92, consultar: 80, barra: 130, wa: 48 },
    historia: { w: 1080, h: 1920, foto: 0.50, top: 70, modelo: 180, gapSpecs: 70, gapPrecio: 280, precio: 120, consultar: 110, barra: 190, wa: 60 }
  };

  function num(n) { return (Number(n) || 0).toLocaleString("es-PY"); }
  function font(weight, size, fam) { return weight + " " + size + "px " + (fam || DISPLAY); }

  function cargarFuentes() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load(font(300, 100)), document.fonts.load(font(400, 40)),
      document.fonts.load(font(600, 40)), document.fonts.load(font(700, 40)),
      document.fonts.load(font(500, 30, BODY))
    ]).catch(function () { });
  }
  function cargarImagen(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }
  function cover(ctx, img, x, y, w, h) {
    var k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    var sw = w / k, sh = h / k;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }
  // Reduce el tamaño de letra hasta que el texto entre en el ancho.
  function ajustar(ctx, texto, weight, size, maxW, min) {
    var s = size;
    do { ctx.font = font(weight, s); if (ctx.measureText(texto).width <= maxW) break; s -= 4; } while (s > (min || 40));
    return s;
  }
  function etiqueta(ctx, x, y, texto, fondo, color, alto) {
    ctx.font = font(700, alto * 0.55);
    var w = ctx.measureText(texto).width + alto * 1.1;
    ctx.fillStyle = fondo;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - alto * 0.35, y + alto); ctx.lineTo(x, y + alto); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color; ctx.textBaseline = "middle"; ctx.fillText(texto, x + alto * 0.4, y + alto / 2 + 1);
    ctx.textBaseline = "alphabetic";
    return w;
  }
  function barrasRojas(ctx, x, y, n, alto, sep) {
    ctx.fillStyle = C.red;
    for (var i = 0; i < n; i++) {
      var yy = y + i * (alto + sep);
      ctx.beginPath(); ctx.moveTo(x, yy + alto * 0.35); ctx.lineTo(x + 14, yy); ctx.lineTo(x + 14, yy + alto - alto * 0.35); ctx.lineTo(x, yy + alto); ctx.closePath(); ctx.fill();
    }
  }
  function placeholder(ctx, x, y, w, h) {
    ctx.fillStyle = C.bg2; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.035)"; ctx.lineWidth = 2;
    for (var r = 40; r < Math.max(w, h) * 1.2; r += 34) { ctx.beginPath(); ctx.arc(x + w * 0.8, y + h * 0.3, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = C.fg3; ctx.font = font(400, 34); ctx.textAlign = "center";
    ctx.fillText("FOTO A CONFIRMAR", x + w / 2, y + h / 2); ctx.textAlign = "left";
  }

  function render(canvas, m, cfg, formato) {
    var F = FORMATOS[formato] || FORMATOS.cuadrado;
    cfg = cfg || {};
    canvas.width = F.w; canvas.height = F.h;
    var ctx = canvas.getContext("2d");
    var W = F.w, H = F.h, P = 64;
    return Promise.all([cargarFuentes(), cargarImagen((m.fotos || [])[0])]).then(function (r) {
      var img = r[1];
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

      // Foto
      var fh = Math.round(H * F.foto);
      if (img) cover(ctx, img, 0, 0, W, fh); else placeholder(ctx, 0, 0, W, fh);
      var g = ctx.createLinearGradient(0, fh - 220, 0, fh);
      g.addColorStop(0, "rgba(11,11,12,0)"); g.addColorStop(1, "rgba(11,11,12,1)");
      ctx.fillStyle = g; ctx.fillRect(0, fh - 220, W, 220);
      var gt = ctx.createLinearGradient(0, 0, 0, 170);
      gt.addColorStop(0, "rgba(11,11,12,0.75)"); gt.addColorStop(1, "rgba(11,11,12,0)");
      ctx.fillStyle = gt; ctx.fillRect(0, 0, W, 170);

      // Marca arriba
      ctx.fillStyle = C.fg; ctx.font = font(700, 46); ctx.fillText((cfg.empresa || "H.Petersen").toUpperCase(), P, 84);
      ctx.fillStyle = C.fg2; ctx.font = font(400, 26);
      ctx.textAlign = "right"; ctx.fillText("STOCK CASE IH", W - P, 80); ctx.textAlign = "left";

      // Etiqueta nuevo / usado
      var tipo = (m.tipo || "Usado") === "Nuevo" ? "NUEVO" : "USADO";
      etiqueta(ctx, 0, fh - 120, tipo, tipo === "NUEVO" ? C.red : "#3a3a3e", "#fff", 60);
      if (m.estado === "reservado") etiqueta(ctx, W - 260, fh - 120, "RESERVADO", "#e0a22b", "#1a1200", 60);

      // Bloque de texto
      var y = fh + F.top;
      barrasRojas(ctx, 0, y - 8, formato === "historia" ? 5 : 3, 34, 14);
      ctx.fillStyle = C.fg3; ctx.font = font(400, 26);
      ctx.fillText("/ / / / / / / / / /", P, y + 10);
      ctx.fillStyle = C.redHi; ctx.font = font(700, 36);
      ctx.fillText(String(m.categoria || "").toUpperCase(), P, y + 62);
      ctx.fillStyle = C.fg3; ctx.font = font(400, 28); ctx.textAlign = "right";
      ctx.fillText(m.ref ? "REF. " + m.ref : "", W - P, y + 60); ctx.textAlign = "left";

      var modelo = String(m.modelo || "").toUpperCase();
      var ms = ajustar(ctx, modelo, 300, F.modelo, W - P * 2 - 70, 64);
      ctx.fillStyle = C.redHi; ctx.font = font(300, ms);
      var my = y + 62 + ms * 0.92;
      ctx.fillText(modelo, P - 4, my);
      // Año en vertical al lado del modelo
      var mw = ctx.measureText(modelo).width;
      if (m.anio) {
        ctx.save(); ctx.translate(P + mw + 22, my); ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = C.fg; ctx.font = font(400, Math.round(ms * 0.26)); ctx.fillText(String(m.anio), 0, 0); ctx.restore();
      }

      // Especificaciones
      var sy = my + F.gapSpecs;
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(P, sy); ctx.lineTo(W - P, sy); ctx.stroke();
      var specs = [["AÑO", m.anio ? String(m.anio) : "–"], ["HORAS", m.horas ? num(m.horas) + " h" : ((m.tipo === "Nuevo") ? "0 h" : "–")]];
      var colW = (W - P * 2) / 2;
      specs.forEach(function (s, i) {
        var x = P + i * colW + (i ? 28 : 0);
        if (i) { ctx.beginPath(); ctx.moveTo(P + i * colW, sy + 18); ctx.lineTo(P + i * colW, sy + 112); ctx.stroke(); }
        ctx.fillStyle = C.fg3; ctx.font = font(400, 26); ctx.fillText(s[0], x, sy + 50);
        ctx.fillStyle = C.fg; ctx.font = font(600, 52); ctx.fillText(s[1], x, sy + 106);
      });
      ctx.beginPath(); ctx.moveTo(P, sy + 130); ctx.lineTo(W - P, sy + 130); ctx.stroke();

      // Precio
      var py = sy + F.gapPrecio;
      ctx.fillStyle = C.fg;
      if (m.precio) {
        ctx.font = font(600, 40); var mon = (m.moneda || "USD");
        ctx.fillStyle = C.fg2; ctx.fillText(mon, P, py); var mwid = ctx.measureText(mon).width + 14;
        ctx.fillStyle = C.fg; ctx.font = font(700, F.precio); ctx.fillText(num(m.precio), P + mwid, py);
      } else {
        ctx.font = font(700, F.consultar); ctx.fillText("CONSULTAR PRECIO", P, py);
      }

      // Barra inferior con WhatsApp
      var bh = F.barra;
      ctx.fillStyle = C.red; ctx.fillRect(0, H - bh, W, bh);
      ctx.fillStyle = "#fff";
      // Chevrones
      var cx = P, cy = H - bh / 2;
      ctx.lineWidth = 8; ctx.strokeStyle = "#fff"; ctx.lineJoin = "miter";
      [0, 22].forEach(function (dx) { ctx.beginPath(); ctx.moveTo(cx + dx, cy - 18); ctx.lineTo(cx + dx + 16, cy); ctx.lineTo(cx + dx, cy + 18); ctx.stroke(); });
      // Sin número: cada vendedor comparte el flyer desde su propio WhatsApp.
      ctx.font = font(400, 30); ctx.fillText("CONSULTE CON SU VENDEDOR", P + 64, cy - 14);
      ctx.font = font(700, F.wa);
      ctx.fillText((cfg.empresa || "H.Petersen").toUpperCase(), P + 64, cy + (formato === "historia" ? 44 : 38));
      ctx.textAlign = "right"; ctx.font = font(400, 26); ctx.globalAlpha = 0.85;
      ctx.fillText("CONCESIONARIO CASE IH", W - P, cy - 14);
      ctx.fillText((location.host || "").toUpperCase(), W - P, cy + (formato === "historia" ? 44 : 38));
      ctx.globalAlpha = 1; ctx.textAlign = "left";
      return canvas;
    });
  }

  function nombreArchivo(m, formato) {
    var base = [m.modelo, m.anio, m.ref].filter(Boolean).join("-").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "flyer-" + (base || "maquina") + "-" + formato + ".png";
  }

  global.Flyer = { render: render, nombreArchivo: nombreArchivo, FORMATOS: FORMATOS };
})(window);
