// =====================================================================
//  index.js — La aplicación: estado, guardado automático, historial,
//  versiones, paneles de resultados y exportación.
//  Cálculos: modelo.js · Dibujo: dibujo.js · Archivos: exportar.js
// =====================================================================
(() => {
  "use strict";
  const { N } = Modelo;
  const $ = (id) => document.getElementById(id);
  const CS = 6; // píxeles por celda en pantalla
  const K = {
    estado: "raster.estado",
    hist: "raster.historial",
    vers: "raster.versiones",
    ui: "raster.ui",
  };

  // Valores de la tabla de la guía (solo aplican al terreno de ejemplo, Δ = 10 y B = 15)
  const REF = {
    nW: 6956,
    A: 0.696,
    Asup: 0.744,
    L: 1046,
    dz: 135.7,
    Smed: 0.13,
    Smax: 0.252,
    Smin: 0.015,
    tc: 9.05,
  };

  // ---------- Almacenamiento local (nunca debe romper la app) ----------
  const Almacen = {
    leer(k, def) {
      try {
        const s = localStorage.getItem(k);
        return s ? JSON.parse(s) : def;
      } catch (e) {
        return def;
      }
    },
    escribir(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch (e) {
        return false;
      }
    },
    borrar(k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        /* sin acceso */
      }
    },
  };

  // ---------- Estado ----------
  const UI0 = {
    tab: "terreno",
    vista: "z",
    modo: "2d",
    capas: {
      contornos: false,
      parteaguas: true,
      cauces: true,
      principal: true,
      flechas: false,
    },
    az: -30,
    inc: 50,
    ex: 2,
    ang: 0,
    tema: "claro",
    equipo: "",
    integrantes: "",
    notas: "",
  };
  const CLAVES_T = [
    "z0",
    "s",
    "H",
    "W",
    "xc",
    "M",
    "pm",
    "ph",
    "a",
    "b",
    "pa",
    "pb",
    "B",
  ];

  function nuevoModelo() {
    return {
      T: Modelo.ejemplo(),
      dx: 10,
      edic: {},
      salida: null,
      U: 100,
      C: 0.5,
      I: "30, 60, 90, 120",
    };
  }
  function validarModelo(m) {
    return !!(
      m &&
      m.T &&
      Array.isArray(m.T.h) &&
      CLAVES_T.every((c) => Number.isFinite(m.T[c])) &&
      Number.isFinite(m.dx) &&
      m.dx >= 1 &&
      m.edic &&
      typeof m.edic === "object" &&
      (m.salida === null ||
        (Number.isInteger(m.salida) && m.salida >= 0 && m.salida < N * N)) &&
      Number.isFinite(m.U) &&
      Number.isFinite(m.C) &&
      typeof m.I === "string"
    );
  }

  let M = Almacen.leer(K.estado, null);
  if (!validarModelo(M)) M = nuevoModelo();
  let UI = Object.assign({}, UI0, Almacen.leer(K.ui, {}));
  UI.capas = Object.assign({}, UI0.capas, UI.capas);
  if (
    !localStorage.getItem(K.ui) &&
    window.matchMedia &&
    matchMedia("(prefers-color-scheme: dark)").matches
  )
    UI.tema = "oscuro";
  let versiones = Almacen.leer(K.vers, []);
  if (!Array.isArray(versiones)) versiones = [];
  versiones = versiones.filter((v) => v && validarModelo(v.M) && v.res);
  let hist = Almacen.leer(K.hist, null);
  let R,
    D,
    base,
    sel = -1,
    pick = false,
    barrido = null,
    temporizador = null,
    avisoTimer = null;

  const ctx = $("lienzo").getContext("2d"),
    ctx3 = $("lienzo3d").getContext("2d");

  // ---------- Utilidades ----------
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hora = (t) =>
    new Date(t).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const copiar = (o) => JSON.parse(JSON.stringify(o));
  const parseI = (s) =>
    String(s)
      .split(/[,\s;]+/)
      .map(Number)
      .filter((v) => Number.isFinite(v) && v > 0);

  function toast(msg, error = false) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast" + (error ? " error" : "");
    t.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(
      () => {
        t.hidden = true;
      },
      error ? 5000 : 2800,
    );
  }

  function descargar(nombre, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const bytesDeCanvas = (c) =>
    new Promise((ok, mal) =>
      c.toBlob(
        (b) =>
          b
            ? b.arrayBuffer().then((ab) => ok(new Uint8Array(ab)))
            : mal(new Error("No se pudo crear la imagen")),
        "image/png",
      ),
    );
  const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Cálculo ----------
  function calcular(Mx) {
    const { Z, err } = Modelo.crearDEM(Mx.T, Mx.dx);
    for (const k in Mx.edic) Z[k] = Mx.edic[k];
    const P = Modelo.procesar(Z, Mx.dx);
    const sal =
      Mx.salida !== null && Mx.salida !== undefined
        ? Mx.salida
        : Modelo.salidaAutomatica(P.acc);
    const H = Modelo.hidrologia(P, Mx.dx, sal, Mx.U);
    const G = Modelo.gastos(H, Mx.C, parseI(Mx.I));
    return { Z, err, P, H, G, sal };
  }

  function resumir(Mx, Rx) {
    const H = Rx.H;
    return {
      dx: Mx.dx,
      B: Mx.T.B,
      U: Mx.U,
      C: Mx.C,
      nW: H.nW,
      A: H.A_km2,
      Asup: H.A_sup / 1e6,
      L: H.L,
      L3D: H.L3D,
      dz: H.desnivel,
      Smed: H.S_med,
      Smax: H.S_max,
      Smin: H.S_min,
      Sprom: H.S_prom_tramos,
      Sgrad: H.S_grad_prom,
      tc: H.tc,
      relleno: Rx.P.nf,
    };
  }

  const esEjemplo = () =>
    M.dx === 10 &&
    M.T.B === 15 &&
    Object.keys(M.edic).length === 0 &&
    JSON.stringify(M.T) ===
      JSON.stringify(Object.assign(Modelo.ejemplo(), { B: 15 }));

  // ---------- Guardado e historial ----------
  function persistir() {
    const ok =
      Almacen.escribir(K.estado, M) &&
      Almacen.escribir(K.hist, hist) &&
      Almacen.escribir(K.vers, versiones) &&
      Almacen.escribir(K.ui, UI);
    $("estadoGuardado").textContent = ok
      ? `Guardado ${hora(Date.now())}`
      : "No se pudo guardar en este navegador";
  }
  function programarGuardado() {
    $("estadoGuardado").textContent = "Guardando…";
    clearTimeout(temporizador);
    temporizador = setTimeout(persistir, 200);
  }

  function reiniciarHistorial(etq) {
    hist = { pila: [{ s: JSON.stringify(M), etq, t: Date.now() }], i: 0 };
  }
  if (
    !hist ||
    !Array.isArray(hist.pila) ||
    !hist.pila.length ||
    !hist.pila[hist.i] ||
    hist.pila[hist.i].s !== JSON.stringify(M)
  ) {
    reiniciarHistorial("Proyecto recuperado");
  }

  function commit(etq) {
    const s = JSON.stringify(M);
    if (hist.pila[hist.i].s === s) return;
    hist.pila = hist.pila.slice(0, hist.i + 1);
    hist.pila.push({ s, etq, t: Date.now() });
    if (hist.pila.length > 60) hist.pila.shift();
    hist.i = hist.pila.length - 1;
  }
  function irAHistorial(i) {
    if (i < 0 || i >= hist.pila.length || i === hist.i) return;
    hist.i = i;
    M = JSON.parse(hist.pila[i].s);
    sel = -1;
    volcarInputs();
    aplicar();
  }
  const deshacer = () => irAHistorial(hist.i - 1);
  const rehacer = () => irAHistorial(hist.i + 1);

  // ---------- Aplicar el modelo a la pantalla ----------
  function volcarInputs() {
    $("campoDx").value = M.dx;
    $("campoB").value = M.T.B;
    $("campoU").value = M.U;
    $("campoC").value = M.C;
    $("campoI").value = M.I;
  }

  function aplicar() {
    R = calcular(M);
    D = { P: R.P, H: R.H, dx: M.dx, seg: Dibujo.contornos(R.P.F, 20) };
    base = Dibujo.crearBase(R.P, UI.vista, CS);
    renderTodo();
    programarGuardado();
  }

  function renderTodo() {
    renderReglas();
    pintar();
    renderVerificacion();
    renderFlujo();
    renderSalida();
    renderResultados();
    renderGasto();
    renderInspector();
    renderHistorial();
    renderVersiones();
    renderGraficas();
    $("leyenda").textContent = base.txt;
  }

  // ---------- Mapa ----------
  function pintar() {
    if (UI.modo === "3d") {
      Dibujo.dibujar3D(ctx3, D, {
        size: 600,
        az: UI.az,
        inc: UI.inc,
        ex: UI.ex,
        rgb: base.rgb,
        capas: UI.capas,
        sel,
        fondo: null,
      });
    } else {
      Dibujo.dibujar2D(ctx, D, {
        cs: CS,
        base: base.canvas,
        capas: UI.capas,
        vista: UI.vista,
        sel,
      });
    }
  }

  function renderReglas() {
    const max = 99 * M.dx,
      marcas = 6;
    const vals = Array.from({ length: marcas }, (_, i) =>
      Math.round((max * i) / (marcas - 1)),
    );
    $("reglaX").innerHTML = vals.map((v) => `<span>${v}</span>`).join("");
    $("reglaY").innerHTML = vals
      .slice()
      .reverse()
      .map((v) => `<span>${v}</span>`)
      .join("");
    $("escala").textContent =
      `Una celda mide ${M.dx} × ${M.dx} m. El mapa cubre ${max} × ${max} m; las reglas están en metros.`;
  }

  function setVista(v) {
    UI.vista = v;
    document
      .querySelectorAll("#segVista button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.vista === v)),
      );
    base = Dibujo.crearBase(R.P, v, CS);
    $("leyenda").textContent = base.txt;
    pintar();
    programarGuardado();
  }

  function setModo(m) {
    UI.modo = m;
    document
      .querySelectorAll("#segModo button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.modo === m)),
      );
    $("lienzo").hidden = m === "3d";
    $("lienzo3d").hidden = m !== "3d";
    $("fila3d").hidden = m !== "3d";
    if (m === "3d" && pick) cancelarPick();
    pintar();
    programarGuardado();
  }

  function setCapa(c, v) {
    UI.capas[c] = v;
    const b = document.querySelector(`.chip[data-capa="${c}"]`);
    if (b) b.setAttribute("aria-pressed", String(v));
  }

  function celdaDe(e) {
    const r = $("lienzo").getBoundingClientRect(),
      j = Math.floor(((e.clientX - r.left) / r.width) * N),
      i = N - 1 - Math.floor(((e.clientY - r.top) / r.height) * N);
    return i < 0 || j < 0 || i >= N || j >= N ? -1 : i * N + j;
  }

  // ---------- Paneles ----------
  function renderVerificacion() {
    let lo = Infinity,
      hi = -Infinity;
    for (const z of R.Z) {
      if (z < lo) lo = z;
      if (z > hi) hi = z;
    }
    $("etiquetaMinimo").textContent = lo.toFixed(2);
    $("etiquetaMaximo").textContent = hi.toFixed(2);
    $("etiquetaError").textContent = Object.keys(M.edic).length
      ? `${R.err.toFixed(4)} (sin contar los puntos editados)`
      : R.err.toFixed(4);
    $("infoMalla").textContent =
      `Nodos x_j = j·Δ y y_i = i·Δ. Dominio de ${99 * M.dx} × ${99 * M.dx} m; área de celda Δ² = ${M.dx * M.dx} m².`;
  }

  function renderFlujo() {
    const P = R.P;
    let conRec = 0,
      maxAcc = 0,
      nCauce = 0;
    for (let k = 0; k < N * N; k++) {
      if (P.rc[k] >= 0) conRec++;
      if (P.acc[k] > maxAcc) maxAcc = P.acc[k];
      if (R.H.cauces[k]) nCauce++;
    }
    $("flujoInfo").innerHTML = `<dl class="datos">
      <dt>Celdas rellenadas (paso 3)</dt><dd>${P.nf}</dd>
      <dt>Acumulación máxima A(c)</dt><dd>${maxAcc} celdas</dd>
      <dt>Celdas con receptor</dt><dd>${conRec}</dd>
      <dt>Celdas sin receptor (borde o planas)</dt><dd>${N * N - conRec}</dd>
      <dt>Celdas dentro de la cuenca</dt><dd>${R.H.nW}</dd>
      <dt>Celdas de cauce (A ≥ ${M.U})</dt><dd>${nCauce}</dd></dl>
      ${P.nf > 0 ? `<p class="aviso alerta">Se rellenaron ${P.nf} celdas. Si son muchas, tu terreno tiene pozos artificiales, por ejemplo por rugosidad demasiado grande. Prueba bajar B.</p>` : ""}`;
    $("vistaPaleta").innerHTML = Dibujo.PALETA.map(
      (c) => `<div style="background:${c}"></div>`,
    ).join("");
  }

  function renderSalida() {
    const s = R.sal;
    $("infoSalida").textContent =
      `Salida en x = ${s % N}, y = ${(s / N) | 0}, z = ${R.P.F[s].toFixed(1)} m, A(c) = ${R.P.acc[s]} celdas (${M.salida !== null ? "elegida por ti" : "automática"}).`;
  }

  function filasRes(res) {
    const usa = esEjemplo();
    const f = (nom, val, num, ref, tol) => ({
      nom,
      val,
      ref: usa && ref != null ? ref : null,
      ok: usa && ref != null ? Math.abs(num - ref) <= tol : null,
    });
    return [
      f("Celdas en la cuenca", `${res.nW}`, res.nW, REF.nW, 0.5),
      f("Área planimétrica A", `${fmt(res.A, 3)} km²`, res.A, REF.A, 0.0015),
      f(
        "Área superficial A_sup",
        `${fmt(res.Asup, 3)} km²`,
        res.Asup,
        REF.Asup,
        0.0015,
      ),
      f("Longitud del cauce L", `${fmt(res.L, 1)} m`, res.L, REF.L, 1),
      f("Longitud real L3D", `${fmt(res.L3D, 1)} m`, res.L3D, null, 0),
      f("Desnivel z₀ − z_m", `${fmt(res.dz, 1)} m`, res.dz, REF.dz, 0.1),
      f("Pendiente media S_med", fmt(res.Smed, 3), res.Smed, REF.Smed, 0.0015),
      f("Pendiente máxima S_máx", fmt(res.Smax, 3), res.Smax, REF.Smax, 0.0015),
      f("Pendiente mínima S_mín", fmt(res.Smin, 3), res.Smin, REF.Smin, 0.0015),
      f(
        "Tiempo de concentración tc",
        `${fmt(res.tc, 2)} min`,
        res.tc,
        REF.tc,
        0.006,
      ),
    ];
  }

  function renderResultados() {
    const res = resumir(M, R),
      filas = filasRes(res),
      hayRef = filas.some((f) => f.ref !== null);
    let h = `<table><thead><tr><th>Parámetro</th><th>Valor</th>${hayRef ? "<th>Guía</th><th></th>" : ""}</tr></thead><tbody>`;
    for (const f of filas) {
      h +=
        `<tr><td>${f.nom}</td><td>${f.val}</td>` +
        (hayRef
          ? f.ref === null
            ? "<td></td><td></td>"
            : `<td>${f.ref}</td><td class="${f.ok ? "ok" : "mal"}">${f.ok ? "coincide" : "difiere"}</td>`
          : "") +
        "</tr>";
    }
    h += "</tbody></table>";
    if (hayRef)
      h += `<p class="nota">La columna Guía aparece solo con el terreno de ejemplo, Δ = 10 m y B = 15 m, y sin puntos editados.</p>`;
    if (!Number.isFinite(res.Smed))
      h += `<p class="aviso alerta">Esta salida no tiene cauce principal porque la acumulación aguas arriba es menor que 20 celdas. Elige otra salida o usa la automática.</p>`;
    $("resultados").innerHTML = h;
    $("comparaciones").innerHTML = respuestasHTML(res);
  }

  function respuestasHTML(res) {
    const theta = Math.atan(res.Sgrad);
    return `<p class="pregunta"><b>A contra A_sup.</b> A_sup / A = ${fmt(res.Asup / res.A, 3)}, y 1 / cos θ̄ = ${fmt(1 / Math.cos(theta), 3)} con la pendiente media de la cuenca (θ̄ = ${fmt((theta * 180) / Math.PI, 1)}°). Se parecen porque en un plano inclinado θ se cumple A_sup = A / cos θ.</p>
      <p class="pregunta"><b>Pendientes.</b> S_med del cauce, entre extremos = ${fmt(res.Smed, 3)}. Promedio de las S_k de los tramos = ${fmt(res.Sprom, 3)}. Promedio de ‖∇z‖ en toda la cuenca = ${fmt(res.Sgrad, 3)}. No son iguales: el cauce es el fondo del valle, mientras que ‖∇z‖ incluye las laderas, que son más empinadas.</p>
      <p class="aviso">El volumen contenido sobre la salida, ∬(z − z_salida) dA, necesita integral doble. Se agrega cuando vean ese tema.</p>`;
  }

  function renderGasto() {
    const H = R.H;
    $("tcBadge").textContent = Number.isFinite(H.tc)
      ? `tc = ${H.tc.toFixed(2)} min`
      : "tc sin calcular";
    let t = `<table><thead><tr><th>i [mm/h]</th><th>P = i·tc [mm]</th><th>Q [m³/s]</th><th>V = C·P·A [m³]</th></tr></thead><tbody>`;
    for (const g of R.G)
      t += `<tr><td>${g.i}</td><td>${fmt(g.P, 1)}</td><td>${fmt(g.Q, 2)}</td><td>${fmt(g.V, 0)}</td></tr>`;
    t += "</tbody></table>";
    $("tablaGasto").innerHTML = R.G.length
      ? t
      : `<p class="aviso alerta">Escribe al menos una intensidad mayor que cero, por ejemplo 30, 60, 90.</p>`;
    $("notaGasto").innerHTML =
      `Q = C·i·A / 3.6, con C = ${M.C} y A = ${fmt(H.A_km2, 3)} km². El método racional supone lluvia uniforme y es razonable para cuencas pequeñas (A &lt; 2.5 km²).` +
      (H.A_km2 >= 2.5 ? " <b>Esta cuenca ya supera ese límite.</b>" : "");
  }

  function renderInspector() {
    const el = $("inspector");
    if (sel < 0) {
      el.innerHTML = `<p class="vacio">Haz clic en una celda del mapa 2D para ver su gradiente y su derivada direccional.</p>`;
      return;
    }
    const P = R.P,
      k = sel,
      i = (k / N) | 0,
      j = k % N;
    const zx = P.Zx[k],
      zy = P.Zy[k],
      S = P.S[k],
      a = (UI.ang * Math.PI) / 180;
    const Du = zx * Math.cos(a) + zy * Math.sin(a);
    const interior = i > 0 && j > 0 && i < N - 1 && j < N - 1;
    const puro = !(String(k) in M.edic) && Math.abs(P.F[k] - R.Z[k]) < 1e-9;
    let analitico = "";
    if (interior && puro) {
      const [ax, ay] = Modelo.gradAnalitico(M.T, j * M.dx, i * M.dx);
      analitico = `<dt>Analítico: ∂z/∂x, ∂z/∂y</dt><dd>${ax.toFixed(4)}, ${ay.toFixed(4)}</dd>`;
    }
    const r = P.rc[k];
    el.innerHTML = `<dl>
      <dt>Posición</dt><dd>x = ${j * M.dx} m, y = ${i * M.dx} m</dd>
      <dt>Elevación z</dt><dd>${P.F[k].toFixed(2)} m</dd>
      <span class="sub">Gradiente</span>
      <dt>Diferencias finitas: ∂z/∂x, ∂z/∂y</dt><dd>${zx.toFixed(4)}, ${zy.toFixed(4)}</dd>
      ${analitico}
      <dt>Pendiente ‖∇z‖</dt><dd>${S.toFixed(4)}</dd>
      <dt>Ángulo del terreno θ</dt><dd>${((Math.atan(S) * 180) / Math.PI).toFixed(2)}°</dd>
      <dt>Dirección de máximo descenso φ</dt><dd>${((Math.atan2(-zy, -zx) * 180) / Math.PI).toFixed(1)}°</dd>
      <span class="sub">Derivada direccional</span>
      <dt>D_u z con u a ${UI.ang}°</dt><dd>${Du.toFixed(4)}</dd>
      <dt>|D_u z| ≤ ‖∇z‖</dt><dd>${Math.abs(Du) <= S + 1e-12 ? "se cumple" : "no se cumple"}</dd>
      <span class="sub">Flujo</span>
      <dt>Acumulación A(c)</dt><dd>${P.acc[k]} celdas</dd>
      <dt>Receptor D8</dt><dd>${r >= 0 ? `x = ${(r % N) * M.dx} m, y = ${((r / N) | 0) * M.dx} m` : "ninguno"}</dd>
      <dt>Dentro de la cuenca</dt><dd>${R.H.cuenca[k] ? "sí" : "no"}</dd></dl>`;
  }

  // ---------- Gráficas ----------
  function colGraf() {
    const cs = getComputedStyle(document.body),
      g = (n, d) => cs.getPropertyValue(n).trim() || d,
      c = Dibujo.COL_CLARO;
    return {
      texto: g("--tinta", c.texto),
      apagado: g("--apagado", c.apagado),
      grid: g("--linea", c.grid),
      linea: g("--agua", c.linea),
      marca: g("--marca", c.marca),
    };
  }
  function datosPerfil() {
    let a = 0;
    const s = [0];
    R.H.dl.forEach((l) => {
      a += l;
      s.push(a);
    });
    return { xs: s.map((v) => R.H.L - v), ys: R.H.zc };
  }
  function datosGasto() {
    const ii = Array.from({ length: 50 }, (_, k) => 10 + (140 * k) / 49);
    return {
      xs: ii,
      ys: ii.map((i) => (M.C * i * R.H.A_km2) / 3.6),
      marcas: R.G.map((g) => [g.i, g.Q]),
    };
  }
  function renderGraficas(extra = {}) {
    const p = datosPerfil(),
      g = datosGasto(),
      col = colGraf();
    Dibujo.grafica($("cvPerfil"), p.xs, p.ys, {
      titulo: "Perfil longitudinal del cauce principal",
      xl: "distancia desde la salida [m]",
      yl: "z [m]",
      col,
    });
    Dibujo.grafica($("cvGasto"), g.xs, g.ys, {
      titulo: "Gasto de pico (método racional)",
      xl: "i [mm/h]",
      yl: "Q [m³/s]",
      cero: true,
      marcas: g.marcas,
      col,
    });
  }

  // ---------- Historial ----------
  function renderHistorial() {
    $("btnUndo").disabled = hist.i <= 0;
    $("btnRedo").disabled = hist.i >= hist.pila.length - 1;
    let h = "";
    for (let i = hist.pila.length - 1; i >= 0; i--) {
      const e = hist.pila[i];
      h += `<li class="${i === hist.i ? "actual" : ""}"><button data-i="${i}"><span>${Exportar.esc(e.etq)}</span><time>${hora(e.t)}</time></button></li>`;
    }
    $("listaHistorial").innerHTML = h;
  }

  // ---------- Versiones ----------
  function columnaVersion(res) {
    return [
      res.dx,
      res.B,
      res.U,
      res.C,
      res.nW,
      fmt(res.A, 3),
      fmt(res.L, 1),
      fmt(res.Smed, 3),
      fmt(res.tc, 2),
      fmt((res.C * 60 * res.A) / 3.6, 2),
      fmt((res.C * 120 * res.A) / 3.6, 2),
    ];
  }
  const NOM_FILAS = [
    "Δ [m]",
    "B [m]",
    "U [celdas]",
    "C",
    "Celdas en la cuenca",
    "A [km²]",
    "L [m]",
    "S_med",
    "tc [min]",
    "Q con i = 60 mm/h [m³/s]",
    "Q con i = 120 mm/h [m³/s]",
  ];

  function tablaComparacion() {
    const cols = [
      { nombre: "Actual", col: columnaVersion(resumir(M, R)) },
      ...versiones.map((v) => ({
        nombre: v.nombre,
        col: columnaVersion(v.res),
      })),
    ];
    return {
      cols,
      filas: NOM_FILAS.map((n, i) => [n, ...cols.map((c) => c.col[i])]),
    };
  }

  function renderVersiones() {
    const ul = $("listaVersiones");
    if (!versiones.length) {
      ul.innerHTML = `<li class="vacio-lista">Aún no hay versiones. Guarda una para poder compararla con otras o volver a ella más tarde.</li>`;
      $("comparacion").innerHTML = "";
      $("btnCsvComp").disabled = true;
      return;
    }
    ul.innerHTML = versiones
      .map(
        (v) => `<li>
      <div class="nombre">${Exportar.esc(v.nombre)}</div>
      <div class="meta">${new Date(v.fecha).toLocaleString("es-MX")}. A = ${fmt(v.res.A, 3)} km², L = ${fmt(v.res.L, 0)} m, tc = ${fmt(v.res.tc, 2)} min</div>
      <div class="botones">
        <button class="boton claro" data-acc="restaurar" data-id="${v.id}">Volver a esta versión</button>
        <button class="boton claro" data-acc="renombrar" data-id="${v.id}">Cambiar nombre</button>
        <button class="boton claro" data-acc="borrar" data-id="${v.id}">Eliminar</button>
      </div></li>`,
      )
      .join("");
    const { cols, filas } = tablaComparacion();
    $("comparacion").innerHTML =
      `<div class="tabla-scroll"><table><thead><tr><th>Parámetro</th>${cols.map((c) => `<th>${Exportar.esc(c.nombre)}</th>`).join("")}</tr></thead><tbody>` +
      filas
        .map(
          (f) =>
            `<tr>${f.map((v) => `<td>${Exportar.esc(v)}</td>`).join("")}</tr>`,
        )
        .join("") +
      "</tbody></table></div>";
    $("btnCsvComp").disabled = false;
  }

  function guardarVersion() {
    const nombre =
      $("campoNombreVersion").value.trim() || `Versión ${versiones.length + 1}`;
    versiones.push({
      id: Date.now(),
      nombre,
      fecha: Date.now(),
      M: copiar(M),
      res: resumir(M, R),
    });
    $("campoNombreVersion").value = "";
    renderVersiones();
    programarGuardado();
    toast(`Versión “${nombre}” guardada.`);
  }

  // ---------- Experimento rápido ----------
  const VALORES_BARRIDO = {
    dx: "5, 10, 15, 20",
    B: "0, 5, 10, 15, 20",
    U: "25, 50, 100, 200",
    C: "0.2, 0.5, 0.8",
  };

  function ejecutarBarrido() {
    const p = $("bParam").value;
    const vals = $("bValores")
      .value.split(/[,\s;]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (!vals.length || vals.length > 12) {
      toast(
        "Escribe entre 1 y 12 valores numéricos separados por comas.",
        true,
      );
      return;
    }
    const limites = { dx: [1, 50], B: [0, 40], U: [1, 1e5], C: [0, 1] };
    if (vals.some((v) => v < limites[p][0] || v > limites[p][1])) {
      toast(
        `Los valores deben estar entre ${limites[p][0]} y ${limites[p][1]}.`,
        true,
      );
      return;
    }
    const filas = [];
    for (const v of vals) {
      const Mx = copiar(M);
      if (p === "dx") {
        Mx.dx = v;
        Mx.edic = {};
        Mx.salida = null;
      } else if (p === "B") {
        Mx.T.B = v;
        Mx.edic = {};
        Mx.salida = null;
      } else if (p === "U") Mx.U = Math.round(v);
      else Mx.C = v;
      const res = resumir(Mx, calcular(Mx));
      filas.push([
        v,
        res.nW,
        +res.A.toFixed(3),
        +res.L.toFixed(1),
        +res.Smed.toFixed(3),
        +res.tc.toFixed(2),
        +((res.C * 60 * res.A) / 3.6).toFixed(2),
      ]);
    }
    const nombre = $("bParam").selectedOptions[0].textContent;
    barrido = { nombre, filas };
    const cab = [
      nombre,
      "Celdas",
      "A [km²]",
      "L [m]",
      "S_med",
      "tc [min]",
      "Q con 60 mm/h [m³/s]",
    ];
    $("bTabla").innerHTML =
      `<div class="tabla-scroll"><table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>` +
      filas
        .map(
          (f) =>
            `<tr>${f.map((v) => `<td>${Number.isFinite(v) ? v : "—"}</td>`).join("")}</tr>`,
        )
        .join("") +
      "</tbody></table></div>" +
      (p === "dx"
        ? `<p class="nota">Con N = 100 fijo, cambiar Δ cambia el tamaño físico del terreno, así que la misma función se recorta o se amplía.</p>`
        : "");
    $("bCsv").disabled = false;
  }

  // ---------- Exportación ----------
  const mk = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  const nombreBase = () =>
    "cuenca_" +
    (UI.equipo
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "proyecto");

  function armarFiguras() {
    const cs = 12,
      W = N * cs;
    const bz = Dibujo.crearBase(R.P, "z", cs),
      bt = Dibujo.crearBase(R.P, "theta", cs);
    const c1 = mk(W, W);
    Dibujo.dibujar2D(c1.getContext("2d"), D, {
      cs,
      base: bz.canvas,
      capas: {
        contornos: true,
        parteaguas: true,
        cauces: true,
        principal: true,
        flechas: false,
      },
      vista: "z",
      sel: -1,
    });
    const c2 = mk(W, W);
    Dibujo.dibujar2D(c2.getContext("2d"), D, {
      cs,
      base: bt.canvas,
      capas: { parteaguas: true },
      vista: "theta",
      sel: -1,
    });
    const c3 = mk(1200, 1200);
    Dibujo.dibujar3D(c3.getContext("2d"), D, {
      size: 1200,
      az: UI.az,
      inc: UI.inc,
      ex: UI.ex,
      rgb: bz.rgb,
      capas: { principal: true, parteaguas: true },
      sel: -1,
      fondo: "#fff",
    });
    const pf = datosPerfil(),
      gs = datosGasto(),
      cp = mk(560, 340),
      cg = mk(560, 340),
      c4 = mk(1120, 340);
    Dibujo.grafica(cp, pf.xs, pf.ys, {
      titulo: "Perfil longitudinal del cauce principal",
      xl: "distancia desde la salida [m]",
      yl: "z [m]",
      fondo: "#fff",
    });
    Dibujo.grafica(cg, gs.xs, gs.ys, {
      titulo: "Gasto de pico (método racional)",
      xl: "i [mm/h]",
      yl: "Q [m³/s]",
      cero: true,
      marcas: gs.marcas,
      fondo: "#fff",
    });
    const x4 = c4.getContext("2d");
    x4.drawImage(cp, 0, 0);
    x4.drawImage(cg, 560, 0);
    return {
      fig_contornos: Dibujo.conLeyenda(c1, bz.lo, bz.hi, "z [m]"),
      fig_pendiente: Dibujo.conLeyenda(c2, bt.lo, bt.hi, "θ [°]"),
      fig_3d: c3,
      fig_perfil_gasto: c4,
    };
  }

  function mapaActual() {
    if (UI.modo === "3d") {
      const c = mk(1200, 1200);
      Dibujo.dibujar3D(c.getContext("2d"), D, {
        size: 1200,
        az: UI.az,
        inc: UI.inc,
        ex: UI.ex,
        rgb: base.rgb,
        capas: UI.capas,
        sel: -1,
        fondo: "#fff",
      });
      return { c, nombre: "vista_3d" };
    }
    const cs = 12,
      b = Dibujo.crearBase(R.P, UI.vista, cs),
      c = mk(N * cs, N * cs);
    Dibujo.dibujar2D(c.getContext("2d"), D, {
      cs,
      base: b.canvas,
      capas: UI.capas,
      vista: UI.vista,
      sel: -1,
    });
    const conLey = UI.vista === "z" || UI.vista === "theta";
    return {
      c: conLey ? Dibujo.conLeyenda(c, b.lo, b.hi, b.unidad) : c,
      nombre: "mapa_" + UI.vista,
    };
  }

  function paramsTabla() {
    const T = M.T,
      n = (v) => +v.toFixed(3);
    const f = [
      ["z₀, cota base [m]", n(T.z0)],
      ["s, inclinación general", n(T.s)],
      ["H, profundidad del valle [m]", n(T.H)],
      ["W, ancho del valle [m]", n(T.W)],
      ["xc, eje del valle [m]", n(T.xc)],
      ["M, meandro del eje [m]", n(T.M)],
      ["pm, longitud del meandro [m]", n(T.pm)],
      ["φ, fase del meandro", n(T.ph)],
      ["B, rugosidad [m]", n(T.B)],
      ["a, escala de la rugosidad en x [m]", n(T.a)],
      ["b, escala de la rugosidad en y [m]", n(T.b)],
      ["pa, fase en x", n(T.pa)],
      ["pb, fase en y", n(T.pb)],
    ];
    T.h.forEach((c, i) =>
      f.push([
        `Colina ${i + 1}`,
        `A = ${n(c[3])} m en (${n(c[0])}, ${n(c[1])}) con σ = ${n(c[2])} m`,
      ]),
    );
    const ed = Object.keys(M.edic).length;
    if (ed) f.push(["Puntos editados a mano", ed]);
    return f;
  }

  function datosReporte(imgs) {
    const res = resumir(M, R);
    return {
      fecha: new Date().toLocaleString("es-MX"),
      equipo: UI.equipo,
      integrantes: UI.integrantes,
      notas: UI.notas,
      params: paramsTabla(),
      dx: M.dx,
      filas: filasRes(res).map((f) => [f.nom, f.val]),
      gasto: R.G.map((g) => [g.i, fmt(g.P, 1), fmt(g.Q, 2), fmt(g.V, 0)]),
      tc: fmt(R.H.tc, 2),
      C: M.C,
      imgs,
      versiones,
      respuestasHTML: respuestasHTML(res),
    };
  }

  function csvResultados() {
    const res = resumir(M, R);
    const unidades = ["", "km²", "km²", "m", "m", "m", "", "", "", "min"];
    const filas = [["Parámetro", "Valor", "Unidad"]];
    filasRes(res).forEach((f, i) =>
      filas.push([
        f.nom,
        parseFloat(f.val.replace("—", "")) || "",
        unidades[i],
      ]),
    );
    filas.push(
      ["Coeficiente C", M.C, ""],
      ["Umbral U", M.U, "celdas"],
      ["Espaciamiento Δ", M.dx, "m"],
      ["Rugosidad B", M.T.B, "m"],
      [],
    );
    filas.push(["i [mm/h]", "P = i·tc [mm]", "Q [m³/s]", "V = C·P·A [m³]"]);
    R.G.forEach((g) =>
      filas.push([g.i, +g.P.toFixed(3), +g.Q.toFixed(4), +g.V.toFixed(1)]),
    );
    return Exportar.csv(filas);
  }

  function jsonProyecto() {
    return JSON.stringify(
      {
        formato: "raster-cuenca",
        version: 1,
        exportado: new Date().toISOString(),
        modelo: M,
        equipo: {
          nombre: UI.equipo,
          integrantes: UI.integrantes,
          notas: UI.notas,
        },
        versiones,
      },
      null,
      2,
    );
  }

  async function exportarZip() {
    try {
      toast("Preparando el paquete…");
      await pausa(30);
      const figs = armarFiguras(),
        imgs = {},
        archivos = [];
      for (const [n, c] of Object.entries(figs)) {
        imgs[n] = c.toDataURL("image/png");
        archivos.push({
          name: `figuras/${n}.png`,
          data: await bytesDeCanvas(c),
        });
      }
      const txt = (nombre, s) =>
        archivos.push({ name: nombre, data: Exportar.codificar(s) });
      txt("reporte.html", Exportar.reporteHTML(datosReporte(imgs)));
      txt("resultados.csv", csvResultados());
      txt("raster_z.csv", Exportar.csvRaster(R.P.F, N, M.dx));
      if (R.P.nf > 0)
        txt("raster_original.csv", Exportar.csvRaster(R.Z, N, M.dx));
      txt(
        "cauce_principal.csv",
        Exportar.csvCauce(R.H.ruta, R.P.F, N, M.dx, R.H.dl),
      );
      if (versiones.length)
        txt(
          "comparacion_versiones.csv",
          Exportar.csv(
            tablaComparacion().filas.length
              ? [
                  [
                    "Parámetro",
                    ...tablaComparacion().cols.map((c) => c.nombre),
                  ],
                  ...tablaComparacion().filas,
                ]
              : [],
          ),
        );
      txt("proyecto.json", jsonProyecto());
      txt(
        "LEEME.txt",
        "Paquete del proyecto de cuenca.\r\n\r\nreporte.html  Ábrelo en el navegador; con Imprimir puedes guardarlo como PDF.\r\nfiguras/      Las cuatro figuras que pide la guía.\r\nraster_z.csv  Elevaciones del raster de 100 x 100 (fila = y, columna = x, en metros).\r\ncauce_principal.csv  Celdas del cauce principal con su perfil.\r\nresultados.csv  Parámetros de la cuenca y gasto.\r\nproyecto.json  Para volver a abrir todo en la página con Proyecto > Abrir proyecto.\r\n",
      );
      descargar(
        `${nombreBase()}.zip`,
        new Blob([Exportar.zip(archivos)], { type: "application/zip" }),
      );
      toast("Paquete listo. Revisa tu carpeta de descargas.");
    } catch (e) {
      toast("No se pudo crear el paquete: " + e.message, true);
    }
  }

  async function exportarFiguras() {
    try {
      const figs = armarFiguras();
      for (const [n, c] of Object.entries(figs)) {
        descargar(
          `${n}.png`,
          new Blob([await bytesDeCanvas(c)], { type: "image/png" }),
        );
        await pausa(350);
      }
      toast("Se descargaron las cuatro figuras.");
    } catch (e) {
      toast("No se pudieron crear las figuras: " + e.message, true);
    }
  }

  function abrirReporte() {
    try {
      const imgs = {};
      for (const [n, c] of Object.entries(armarFiguras()))
        imgs[n] = c.toDataURL("image/png");
      let html = Exportar.reporteHTML(datosReporte(imgs));
      const blob = new Blob(
        [
          html.replace(
            "</body>",
            "<script>window.onload=function(){setTimeout(function(){window.print()},600)}<\/script></body>",
          ),
        ],
        { type: "text/html" },
      );
      const url = URL.createObjectURL(blob),
        w = window.open(url, "_blank");
      if (!w) {
        descargar(
          `${nombreBase()}_reporte.html`,
          new Blob([html], { type: "text/html" }),
        );
        toast(
          "El navegador bloqueó la ventana. Descargué el reporte: ábrelo e imprímelo.",
        );
      }
    } catch (e) {
      toast("No se pudo crear el reporte: " + e.message, true);
    }
  }

  async function exportarPNG() {
    try {
      const { c, nombre } = mapaActual();
      descargar(
        `${nombre}.png`,
        new Blob([await bytesDeCanvas(c)], { type: "image/png" }),
      );
    } catch (e) {
      toast("No se pudo crear la imagen: " + e.message, true);
    }
  }

  // ---------- Abrir y borrar ----------
  function abrirJSON(archivo) {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const d = JSON.parse(lector.result);
        if (d.formato !== "raster-cuenca" || !validarModelo(d.modelo))
          throw new Error("no es un proyecto de esta página");
        if (
          !confirm(
            "Esto reemplaza el proyecto que tienes ahora, incluidas las versiones guardadas. ¿Continuar?",
          )
        )
          return;
        M = d.modelo;
        versiones = Array.isArray(d.versiones)
          ? d.versiones.filter((v) => v && validarModelo(v.M) && v.res)
          : [];
        UI.equipo = (d.equipo && d.equipo.nombre) || "";
        UI.integrantes = (d.equipo && d.equipo.integrantes) || "";
        UI.notas = (d.equipo && d.equipo.notas) || "";
        sel = -1;
        reiniciarHistorial("Proyecto abierto desde archivo");
        volcarInputs();
        volcarEquipo();
        aplicar();
        toast("Proyecto abierto.");
      } catch (e) {
        toast("No se pudo abrir el archivo: " + e.message + ".", true);
      }
    };
    lector.readAsText(archivo);
  }

  function reiniciarTodo() {
    if (
      !confirm(
        "Se borrarán el terreno, el historial, las versiones y los datos del equipo de este navegador. ¿Empezar de cero?",
      )
    )
      return;
    Object.values(K).forEach(Almacen.borrar);
    M = nuevoModelo();
    versiones = [];
    sel = -1;
    UI.equipo = "";
    UI.integrantes = "";
    UI.notas = "";
    reiniciarHistorial("Inicio desde cero");
    volcarInputs();
    volcarEquipo();
    aplicar();
    toast("Proyecto reiniciado.");
  }

  function volcarEquipo() {
    $("campoEquipo").value = UI.equipo;
    $("campoIntegrantes").value = UI.integrantes;
    $("campoNotas").value = UI.notas;
  }

  // ---------- Pestañas ----------
  const TABS = ["terreno", "flujo", "cuenca", "gasto", "proyecto"];
  function irTab(t, enfocar) {
    UI.tab = t;
    for (const n of TABS) {
      const b = $("t-" + n),
        activo = n === t;
      b.setAttribute("aria-selected", String(activo));
      b.tabIndex = activo ? 0 : -1;
      $("tab-" + n).hidden = !activo;
      if (activo && enfocar) b.focus();
    }
    programarGuardado();
  }

  // ---------- Selección de la salida ----------
  function cancelarPick() {
    pick = false;
    $("btnPick").classList.remove("activo");
    $("btnPick").textContent = "Elegir salida en el mapa";
    $("pista").hidden = true;
  }

  // ---------- Eventos ----------
  function cambioTerreno(etq) {
    M.edic = {};
    M.salida = null;
    sel = -1;
    commit(etq);
    aplicar();
  }

  $("campoDx").onchange = () => {
    M.dx = clamp(Math.round(+$("campoDx").value) || 10, 1, 50);
    $("campoDx").value = M.dx;
    cambioTerreno(`Espaciamiento Δ = ${M.dx} m`);
  };
  $("campoB").onchange = () => {
    M.T.B = clamp(+$("campoB").value || 0, 0, 40);
    $("campoB").value = M.T.B;
    cambioTerreno(`Rugosidad B = ${M.T.B} m`);
  };
  $("campoU").onchange = () => {
    M.U = Math.max(1, Math.round(+$("campoU").value) || 100);
    $("campoU").value = M.U;
    commit(`Umbral de cauce U = ${M.U}`);
    aplicar();
  };
  $("campoC").onchange = () => {
    M.C = clamp(+$("campoC").value || 0, 0, 1);
    $("campoC").value = M.C;
    commit(`Coeficiente C = ${M.C}`);
    aplicar();
  };
  $("campoI").onchange = () => {
    const v = parseI($("campoI").value);
    if (!v.length) {
      toast(
        "Escribe al menos una intensidad mayor que cero, por ejemplo 30, 60, 90.",
        true,
      );
      $("campoI").value = M.I;
      return;
    }
    M.I = v.join(", ");
    $("campoI").value = M.I;
    commit(`Intensidades: ${M.I} mm/h`);
    aplicar();
  };

  $("botonRestaurar").onclick = () => {
    M = nuevoModelo();
    sel = -1;
    volcarInputs();
    commit("Terreno de ejemplo");
    aplicar();
  };
  $("botonAleatorio").onclick = () => {
    const Dd = 99 * M.dx,
      r = (a, b) => a + Math.random() * (b - a);
    M.T = {
      B: Math.round(r(3, 28)),
      z0: r(60, 140),
      s: r(0.04, 0.28),
      H: r(25, 75),
      W: r(0.2, 0.45) * Dd,
      xc: r(0.25, 0.75) * Dd,
      M: r(0, 0.18) * Dd,
      pm: r(0.12, 0.4) * Dd,
      ph: r(0, 6.28),
      a: r(40, 130),
      b: r(40, 130),
      pa: r(0, 6.28),
      pb: r(0, 6.28),
      h: Array.from({ length: 2 + Math.floor(Math.random() * 5) }, () => [
        r(0.1, 0.9) * Dd,
        r(0.1, 0.9) * Dd,
        r(0.05, 0.14) * Dd,
        Math.random() < 0.7 ? r(15, 45) : -r(8, 22),
      ]),
    };
    volcarInputs();
    cambioTerreno("Terreno aleatorio");
  };

  $("botonAplicar").onclick = () => {
    const x = parseInt($("campoX").value),
      y = parseInt($("campoY").value);
    if (isNaN(x) || isNaN(y) || x < 0 || x > 99 || y < 0 || y > 99) {
      toast("Escribe x e y enteros entre 0 y 99.", true);
      return;
    }
    let z;
    if ($("campoZ").value.trim() === "") {
      let lo = Infinity,
        hi = -Infinity;
      for (const v of R.Z) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      z = parseFloat((lo + Math.random() * (hi - lo)).toFixed(2));
      $("campoZ").value = z;
    } else {
      z = parseFloat($("campoZ").value);
      if (isNaN(z)) {
        toast("Escribe un valor numérico para z.", true);
        return;
      }
    }
    M.edic[y * N + x] = Math.round(z * 100) / 100;
    sel = y * N + x;
    commit(`Punto (${x}, ${y}) con z = ${z} m`);
    aplicar();
  };

  $("campoAng").oninput = (e) => {
    UI.ang = +e.target.value;
    $("eAng").textContent = UI.ang;
    renderInspector();
    programarGuardado();
  };

  document
    .querySelectorAll("#segVista button")
    .forEach((b) => (b.onclick = () => setVista(b.dataset.vista)));
  document
    .querySelectorAll("#segModo button")
    .forEach((b) => (b.onclick = () => setModo(b.dataset.modo)));
  document.querySelectorAll(".chip").forEach(
    (b) =>
      (b.onclick = () => {
        setCapa(b.dataset.capa, b.getAttribute("aria-pressed") !== "true");
        pintar();
        programarGuardado();
      }),
  );

  const lienzo = $("lienzo");
  lienzo.addEventListener("mousemove", (e) => {
    const k = celdaDe(e);
    $("sonda").textContent =
      k < 0
        ? ""
        : `x = ${(k % N) * M.dx} m, y = ${((k / N) | 0) * M.dx} m: z = ${R.P.F[k].toFixed(2)} m, θ = ${((Math.atan(R.P.S[k]) * 180) / Math.PI).toFixed(1)}°, A(c) = ${R.P.acc[k]}` +
          (R.H.cuenca[k] ? ", dentro de la cuenca" : "");
  });
  lienzo.addEventListener("click", (e) => {
    const k = celdaDe(e);
    if (k < 0) return;
    if (pick) {
      cancelarPick();
      M.salida = k;
      commit(`Salida en (${k % N}, ${(k / N) | 0})`);
      aplicar();
      return;
    }
    sel = k;
    $("campoX").value = k % N;
    $("campoY").value = (k / N) | 0;
    $("campoZ").value = R.Z[k].toFixed(2);
    pintar();
    renderInspector();
  });

  $("btnPick").onclick = () => {
    if (pick) {
      cancelarPick();
      return;
    }
    pick = true;
    if (UI.modo === "3d") setModo("2d");
    $("btnPick").classList.add("activo");
    $("btnPick").textContent = "Cancelar selección";
    $("pista").hidden = false;
  };
  $("btnAuto").onclick = () => {
    cancelarPick();
    if (M.salida === null) {
      toast("Ya estás usando la salida automática.");
      return;
    }
    M.salida = null;
    commit("Salida automática");
    aplicar();
  };

  // 3D: girar arrastrando
  ["campoAz", "campoInc", "campoEx"].forEach(
    (id) =>
      ($(id).oninput = () => {
        UI.az = +$("campoAz").value;
        UI.inc = +$("campoInc").value;
        UI.ex = +$("campoEx").value;
        $("eAz").textContent = UI.az;
        $("eInc").textContent = UI.inc;
        $("eEx").textContent = UI.ex;
        pintar();
        programarGuardado();
      }),
  );
  let arr = null;
  const l3 = $("lienzo3d");
  l3.addEventListener("pointerdown", (e) => {
    arr = e.clientX;
    try {
      l3.setPointerCapture(e.pointerId);
    } catch (x) {
      /* sin captura */
    }
    l3.style.cursor = "grabbing";
  });
  l3.addEventListener("pointerup", () => {
    arr = null;
    l3.style.cursor = "";
  });
  l3.addEventListener("pointermove", (e) => {
    if (arr === null) return;
    $("campoAz").value =
      ((+$("campoAz").value + (e.clientX - arr) * 0.5 + 540) % 360) - 180;
    arr = e.clientX;
    $("campoAz").oninput();
  });

  // Equipo y notas
  $("campoEquipo").oninput = (e) => {
    UI.equipo = e.target.value;
    programarGuardado();
  };
  $("campoIntegrantes").oninput = (e) => {
    UI.integrantes = e.target.value;
    programarGuardado();
  };
  $("campoNotas").oninput = (e) => {
    UI.notas = e.target.value;
    programarGuardado();
  };

  // Versiones, historial, experimento
  $("btnGuardarVersion").onclick = guardarVersion;
  $("campoNombreVersion").addEventListener("keydown", (e) => {
    if (e.key === "Enter") guardarVersion();
  });
  $("listaVersiones").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-acc]");
    if (!b) return;
    const v = versiones.find((x) => String(x.id) === b.dataset.id);
    if (!v) return;
    if (b.dataset.acc === "restaurar") {
      M = copiar(v.M);
      sel = -1;
      volcarInputs();
      commit(`Volví a la versión “${v.nombre}”`);
      aplicar();
      toast(
        `Estás en la versión “${v.nombre}”. Puedes deshacer para regresar.`,
      );
    } else if (b.dataset.acc === "renombrar") {
      const n = prompt("Nuevo nombre de la versión", v.nombre);
      if (n && n.trim()) {
        v.nombre = n.trim();
        renderVersiones();
        programarGuardado();
      }
    } else if (b.dataset.acc === "borrar") {
      if (
        confirm(`¿Eliminar la versión “${v.nombre}”? No se puede deshacer.`)
      ) {
        versiones = versiones.filter((x) => x !== v);
        renderVersiones();
        programarGuardado();
      }
    }
  });
  $("listaHistorial").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (b) irAHistorial(+b.dataset.i);
  });
  $("bParam").onchange = () => {
    $("bValores").value = VALORES_BARRIDO[$("bParam").value];
  };
  $("bEjecutar").onclick = ejecutarBarrido;
  $("bCsv").onclick = () => {
    if (!barrido) return;
    descargar(
      "experimento.csv",
      new Blob(
        [
          Exportar.csv([
            [
              barrido.nombre,
              "Celdas",
              "A [km²]",
              "L [m]",
              "S_med",
              "tc [min]",
              "Q con 60 mm/h [m³/s]",
            ],
            ...barrido.filas,
          ]),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
  };
  $("btnCsvComp").onclick = () => {
    const t = tablaComparacion();
    descargar(
      "comparacion_versiones.csv",
      new Blob(
        [
          Exportar.csv([
            ["Parámetro", ...t.cols.map((c) => c.nombre)],
            ...t.filas,
          ]),
        ],
        {
          type: "text/csv;charset=utf-8",
        },
      ),
    );
  };

  // Exportar y datos
  $("btnZip").onclick = exportarZip;
  $("btnExpZip").onclick = exportarZip;
  $("btnExpReporte").onclick = abrirReporte;
  $("btnExpFiguras").onclick = exportarFiguras;
  $("btnExpPNG2D").onclick = exportarPNG;
  $("btnExpDEM").onclick = () =>
    descargar(
      "raster_z.csv",
      new Blob([Exportar.csvRaster(R.P.F, N, M.dx)], {
        type: "text/csv;charset=utf-8",
      }),
    );
  $("btnExpCSV").onclick = () =>
    descargar(
      "resultados.csv",
      new Blob([csvResultados()], { type: "text/csv;charset=utf-8" }),
    );
  $("btnExpJSON").onclick = () =>
    descargar(
      `${nombreBase()}.json`,
      new Blob([jsonProyecto()], { type: "application/json" }),
    );
  $("btnImportar").onclick = () => $("archivoJSON").click();
  $("archivoJSON").onchange = (e) => {
    if (e.target.files[0]) abrirJSON(e.target.files[0]);
    e.target.value = "";
  };
  $("btnReiniciar").onclick = reiniciarTodo;

  $("btnUndo").onclick = deshacer;
  $("btnRedo").onclick = rehacer;
  $("btnTema").onclick = () => {
    UI.tema = UI.tema === "claro" ? "oscuro" : "claro";
    document.body.dataset.tema = UI.tema;
    renderGraficas();
    programarGuardado();
  };

  // Pestañas y teclado
  $("pestanas").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (b) irTab(b.dataset.tab, false);
  });
  $("pestanas").addEventListener("keydown", (e) => {
    const i = TABS.indexOf(UI.tab);
    const sig = {
      ArrowDown: i + 1,
      ArrowRight: i + 1,
      ArrowUp: i - 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: TABS.length - 1,
    }[e.key];
    if (sig === undefined) return;
    e.preventDefault();
    irTab(TABS[(sig + TABS.length) % TABS.length], true);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pick) {
      cancelarPick();
      return;
    }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const mod = e.ctrlKey || e.metaKey,
      k = e.key.toLowerCase();
    if (mod && k === "z") {
      e.preventDefault();
      e.shiftKey ? rehacer() : deshacer();
    } else if (mod && k === "y") {
      e.preventDefault();
      rehacer();
    }
  });

  // ---------- Arranque ----------
  document.body.dataset.tema = UI.tema;
  volcarInputs();
  volcarEquipo();
  $("campoAz").value = UI.az;
  $("campoInc").value = UI.inc;
  $("campoEx").value = UI.ex;
  $("campoAng").value = UI.ang;
  $("eAz").textContent = UI.az;
  $("eInc").textContent = UI.inc;
  $("eEx").textContent = UI.ex;
  $("eAng").textContent = UI.ang;
  $("bValores").value = VALORES_BARRIDO[$("bParam").value];
  document
    .querySelectorAll(".chip")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(!!UI.capas[b.dataset.capa])),
    );
  R = calcular(M);
  D = { P: R.P, H: R.H, dx: M.dx, seg: Dibujo.contornos(R.P.F, 20) };
  base = Dibujo.crearBase(R.P, UI.vista, CS);
  document
    .querySelectorAll("#segVista button")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.vista === UI.vista)),
    );
  setModo(UI.modo);
  irTab(TABS.includes(UI.tab) ? UI.tab : "terreno", false);
  renderTodo();
  programarGuardado();
})();
