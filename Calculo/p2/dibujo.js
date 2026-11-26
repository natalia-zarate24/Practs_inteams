// =====================================================================
//  dibujo.js — Todo lo que se pinta en lienzos (mapa 2D, 3D, gráficas,
//  leyendas). Recibe los datos ya calculados; no guarda estado propio.
// =====================================================================
(function (root) {
  "use strict";
  const { N } = Modelo;

  const PALETA = [
    "#0610f9",
    "#061df9",
    "#067df9",
    "#06cdf9",
    "#06f98c",
    "#23f906",
    "#82f906",
    "#d6f906",
    "#f97406",
    "#f92a06",
  ];
  const PAL_RGB = PALETA.map((c) =>
    [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)),
  );
  const COL_CLARO = {
    texto: "#0d2836",
    apagado: "#4f6876",
    grid: "#d3e0e6",
    linea: "#0a5fd8",
    marca: "#d9371f",
  };

  function minmax(a) {
    let l = Infinity,
      h = -Infinity;
    for (const v of a) {
      if (v < l) l = v;
      if (v > h) h = v;
    }
    return [l, h];
  }

  // Valores y texto de ayuda según lo que se muestre en el mapa
  function valoresVista(P, vista) {
    const t = new Float64Array(N * N);
    let lo = 0,
      hi = 1,
      txt = "",
      unidad = "";
    if (vista === "z") {
      [lo, hi] = minmax(P.F);
      t.set(P.F);
      txt = `z de ${lo.toFixed(1)} a ${hi.toFixed(1)} m (ya rellenado). Cada color cubre una décima parte del rango.`;
      unidad = "z [m]";
    } else if (vista === "theta") {
      for (let k = 0; k < N * N; k++)
        t[k] = (Math.atan(P.S[k]) * 180) / Math.PI;
      [lo, hi] = minmax(t);
      txt = `θ de ${lo.toFixed(1)}° a ${hi.toFixed(1)}°.`;
      unidad = "θ [°]";
    } else if (vista === "acc") {
      for (let k = 0; k < N * N; k++) t[k] = Math.log(P.acc[k]);
      [lo, hi] = minmax(t);
      txt = `A de 1 a ${Math.round(Math.exp(hi))} celdas, en escala logarítmica. Los colores altos marcan la red de cauces.`;
      unidad = "ln A";
    } else {
      txt =
        "Cada color es una de las 8 direcciones D8. Blanco = celda sin receptor.";
    }
    return { t, lo, hi, txt, unidad };
  }

  // Raster coloreado (una celda = cs píxeles) y arreglo RGB para el 3D
  function crearBase(P, vista, cs) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = N * cs;
    const c = cv.getContext("2d"),
      v = valoresVista(P, vista),
      rgb = new Uint8Array(N * N * 3);
    for (let k = 0; k < N * N; k++) {
      const i = (k / N) | 0,
        j = k % N;
      let col;
      if (vista === "d8")
        col = P.dir[k] < 0 ? [255, 255, 255] : PAL_RGB[P.dir[k] + 1];
      else
        col =
          PAL_RGB[
            Math.min(
              9,
              Math.max(
                0,
                Math.floor(((v.t[k] - v.lo) / (v.hi - v.lo || 1)) * 10),
              ),
            )
          ];
      rgb.set(col, k * 3);
      c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      c.fillRect(j * cs, (N - 1 - i) * cs, cs, cs);
    }
    return { canvas: cv, rgb, ...v };
  }

  // Curvas de nivel por marching squares: segmentos en coordenadas de celda
  function contornos(F, niveles) {
    const [lo, hi] = minmax(F),
      segs = [];
    for (let l = 1; l <= niveles; l++) {
      const L = lo + ((hi - lo) * l) / (niveles + 1);
      for (let i = 0; i < N - 1; i++) {
        for (let j = 0; j < N - 1; j++) {
          const a = F[i * N + j],
            b = F[i * N + j + 1],
            c = F[(i + 1) * N + j + 1],
            d = F[(i + 1) * N + j];
          const cruza = (v1, v2) => v1 < L !== v2 < L,
            t = (v1, v2) => (L - v1) / (v2 - v1),
            pts = [];
          if (cruza(a, b)) pts.push([j + t(a, b), i]);
          if (cruza(b, c)) pts.push([j + 1, i + t(b, c)]);
          if (cruza(d, c)) pts.push([j + t(d, c), i + 1]);
          if (cruza(a, d)) pts.push([j, i + t(a, d)]);
          for (let p = 0; p + 1 < pts.length; p += 2)
            segs.push([...pts[p], ...pts[p + 1]]);
        }
      }
    }
    return segs;
  }

  function flecha(c, x, y, vx, vy, L, f) {
    const m = Math.hypot(vx, vy);
    if (m < 1e-12) return;
    const ux = vx / m,
      uy = vy / m,
      x2 = x + (ux * L) / 2,
      y2 = y + (uy * L) / 2;
    c.beginPath();
    c.moveTo(x - (ux * L) / 2, y - (uy * L) / 2);
    c.lineTo(x2, y2);
    c.lineTo(x2 - (ux * 4 - uy * 2.5) * f, y2 - (uy * 4 + ux * 2.5) * f);
    c.moveTo(x2, y2);
    c.lineTo(x2 - (ux * 4 + uy * 2.5) * f, y2 - (uy * 4 - ux * 2.5) * f);
    c.stroke();
  }

  // ---------- Mapa 2D ----------
  // D = {P, H, seg}; o = {cs, base (canvas), capas, vista, sel}
  function dibujar2D(ctx, D, o) {
    const { P, H, seg } = D,
      cs = o.cs,
      f = cs / 6,
      capas = o.capas;
    const cx = (k) => (k % N) * cs + cs / 2,
      cy = (k) => (N - 1 - ((k / N) | 0)) * cs + cs / 2;
    ctx.drawImage(o.base, 0, 0);

    if (capas.contornos) {
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 0.7 * f;
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of seg) {
        ctx.moveTo(x1 * cs + cs / 2, (N - 1 - y1) * cs + cs / 2);
        ctx.lineTo(x2 * cs + cs / 2, (N - 1 - y2) * cs + cs / 2);
      }
      ctx.stroke();
    }
    if (capas.cauces) {
      ctx.fillStyle = "#0a2cff";
      for (let k = 0; k < N * N; k++)
        if (H.cauces[k])
          ctx.fillRect(cx(k) - 2 * f, cy(k) - 2 * f, 4 * f, 4 * f);
    }
    if (capas.parteaguas) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2.5 * f;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let k = 0; k < N * N; k++) {
        if (!H.borde[k]) continue;
        const i = (k / N) | 0,
          j = k % N,
          x = j * cs,
          y = (N - 1 - i) * cs,
          c = H.cuenca;
        if (j === 0 || !c[k - 1]) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cs);
        }
        if (j === N - 1 || !c[k + 1]) {
          ctx.moveTo(x + cs, y);
          ctx.lineTo(x + cs, y + cs);
        }
        if (i === N - 1 || !c[k + N]) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cs, y);
        }
        if (i === 0 || !c[k - N]) {
          ctx.moveTo(x, y + cs);
          ctx.lineTo(x + cs, y + cs);
        }
      }
      ctx.stroke();
    }
    if (capas.flechas) {
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.2 * f;
      for (let i = 2; i < N; i += 5) {
        for (let j = 2; j < N; j += 5) {
          const k = i * N + j;
          if (o.vista === "d8") {
            if (P.rc[k] >= 0)
              flecha(
                ctx,
                cx(k),
                cy(k),
                (P.rc[k] % N) - j,
                -(((P.rc[k] / N) | 0) - i),
                12 * f,
                f,
              );
          } else flecha(ctx, cx(k), cy(k), -P.Zx[k], P.Zy[k], 12 * f, f);
        }
      }
    }
    if (capas.principal && H.ruta.length > 1) {
      ctx.strokeStyle = "#e00000";
      ctx.lineWidth = 2.5 * f;
      ctx.lineJoin = "round";
      ctx.beginPath();
      H.ruta.forEach((k, t) =>
        t ? ctx.lineTo(cx(k), cy(k)) : ctx.moveTo(cx(k), cy(k)),
      );
      ctx.stroke();
    }
    // Salida: cuadro blanco
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5 * f;
    ctx.fillRect(cx(H.salida) - 4 * f, cy(H.salida) - 4 * f, 8 * f, 8 * f);
    ctx.strokeRect(cx(H.salida) - 4 * f, cy(H.salida) - 4 * f, 8 * f, 8 * f);
    if (o.sel >= 0) {
      ctx.strokeStyle = "#d50000";
      ctx.lineWidth = 2 * f;
      ctx.strokeRect(
        (o.sel % N) * cs - f,
        (N - 1 - ((o.sel / N) | 0)) * cs - f,
        cs + 2 * f,
        cs + 2 * f,
      );
    }
  }

  // ---------- Vista 3D (proyección propia sobre un lienzo 2D) ----------
  // o = {size, az, inc, ex, rgb, capas, sel, fondo}
  function dibujar3D(ctx, D, o) {
    const { P, H, dx } = D,
      { F, Zx, Zy } = P,
      W = o.size,
      f = W / 600,
      capas = o.capas;
    const az = (o.az * Math.PI) / 180,
      ti = (o.inc * Math.PI) / 180,
      sa = Math.sin(az),
      ca = Math.cos(az);
    const m = ((N - 1) * dx) / 2,
      k = (W * 0.85) / (2 * m * 1.414),
      kz = k * o.ex;
    const [lo, hi] = minmax(F),
      zm = (lo + hi) / 2;
    const px = new Float64Array(N * N),
      py = new Float64Array(N * N),
      dp = new Float64Array(N * N);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const q = i * N + j,
          x = j * dx - m,
          y = i * dx - m,
          d = x * sa + y * ca;
        dp[q] = d;
        px[q] = W / 2 + (x * ca - y * sa) * k;
        py[q] = W / 2 - d * k * Math.sin(ti) - (F[q] - zm) * kz * Math.cos(ti);
      }
    }
    const qs = [];
    for (let i = 0; i < N - 1; i++)
      for (let j = 0; j < N - 1; j++) qs.push(i * N + j);
    qs.sort((p, q) => dp[q] - dp[p]);
    ctx.clearRect(0, 0, W, W);
    if (o.fondo) {
      ctx.fillStyle = o.fondo;
      ctx.fillRect(0, 0, W, W);
    }
    for (const q of qs) {
      const sh = Math.max(0.6, Math.min(1.3, 1 - 0.56 * (Zx[q] - Zy[q])));
      const r = Math.min(255, (o.rgb[q * 3] * sh) | 0),
        g = Math.min(255, (o.rgb[q * 3 + 1] * sh) | 0),
        b = Math.min(255, (o.rgb[q * 3 + 2] * sh) | 0);
      ctx.fillStyle = ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 0.6 * f;
      ctx.beginPath();
      ctx.moveTo(px[q], py[q]);
      ctx.lineTo(px[q + 1], py[q + 1]);
      ctx.lineTo(px[q + N + 1], py[q + N + 1]);
      ctx.lineTo(px[q + N], py[q + N]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Capas encima del relieve (no se ocultan detrás de las lomas)
    if (capas.cauces) {
      ctx.fillStyle = "#0a2cff";
      for (let q = 0; q < N * N; q++)
        if (H.cauces[q])
          ctx.fillRect(px[q] - 1.5 * f, py[q] - 3.5 * f, 3 * f, 3 * f);
    }
    if (capas.parteaguas) {
      ctx.fillStyle = "#000";
      for (let q = 0; q < N * N; q++)
        if (H.borde[q])
          ctx.fillRect(px[q] - 1.5 * f, py[q] - 3.5 * f, 3 * f, 3 * f);
    }
    if (capas.principal && H.ruta.length > 1) {
      ctx.strokeStyle = "#e00000";
      ctx.lineWidth = 2.5 * f;
      ctx.lineJoin = "round";
      ctx.beginPath();
      H.ruta.forEach((q, t) =>
        t ? ctx.lineTo(px[q], py[q] - 3 * f) : ctx.moveTo(px[q], py[q] - 3 * f),
      );
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5 * f;
    ctx.fillRect(px[H.salida] - 4 * f, py[H.salida] - 7 * f, 8 * f, 8 * f);
    ctx.strokeRect(px[H.salida] - 4 * f, py[H.salida] - 7 * f, 8 * f, 8 * f);
    if (o.sel >= 0) {
      ctx.fillStyle = "#d50000";
      ctx.beginPath();
      ctx.arc(px[o.sel], py[o.sel] - 5 * f, 4 * f, 0, 7);
      ctx.fill();
    }
  }

  // ---------- Gráfica de línea sencilla ----------
  // o = {titulo, xl, yl, cero, dy, marcas, col, fondo}
  function grafica(canvas, xs, ys, o) {
    const col = o.col || COL_CLARO,
      c = canvas.getContext("2d"),
      W = canvas.width,
      Hh = canvas.height;
    const m = { l: 54, r: 14, t: 28, b: 40 };
    c.clearRect(0, 0, W, Hh);
    if (o.fondo) {
      c.fillStyle = o.fondo;
      c.fillRect(0, 0, W, Hh);
    }
    c.font = "12px 'Public Sans', 'Segoe UI', sans-serif";
    c.fillStyle = col.texto;
    c.textAlign = "center";
    c.fillText(o.titulo, W / 2, 16);
    if (xs.length < 2) {
      c.fillText("No hay datos para graficar", W / 2, Hh / 2);
      return;
    }
    const x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      marcas = o.marcas || [];
    let y0 = o.cero ? 0 : Math.min(...ys),
      y1 = Math.max(...ys, ...marcas.map((p) => p[1]));
    if (y1 === y0) y1 = y0 + 1;
    const X = (x) => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
    const Y = (y) => Hh - m.b - ((y - y0) / (y1 - y0)) * (Hh - m.t - m.b);
    c.lineWidth = 1;
    for (let t = 0; t <= 4; t++) {
      const xv = x0 + ((x1 - x0) * t) / 4,
        yv = y0 + ((y1 - y0) * t) / 4;
      c.strokeStyle = col.grid;
      c.beginPath();
      c.moveTo(m.l, Y(yv));
      c.lineTo(W - m.r, Y(yv));
      c.stroke();
      c.fillStyle = col.apagado;
      c.textAlign = "right";
      c.fillText(yv.toFixed(o.dy ?? 1), m.l - 5, Y(yv) + 4);
      c.textAlign = "center";
      c.fillText(xv.toFixed(0), X(xv), Hh - m.b + 15);
    }
    c.strokeStyle = col.texto;
    c.strokeRect(m.l, m.t, W - m.l - m.r, Hh - m.t - m.b);
    c.fillStyle = col.texto;
    c.textAlign = "center";
    c.fillText(o.xl, (m.l + W - m.r) / 2, Hh - 5);
    c.save();
    c.translate(13, (m.t + Hh - m.b) / 2);
    c.rotate(-Math.PI / 2);
    c.fillText(o.yl, 0, 0);
    c.restore();
    c.strokeStyle = col.linea;
    c.lineWidth = 2;
    c.beginPath();
    xs.forEach((x, i) =>
      i ? c.lineTo(X(x), Y(ys[i])) : c.moveTo(X(x), Y(ys[i])),
    );
    c.stroke();
    c.fillStyle = col.marca;
    for (const [x, y] of marcas) {
      c.beginPath();
      c.arc(X(x), Y(y), 3.5, 0, 7);
      c.fill();
    }
  }

  // Agrega una barra de colores con valores a la derecha de un mapa (para figuras)
  function conLeyenda(cv, lo, hi, titulo) {
    const W = cv.width,
      H = cv.height,
      extra = Math.round(W * 0.17),
      f = W / 600;
    const out = document.createElement("canvas");
    out.width = W + extra;
    out.height = H;
    const c = out.getContext("2d");
    c.fillStyle = "#fff";
    c.fillRect(0, 0, out.width, H);
    c.drawImage(cv, 0, 0);
    const bx = W + 16 * f,
      bw = 22 * f,
      by = H * 0.12,
      bh = H * 0.72,
      h = bh / 10;
    for (let i = 0; i < 10; i++) {
      c.fillStyle = PALETA[9 - i];
      c.fillRect(bx, by + i * h, bw, h);
    }
    c.strokeStyle = COL_CLARO.texto;
    c.lineWidth = f;
    c.strokeRect(bx, by, bw, bh);
    c.fillStyle = COL_CLARO.texto;
    c.font = `${12 * f}px sans-serif`;
    c.textAlign = "left";
    for (let t = 0; t <= 10; t += 2)
      c.fillText(
        (hi - ((hi - lo) * t) / 10).toFixed(1),
        bx + bw + 5 * f,
        by + t * h + 4 * f,
      );
    c.fillText(titulo, bx, by - 10 * f);
    return out;
  }

  root.Dibujo = {
    PALETA,
    COL_CLARO,
    valoresVista,
    crearBase,
    contornos,
    dibujar2D,
    dibujar3D,
    grafica,
    conLeyenda,
  };
})(typeof window !== "undefined" ? window : globalThis);
