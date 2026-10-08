/*
 * Tarjetas que flotan en 3D y, si las mantienes presionadas, se deshacen
 * como arena y vuelven a armarse.
 *
 * - Flotar: un vaivén suave (CSS) mientras están en pantalla, y al pasar el
 *   cursor se inclinan siguiéndolo.
 * - Arena: un filtro SVG borra la tarjeta grano a grano (ruido + umbral) y la
 *   dispersa con el viento, mientras un canvas dibuja los granos que se van.
 *   Al soltar, los granos regresan y la tarjeta se arma de nuevo.
 */
const SELECTOR = 'project-card, .evidence, .edu-card, .timeline-card';
const INTERACTIVOS = 'a, button, input, select, textarea, summary, [role="button"]';
const ESPERA_TEMBLOR = 280; // ms presionando antes de temblar
const ESPERA_ARENA = 650; // ms presionando antes de deshacerse
const DURACION_ARENA = 1500; // ms en deshacerse por completo
const DURACION_VUELTA = 900; // ms en volver a armarse
const PAUSA_VACIA = 450; // ms que se queda deshecha después de soltar
const COLORES = ['#eef6f2', '#cfe3db', '#a5b9b1', '#71877f', '#6ee7a8', '#2dd4bf', '#2b5f4a'];

let umbral;
let viento;
let lienzo;
let ctx;
let granos = [];
let activo = null;
let raf = 0;
let ultimo = 0;

/* ---------------------------- flotar e inclinar ---------------------------- */
function inclinable(el) {
  const s = { rx: 0, ry: 0, alza: 0, trx: 0, try: 0, talza: 0, corriendo: false };

  const animar = () => {
    if (s.corriendo) return;
    s.corriendo = true;
    const paso = () => {
      s.rx += (s.trx - s.rx) * 0.16;
      s.ry += (s.try - s.ry) * 0.16;
      s.alza += (s.talza - s.alza) * 0.16;
      const quieto =
        Math.abs(s.trx - s.rx) < 0.02 && Math.abs(s.try - s.ry) < 0.02 && Math.abs(s.talza - s.alza) < 0.05;
      if (quieto && !s.trx && !s.try && !s.talza) {
        el.style.transform = '';
        s.corriendo = false;
        return;
      }
      el.style.transform = `perspective(1000px) rotateX(${s.rx.toFixed(2)}deg) rotateY(${s.ry.toFixed(2)}deg) translateY(${s.alza.toFixed(2)}px)`;
      if (quieto) {
        s.corriendo = false;
        return;
      }
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };

  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || activo?.el === el) return;
    const r = el.getBoundingClientRect();
    const maximo = Math.min(8, 2600 / r.width); // las tarjetas anchas se inclinan menos
    s.trx = (0.5 - (e.clientY - r.top) / r.height) * maximo;
    s.try = ((e.clientX - r.left) / r.width - 0.5) * maximo;
    s.talza = -6;
    animar();
  });
  el.addEventListener('pointerleave', () => {
    s.trx = 0;
    s.try = 0;
    s.talza = 0;
    animar();
  });
}

/* --------------------------------- arena ---------------------------------- */
function crearFiltro() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<svg class="filtro-arena" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="arena" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.24" numOctaves="2" seed="8" result="grano"/>
        <feColorMatrix in="grano" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="granoA"/>
        <feComponentTransfer in="granoA" result="mascara">
          <feFuncA type="linear" slope="12" intercept="0"/>
        </feComponentTransfer>
        <feComposite in="SourceGraphic" in2="mascara" operator="in" result="erosion"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" result="viento"/>
        <feDisplacementMap in="erosion" in2="viento" scale="0" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </svg>`,
  );
  const filtro = document.getElementById('arena');
  umbral = filtro.querySelector('feFuncA');
  viento = filtro.querySelector('feDisplacementMap');
}

function asegurarLienzo() {
  if (lienzo) return;
  lienzo = document.createElement('canvas');
  lienzo.className = 'lienzo-arena';
  lienzo.setAttribute('aria-hidden', 'true');
  document.body.appendChild(lienzo);
  ctx = lienzo.getContext('2d');
  const ajustar = () => {
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    lienzo.width = Math.round(innerWidth * pr);
    lienzo.height = Math.round(innerHeight * pr);
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
  };
  ajustar();
  window.addEventListener('resize', ajustar);
}

function aplicarArena(el, p) {
  // El ruido deja de verse grano a grano; el viento dispersa lo que queda.
  // El barrido (máscara CSS) marca la dirección; el ruido se come granos sueltos
  // cada vez más rápido, y el viento dispersa lo que queda.
  umbral.setAttribute('intercept', String(-12 * p * p * 0.7));
  viento.setAttribute('scale', String(p * p * 34));
  el.style.setProperty('--arena', p.toFixed(3));
}

function soltarGranos(rect, p, avance, regresan) {
  if (avance <= 0) return;
  const borde = Math.min(Math.max(p * 1.4 - 0.2, 0), 1);
  const cantidad = Math.min(120, Math.round((avance * rect.width * rect.height) / 380));
  for (let i = 0; i < cantidad; i++) {
    const fx = Math.min(1, Math.max(0, borde + (Math.random() - 0.7) * 0.22));
    const x = rect.left + rect.width * fx;
    const y = rect.top + Math.random() * rect.height;
    const vida = 1.1 + Math.random() * 1.2;
    const vx = 30 + Math.random() * 110;
    const vy = -(8 + Math.random() * 55);
    const grano = {
      x,
      y,
      vx,
      vy,
      vida,
      edad: 0,
      lado: 1 + Math.random() * 1.8,
      color: COLORES[(Math.random() * COLORES.length) | 0],
      fase: Math.random() * 6.28,
      regresan,
    };
    if (regresan) {
      // Empiezan lejos y llegan a la tarjeta justo al terminar su vida.
      grano.x = x + vx * vida;
      grano.y = y + vy * vida;
      grano.vx = -vx;
      grano.vy = -vy;
    }
    granos.push(grano);
  }
}

function dibujarGranos(dt) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  granos = granos.filter((g) => (g.edad += dt) < g.vida);
  for (const g of granos) {
    g.x += g.vx * dt;
    g.y += g.vy * dt + Math.sin(g.edad * 7 + g.fase) * 0.3;
    const t = g.edad / g.vida;
    ctx.globalAlpha = g.regresan ? Math.min(1, t * 1.6) * (1 - t * 0.2) : (1 - t) * 0.95;
    ctx.fillStyle = g.color;
    ctx.fillRect(g.x, g.y, g.lado, g.lado);
  }
  ctx.globalAlpha = 1;
}

function terminar() {
  const a = activo;
  if (!a) return;
  a.el.classList.remove('temblando', 'arena', 'sosteniendo');
  a.el.style.removeProperty('--arena');
  aplicarArena(a.el, 0);
  activo = null;
}

function paso(ahora) {
  const dt = Math.min((ahora - ultimo) / 1000, 0.05);
  ultimo = ahora;
  const a = activo;
  if (a) {
    const t = ahora - a.inicio;
    if (a.estado === 'esperando' && t > ESPERA_TEMBLOR) {
      a.estado = 'temblando';
      a.el.classList.add('temblando');
    }
    if (a.estado === 'temblando' && t > ESPERA_ARENA) {
      a.estado = 'deshaciendo';
      a.el.classList.remove('temblando');
      a.el.classList.add('arena');
      a.el.style.transform = '';
      navigator.vibrate?.(15);
    }
    if (a.estado === 'deshaciendo' || a.estado === 'volviendo') {
      const rect = a.el.getBoundingClientRect();
      const antes = a.p;
      if (a.estado === 'deshaciendo') {
        a.p = Math.min(1, a.p + (dt * 1000) / DURACION_ARENA);
        soltarGranos(rect, a.p, a.p - antes, false);
        if (a.p >= 1) {
          a.estado = 'vacio';
          a.vacioDesde = ahora;
        } else if (a.soltado) {
          a.estado = 'volviendo';
        }
      } else {
        a.p = Math.max(0, a.p - (dt * 1000) / DURACION_VUELTA);
        soltarGranos(rect, a.p, antes - a.p, true);
      }
      aplicarArena(a.el, a.p);
      if (a.estado === 'volviendo' && a.p <= 0) terminar();
    }
    // Deshecha: vuelve poco después de soltar (o sola, si la sigues presionando).
    if (a.estado === 'vacio' && ((a.soltado && ahora - a.vacioDesde > PAUSA_VACIA) || ahora - a.vacioDesde > 2500)) {
      a.estado = 'volviendo';
    }
  }
  dibujarGranos(dt);
  raf = activo || granos.length ? requestAnimationFrame(paso) : 0;
}

function arrancar() {
  if (raf) return;
  ultimo = performance.now();
  raf = requestAnimationFrame(paso);
}

function presionar(e) {
  if (e.button !== 0 || activo) return;
  const tarjeta = e.target.closest?.(SELECTOR);
  if (!tarjeta) return;
  // Los botones y enlaces de la tarjeta funcionan normal.
  if (e.composedPath().some((n) => n instanceof Element && n.matches(INTERACTIVOS))) return;
  asegurarLienzo();
  activo = { el: tarjeta, x: e.clientX, y: e.clientY, inicio: performance.now(), estado: 'esperando', p: 0, soltado: false };
  tarjeta.classList.add('sosteniendo');
  arrancar();
}

function soltar() {
  const a = activo;
  if (!a) return;
  a.soltado = true;
  if (a.estado === 'esperando' || a.estado === 'temblando') terminar();
}

/* --------------------------------- inicio --------------------------------- */
export function initTarjetas({ reducedMotion = false } = {}) {
  const tarjetas = [...document.querySelectorAll(SELECTOR)];
  if (reducedMotion) return;

  const enPantalla = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => e.target.classList.toggle('flotando', e.isIntersecting)),
    { rootMargin: '80px' },
  );
  tarjetas.forEach((el, i) => {
    el.classList.add('tarjeta-3d');
    el.style.setProperty('--retraso', `${((i * 0.7) % 3.5).toFixed(2)}s`);
    enPantalla.observe(el);
    inclinable(el);
  });

  crearFiltro();
  document.addEventListener('pointerdown', presionar);
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);
  document.addEventListener('pointermove', (e) => {
    // Si se mueve antes de empezar, era un scroll o un arrastre: no es la arena.
    if (activo && (activo.estado === 'esperando' || activo.estado === 'temblando')) {
      if (Math.hypot(e.clientX - activo.x, e.clientY - activo.y) > 10) terminar();
    }
  });
  document.addEventListener('contextmenu', (e) => {
    if (activo) e.preventDefault(); // en celular, mantener presionado abre el menú
  });
}
