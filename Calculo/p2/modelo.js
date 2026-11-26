// =====================================================================
//  modelo.js  —  Lógica del proyecto (sin nada de pantalla)
//  Pasos 1-9 de la guía: DEM, relleno, gradiente, D8, acumulación,
//  salida, cuenca, cauces, tiempo de concentración y gasto.
// =====================================================================
(function (root) {
  "use strict";

  const N = 100; // puntos por lado
  // 8 vecinos: (di, dj) con i = fila (y), j = columna (x)
  const NB = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  // ---------- Paso 2: terreno z = f(x, y) ----------
  function ejemplo() {
    return {
      B: 15,
      z0: 100,
      s: 0.15,
      H: 50,
      W: 350,
      xc: 495,
      M: 0,
      pm: 100,
      ph: 0,
      a: 70,
      b: 90,
      pa: 0,
      pb: 0,
      h: [
        [300, 650, 90, 25],
        [700, 500, 100, 25],
      ],
    };
  }

  function elevacion(T, x, y) {
    const u = (Math.PI * (x - T.xc - T.M * Math.sin(y / T.pm + T.ph))) / T.W;
    let z =
      T.z0 +
      T.s * y +
      T.H * (1 - Math.cos(u)) +
      T.B * Math.sin(x / T.a + T.pa) * Math.sin(y / T.b + T.pb);
    for (const [a, b, s, A] of T.h)
      z += A * Math.exp(-((x - a) ** 2 + (y - b) ** 2) / (2 * s * s));
    return z;
  }

  // Derivadas parciales calculadas a mano (para compararlas con diferencias finitas)
  function gradAnalitico(T, x, y) {
    const u = (Math.PI * (x - T.xc - T.M * Math.sin(y / T.pm + T.ph))) / T.W;
    const kv = T.H * Math.sin(u);
    let fx =
      (kv * Math.PI) / T.W +
      (T.B / T.a) * Math.cos(x / T.a + T.pa) * Math.sin(y / T.b + T.pb);
    let fy =
      T.s -
      (kv * Math.PI * T.M * Math.cos(y / T.pm + T.ph)) / (T.pm * T.W) +
      (T.B / T.b) * Math.sin(x / T.a + T.pa) * Math.cos(y / T.b + T.pb);
    for (const [a, b, s, A] of T.h) {
      const g = A * Math.exp(-((x - a) ** 2 + (y - b) ** 2) / (2 * s * s));
      fx -= (g * (x - a)) / (s * s);
      fy -= (g * (y - b)) / (s * s);
    }
    return [fx, fy];
  }

  // Paso 1 + 2: llena la matriz Z[i*N+j] = f(j*dx, i*dx) y mide el error de fx, fy
  function crearDEM(T, dx) {
    const Z = new Float64Array(N * N);
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) Z[i * N + j] = elevacion(T, j * dx, i * dx);
    let err = 0;
    for (let i = 1; i < N - 1; i++) {
      for (let j = 1; j < N - 1; j++) {
        const k = i * N + j,
          [ax, ay] = gradAnalitico(T, j * dx, i * dx);
        err = Math.max(
          err,
          Math.abs((Z[k + 1] - Z[k - 1]) / (2 * dx) - ax),
          Math.abs((Z[k + N] - Z[k - N]) / (2 * dx) - ay),
        );
      }
    }
    return { Z, err };
  }

  // ---------- Paso 3: priority-flood ----------
  class Heap {
    // cola de prioridad (mínimo primero)
    constructor() {
      this.a = [];
    }
    get length() {
      return this.a.length;
    }
    push(v) {
      const a = this.a;
      let k = a.length;
      a.push(v);
      while (k) {
        const p = (k - 1) >> 1;
        if (a[p][0] <= v[0]) break;
        a[k] = a[p];
        k = p;
      }
      a[k] = v;
    }
    pop() {
      const a = this.a,
        t = a[0],
        v = a.pop();
      if (a.length) {
        let k = 0;
        const n = a.length;
        for (;;) {
          let c = 2 * k + 1;
          if (c >= n) break;
          if (c + 1 < n && a[c + 1][0] < a[c][0]) c++;
          if (a[c][0] >= v[0]) break;
          a[k] = a[c];
          k = c;
        }
        a[k] = v;
      }
      return t;
    }
  }

  function rellenar(Z) {
    const F = new Float64Array(N * N).fill(Infinity),
      visto = new Uint8Array(N * N),
      h = new Heap();
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        if (i === 0 || j === 0 || i === N - 1 || j === N - 1) {
          const k = i * N + j;
          F[k] = Z[k];
          visto[k] = 1;
          h.push([Z[k], k]);
        }
    while (h.length) {
      const [z, k] = h.pop(),
        i = (k / N) | 0,
        j = k % N;
      for (const [di, dj] of NB) {
        const a = i + di,
          b = j + dj;
        if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const q = a * N + b;
        if (visto[q]) continue;
        visto[q] = 1;
        F[q] = Math.max(Z[q], z + 1e-3);
        h.push([F[q], q]);
      }
    }
    return F;
  }

  // ---------- Pasos 3-6 juntos: relleno, gradiente, D8 y acumulación ----------
  function procesar(Z, dx) {
    const F = rellenar(Z);
    let nf = 0;
    for (let k = 0; k < N * N; k++) if (F[k] - Z[k] > 1e-2) nf++;

    // Paso 4: diferencias centrales (unilaterales en el borde)
    const Zx = new Float64Array(N * N),
      Zy = new Float64Array(N * N),
      S = new Float64Array(N * N);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const k = i * N + j,
          j0 = Math.max(j - 1, 0),
          j1 = Math.min(j + 1, N - 1),
          i0 = Math.max(i - 1, 0),
          i1 = Math.min(i + 1, N - 1);
        Zx[k] = (F[i * N + j1] - F[i * N + j0]) / ((j1 - j0) * dx);
        Zy[k] = (F[i1 * N + j] - F[i0 * N + j]) / ((i1 - i0) * dx);
        S[k] = Math.hypot(Zx[k], Zy[k]);
      }
    }

    // Paso 5: D8 — cada celda manda su agua al vecino de mayor pendiente de descenso
    const rc = new Int32Array(N * N).fill(-1),
      dir = new Int8Array(N * N).fill(-1);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const k = i * N + j;
        let mejor = 0;
        NB.forEach(([di, dj], n) => {
          const a = i + di,
            b = j + dj;
          if (a < 0 || b < 0 || a >= N || b >= N) return;
          const s = (F[k] - F[a * N + b]) / (dx * Math.hypot(di, dj));
          if (s > mejor) {
            mejor = s;
            rc[k] = a * N + b;
            dir[k] = n;
          }
        });
      }
    }

    // Paso 6: acumulación, de la celda más alta a la más baja
    const acc = new Float64Array(N * N).fill(1);
    const ord = Array.from({ length: N * N }, (_, k) => k).sort(
      (p, q) => F[q] - F[p],
    );
    for (const k of ord) if (rc[k] >= 0) acc[rc[k]] += acc[k];

    return { F, nf, Zx, Zy, S, rc, dir, acc, ord };
  }

  // ---------- Paso 7: salida y cuenca ----------
  function salidaAutomatica(acc) {
    let mejor = -1,
      k0 = 0;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        if (i === 0 || j === 0 || i === N - 1 || j === N - 1) {
          const k = i * N + j;
          if (acc[k] > mejor) {
            mejor = acc[k];
            k0 = k;
          }
        }
    return k0;
  }

  // ---------- Pasos 7, 8 y 9: hidrología de la cuenca ----------
  function hidrologia(P, dx, salida, U) {
    const { F, Zx, Zy, S, rc, acc, ord } = P;

    // La cuenca: celdas cuya ruta de flujo termina en la salida
    const cuenca = new Uint8Array(N * N);
    for (let t = ord.length - 1; t >= 0; t--) {
      // de la más baja a la más alta
      const k = ord[t];
      if (k === salida) cuenca[k] = 1;
      else if (rc[k] >= 0 && cuenca[rc[k]]) cuenca[k] = 1;
    }

    // Área planimétrica (n celdas · Δ²), área superficial y promedios en la cuenca
    let nW = 0,
      sumSup = 0,
      sumS = 0;
    for (let k = 0; k < N * N; k++) {
      if (!cuenca[k]) continue;
      nW++;
      sumSup += Math.sqrt(1 + Zx[k] ** 2 + Zy[k] ** 2);
      sumS += S[k];
    }
    const A_m2 = nW * dx * dx,
      A_sup = sumSup * dx * dx,
      A_km2 = A_m2 / 1e6;
    const S_grad_prom = nW ? sumS / nW : 0;

    // Parteaguas = celdas de la cuenca que tocan algo fuera de la cuenca (o el borde del mapa)
    const borde = new Uint8Array(N * N);
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const k = i * N + j;
        if (!cuenca[k]) continue;
        if (
          j === 0 ||
          !cuenca[k - 1] ||
          j === N - 1 ||
          !cuenca[k + 1] ||
          i === 0 ||
          !cuenca[k - N] ||
          i === N - 1 ||
          !cuenca[k + N]
        )
          borde[k] = 1;
      }

    // Red de cauces: acumulación >= U
    const cauces = new Uint8Array(N * N);
    for (let k = 0; k < N * N; k++) if (cuenca[k] && acc[k] >= U) cauces[k] = 1;

    // Cauce principal: desde la salida hacia arriba por el donante con más acumulación
    const ruta = [salida];
    for (;;) {
      const cur = ruta[ruta.length - 1],
        i = (cur / N) | 0,
        j = cur % N;
      let mejor = -1,
        ma = -1;
      for (const [di, dj] of NB) {
        const a = i + di,
          b = j + dj;
        if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const q = a * N + b;
        if (rc[q] === cur && cuenca[q] && acc[q] > ma) {
          ma = acc[q];
          mejor = q;
        }
      }
      if (mejor < 0 || ma < 20) break; // el cauce termina donde acc < 20
      ruta.push(mejor);
    }
    ruta.reverse(); // cabecera -> salida

    const m = ruta.length - 1;
    const zc = ruta.map((k) => F[k]);
    const dl = [];
    for (let t = 0; t < m; t++) {
      const k0 = ruta[t],
        k1 = ruta[t + 1];
      dl.push(
        dx * Math.hypot(((k1 / N) | 0) - ((k0 / N) | 0), (k1 % N) - (k0 % N)),
      );
    }
    const L = dl.reduce((s, v) => s + v, 0);
    let L3D = 0,
      S_prom_tramos = NaN,
      S_max = NaN,
      S_min = NaN,
      S_med = NaN,
      desnivel = NaN,
      tc = NaN;
    if (m >= 1) {
      const sk = dl.map((l, t) => (zc[t] - zc[t + 1]) / l);
      L3D = dl.reduce((s, l, t) => s + Math.hypot(l, zc[t] - zc[t + 1]), 0);
      desnivel = zc[0] - zc[m];
      S_med = desnivel / L;
      S_max = Math.max(...sk);
      S_min = Math.min(...sk);
      S_prom_tramos = sk.reduce((s, v) => s + v, 0) / sk.length;
      // Paso 9: Kirpich (L en m, S en m/m, resultado en minutos)
      if (S_med > 0) tc = 0.0195 * Math.pow(L, 0.77) * Math.pow(S_med, -0.385);
    }

    return {
      cuenca,
      borde,
      cauces,
      ruta,
      zc,
      dl,
      salida,
      nW,
      A_m2,
      A_km2,
      A_sup,
      S_grad_prom,
      L,
      L3D,
      desnivel,
      S_med,
      S_max,
      S_min,
      S_prom_tramos,
      tc,
    };
  }

  // Método racional: Q = C i A / 3.6  (i en mm/h, A en km²)  y volumen V = C P A
  function gastos(H, C, intensidades) {
    return intensidades.map((i) => {
      const Q = (C * i * H.A_km2) / 3.6;
      const P = isNaN(H.tc) ? NaN : (i * H.tc) / 60; // lámina en mm (duración = tc)
      const V = isNaN(P) ? NaN : C * (P / 1000) * H.A_m2; // m³
      return { i, Q, P, V };
    });
  }

  const Modelo = {
    N,
    NB,
    ejemplo,
    elevacion,
    gradAnalitico,
    crearDEM,
    rellenar,
    procesar,
    salidaAutomatica,
    hidrologia,
    gastos,
  };
  root.Modelo = Modelo;
  if (typeof module !== "undefined" && module.exports) module.exports = Modelo;
})(typeof window !== "undefined" ? window : globalThis);
