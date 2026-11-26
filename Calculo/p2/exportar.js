// =====================================================================
//  exportar.js — Archivos de salida sin librerías externas:
//  CSV, ZIP (sin compresión) y el reporte en HTML para imprimir.
//  No toca la pantalla; funciona también en Node para pruebas.
// =====================================================================
(function (root) {
  "use strict";

  const codificar = (s) => new TextEncoder().encode(s);

  // ---------- CRC32 y ZIP ----------
  const TABLA = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++)
      c = TABLA[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function unir(partes) {
    const total = partes.reduce((s, p) => s + p.length, 0),
      out = new Uint8Array(total);
    let o = 0;
    for (const p of partes) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }

  // files: [{name, data: Uint8Array}]  ->  Uint8Array con el .zip
  function zip(files) {
    const partes = [],
      central = [];
    let off = 0;
    const d = new Date();
    const hora =
      (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const fecha =
      ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const nom = codificar(f.name),
        crc = crc32(f.data),
        n = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true);
      lh.setUint16(10, hora, true);
      lh.setUint16(12, fecha, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, n, true);
      lh.setUint32(22, n, true);
      lh.setUint16(26, nom.length, true);
      lh.setUint16(28, 0, true);
      partes.push(new Uint8Array(lh.buffer), nom, f.data);

      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, hora, true);
      ch.setUint16(14, fecha, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, n, true);
      ch.setUint32(24, n, true);
      ch.setUint16(28, nom.length, true);
      ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nom);
      off += 30 + nom.length + n;
    }
    const tamCentral = central.reduce((s, p) => s + p.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true);
    fin.setUint16(8, files.length, true);
    fin.setUint16(10, files.length, true);
    fin.setUint32(12, tamCentral, true);
    fin.setUint32(16, off, true);
    return unir([...partes, ...central, new Uint8Array(fin.buffer)]);
  }

  // ---------- CSV (con BOM para que Excel respete los acentos) ----------
  const celda = (v) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = (filas) =>
    "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");

  // Raster: primera fila = x [m], primera columna = y [m]; la fila i corresponde a y = i·Δ
  function csvRaster(Z, N, dx) {
    const filas = [["y\\x", ...Array.from({ length: N }, (_, j) => j * dx)]];
    for (let i = 0; i < N; i++) {
      const fila = [i * dx];
      for (let j = 0; j < N; j++) fila.push(+Z[i * N + j].toFixed(3));
      filas.push(fila);
    }
    return csv(filas);
  }

  function csvCauce(ruta, F, N, dx, dl) {
    const filas = [
      [
        "orden",
        "x [m]",
        "y [m]",
        "z [m]",
        "tramo [m]",
        "distancia desde la salida [m]",
      ],
    ];
    const L = dl.reduce((s, v) => s + v, 0);
    let acum = 0;
    ruta.forEach((k, t) => {
      if (t > 0) acum += dl[t - 1];
      filas.push([
        t,
        (k % N) * dx,
        ((k / N) | 0) * dx,
        +F[k].toFixed(3),
        t > 0 ? +dl[t - 1].toFixed(2) : 0,
        +(L - acum).toFixed(2),
      ]);
    });
    return csv(filas);
  }

  // ---------- Reporte HTML (se imprime o se guarda como PDF desde el navegador) ----------
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  function tablaHTML(cabeza, filas) {
    return (
      "<table><thead><tr>" +
      cabeza.map((h) => `<th>${esc(h)}</th>`).join("") +
      "</tr></thead><tbody>" +
      filas
        .map(
          (f) =>
            "<tr>" +
            f
              .map((v, i) => `<td${i ? ' class="n"' : ""}>${esc(v)}</td>`)
              .join("") +
            "</tr>",
        )
        .join("") +
      "</tbody></table>"
    );
  }

  // d = {fecha, equipo, integrantes, notas, params, dx, filas, gasto, tc, C, imgs, versiones, respuestasHTML}
  function reporteHTML(d) {
    const fig = (id, pie) =>
      d.imgs[id]
        ? `<figure><img src="${d.imgs[id]}" alt="${esc(pie)}"><figcaption>${esc(pie)}</figcaption></figure>`
        : "";
    const notas =
      d.notas && d.notas.trim()
        ? d.notas
            .split(/\n{2,}/)
            .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
            .join("")
        : "<p><em>Sin análisis escrito todavía. Agrégalo en la pestaña Proyecto.</em></p>";
    const comp =
      d.versiones && d.versiones.length
        ? tablaHTML(
            [
              "Versión",
              "Δ [m]",
              "B [m]",
              "A [km²]",
              "L [m]",
              "S_med",
              "tc [min]",
              "Q (i = 60 mm/h) [m³/s]",
            ],
            d.versiones.map((v) => [
              v.nombre,
              v.res.dx,
              v.res.B,
              v.res.A.toFixed(3),
              v.res.L.toFixed(1),
              v.res.Smed.toFixed(3),
              v.res.tc.toFixed(2),
              ((v.res.C * 60 * v.res.A) / 3.6).toFixed(2),
            ]),
          )
        : "<p><em>No hay versiones guardadas.</em></p>";
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte, ${esc(d.equipo || "proyecto de cuenca")}</title>
<style>
body{font:14px/1.55 "Segoe UI",system-ui,sans-serif;color:#10222c;max-width:880px;margin:32px auto;padding:0 20px}
h1{font-size:1.7rem;margin:0 0 4px}h2{font-size:1.15rem;margin:28px 0 8px;border-bottom:1px solid #b7c9d1;padding-bottom:3px}
.meta{color:#4f6876;margin-bottom:12px}table{border-collapse:collapse;width:100%;margin:8px 0;font-size:.9rem}
th,td{border-bottom:1px solid #cdd9de;padding:4px 8px;text-align:left}td.n,th:not(:first-child){text-align:right}th{background:#e3edf1}
figure{margin:14px 0;page-break-inside:avoid}img{max-width:100%;border:1px solid #b7c9d1}figcaption{font-size:.85rem;color:#4f6876}
.dos{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pregunta{margin:8px 0}.pregunta b{color:#0a5fd8}
.aviso{background:#e3edf1;padding:6px 10px;border-radius:4px;font-size:.88rem}
@media print{body{margin:0}h2{page-break-after:avoid}}
</style></head><body>
<h1>Hidrología de una cuenca sobre un modelo digital de elevaciones</h1>
<p class="meta">${esc(d.equipo || "Equipo sin nombre")}${d.integrantes ? ", " + esc(d.integrantes) : ""}. Generado el ${esc(d.fecha)}.</p>

<h2>1. Función del terreno</h2>
<p>z = f(x, y) = z₀ + s·y + H[1 − cos(π(x − xc − M sin(y/pm + φ))/W)] + B sin(x/a + pa) sin(y/b + pb) + Σ A<sub>k</sub> exp(−((x − x<sub>k</sub>)² + (y − y<sub>k</sub>)²) / (2σ<sub>k</sub>²)).</p>
${tablaHTML(["Parámetro", "Valor"], d.params)}
<p>Malla de 100 × 100 puntos con Δ = ${esc(d.dx)} m, dominio de ${esc(99 * d.dx)} × ${esc(99 * d.dx)} m.</p>

<h2>2. Figuras</h2>
<div class="dos">${fig("fig_contornos", "Curvas de nivel con parteaguas, cauces, cauce principal y salida")}${fig("fig_pendiente", "Mapa de pendiente θ con el parteaguas")}</div>
${fig("fig_3d", "Superficie 3D del modelo con el cauce principal")}
${fig("fig_perfil_gasto", "Perfil longitudinal del cauce y gasto en función de la intensidad")}

<h2>3. Resultados de la cuenca</h2>
${tablaHTML(["Parámetro", "Valor"], d.filas)}

<h2>4. Tiempo de concentración y gasto de pico</h2>
<p>tc = ${esc(d.tc)} min (Kirpich). Coeficiente de escurrimiento C = ${esc(d.C)}.</p>
${tablaHTML(["i [mm/h]", "P = i·tc [mm]", "Q [m³/s]", "V = C·P·A [m³]"], d.gasto)}

<h2>5. Preguntas de cálculo multivariable</h2>
${d.respuestasHTML}

<h2>6. Análisis</h2>
${notas}
<h3>Versiones guardadas</h3>
${comp}
</body></html>`;
  }

  const Exportar = {
    codificar,
    crc32,
    zip,
    csv,
    csvRaster,
    csvCauce,
    reporteHTML,
    esc,
  };
  root.Exportar = Exportar;
  if (typeof module !== "undefined" && module.exports)
    module.exports = Exportar;
})(typeof window !== "undefined" ? window : globalThis);
