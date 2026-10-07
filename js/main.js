import './components/app-icon.js';
import './components/greeting-line.js';
import './components/intent-picker.js';
import './components/count-up.js';
import './components/project-card.js';
import './components/site-preview.js';
import './components/growth-meter.js';
import './components/toast-host.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (selector) => document.querySelector(selector);

/* =============================
   ETAPAS DE LA PLANTA
   Cada sección del sitio corresponde a una etapa del cultivo.
============================= */
const ANCHORS = [
  { id: 'hero', p: 0 },
  { id: 'about', p: 0.16 },
  { id: 'stack', p: 0.34 },
  { id: 'experience', p: 0.5 },
  { id: 'projects', p: 0.64 },
  { id: 'education', p: 0.86 },
];

const STAGES = [
  { until: 0.05, icon: 'seed', name: 'Semilla', hint: 'Una idea esperando agua. Baja para que germine.' },
  { until: 0.3, icon: 'germination', name: 'Germinación', hint: 'Primero la raíz: sin bases firmes no crece nada.' },
  { until: 0.47, icon: 'sprout', name: 'Emergencia', hint: 'Rompe el suelo y abre sus cotiledones.' },
  { until: 0.86, icon: 'leaves', name: 'Crecimiento', hint: 'Hoja por hoja, como cada proyecto. Mueve el cursor: la planta busca la luz.' },
  { until: 0.97, icon: 'bud', name: 'Botón floral', hint: 'Casi listo para florecer.' },
  { until: Infinity, icon: 'flower', name: 'Floración', hint: '¡Llegaste al final! Hablemos y hagamos crecer algo juntos.' },
];

function stageFor(p) {
  return STAGES.find((stage) => p < stage.until);
}

/** Progreso de 0 a 1 según el scroll, alineado con las secciones. */
function scrollProgress() {
  const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const y = window.scrollY;
  const points = ANCHORS.map(({ id, p }) => {
    const el = document.getElementById(id);
    const at = id === 'hero' ? 0 : el ? el.offsetTop - window.innerHeight * 0.45 : 0;
    return { at: Math.min(Math.max(at, 0), maxScroll), p };
  });
  points.push({ at: maxScroll, p: 1 });

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (y <= b.at) {
      const span = Math.max(b.at - a.at, 1);
      return a.p + (b.p - a.p) * Math.min(Math.max((y - a.at) / span, 0), 1);
    }
  }
  return 1;
}

/* =============================
   JARDÍN (WebGL)
============================= */
let garden = null;

function supportsWebGL() {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2'));
  } catch {
    return false;
  }
}

async function initGarden() {
  const canvas = $('#garden');
  if (!supportsWebGL()) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  try {
    const { createGarden } = await import('./garden.js');
    garden = createGarden(canvas, { reducedMotion });
  } catch (error) {
    console.warn('No se pudo iniciar el fondo WebGL:', error);
  }
  if (!garden) {
    document.documentElement.classList.add('no-webgl');
    return;
  }
  canvas.classList.add('is-ready');
  garden.setProgress(scrollProgress());
}

/* =============================
   SCROLL: planta, medidor y navegación
============================= */
function initScroll() {
  const meter = $('#growth');
  const navbar = $('#navbar');
  const links = [...document.querySelectorAll('.nav-link')];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  let ticking = false;

  const update = () => {
    ticking = false;
    const p = scrollProgress();
    garden?.setProgress(p);

    const stage = stageFor(p);
    meter.progress = p;
    meter.stage = stage.name;
    meter.icon = stage.icon;
    meter.hint = stage.hint;
    document.documentElement.style.setProperty('--bloom', String(Math.max(0, (p - 0.86) / 0.14)));

    navbar.classList.toggle('scrolled', window.scrollY > 20);
    const probe = window.scrollY + window.innerHeight * 0.35;
    let current = null;
    sections.forEach((section) => {
      if (probe >= section.offsetTop) current = section.id;
    });
    links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${current}`));
  };

  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

/* =============================
   PUNTERO: luz que sigue al cursor
============================= */
function initPointer() {
  const root = document.documentElement;
  window.addEventListener(
    'pointermove',
    (event) => {
      const x = event.clientX / window.innerWidth;
      const y = event.clientY / window.innerHeight;
      root.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`);
      root.style.setProperty('--my', `${(y * 100).toFixed(2)}%`);
      garden?.setPointer(x * 2 - 1, -(y * 2 - 1));
    },
    { passive: true },
  );
}

/* =============================
   NAVEGACIÓN MÓVIL
============================= */
function initNav() {
  const toggle = $('#nav-toggle');
  const list = $('#nav-links');
  const setOpen = (open) => {
    toggle.classList.toggle('open', open);
    list.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  };
  toggle.addEventListener('click', () => setOpen(!list.classList.contains('open')));
  list.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

/* =============================
   APARICIÓN AL HACER SCROLL
============================= */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }),
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  );
  items.forEach((el) => {
    const group = el.parentElement;
    if (group?.matches('.evidence-grid, .projects-grid, .education-grid, .timeline')) {
      const index = [...group.children].indexOf(el);
      el.style.transitionDelay = `${(index % 4) * 80}ms`;
    }
    io.observe(el);
  });
}

/* =============================
   INTERACCIONES
============================= */
function initInteractions() {
  const toasts = $('#toasts');
  const preview = $('#preview');
  const meter = $('#growth');

  // "¿Qué te trae por aquí?"
  document.addEventListener('intent-select', (event) => {
    const { target, reply, icon } = event.detail;
    toasts.show(reply, { icon });
    setTimeout(() => document.querySelector(target)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }), 350);
  });

  // Vista previa en vivo de los proyectos
  document.addEventListener('preview-open', (event) => preview.open(event.detail));

  // Regar la planta
  let waterings = 0;
  try {
    waterings = Number(localStorage.getItem('jsg:riegos')) || 0;
  } catch {
    /* sin almacenamiento: empezamos de cero */
  }
  meter.waterings = waterings;
  document.addEventListener('water', () => {
    waterings += 1;
    meter.waterings = waterings;
    try {
      localStorage.setItem('jsg:riegos', String(waterings));
    } catch {
      /* no pasa nada */
    }
    garden?.water();
    if (!garden) {
      toasts.show('Tu navegador no puede mostrar la planta, pero igual te agradece el agua.', { icon: 'drop' });
    } else if (waterings === 1) {
      toasts.show('¡Gracias por regarla! Mira cómo se alegra.', { icon: 'drop' });
    } else if (waterings % 5 === 0) {
      toasts.show(`Ya la has regado ${waterings} veces. Con este cuidado, hasta florece antes.`, { icon: 'drop' });
    }
  });

  // Filtros de proyectos
  const filters = [...document.querySelectorAll('.filter')];
  const cards = [...document.querySelectorAll('project-card')];
  filters.forEach((button) =>
    button.addEventListener('click', () => {
      const value = button.dataset.filter;
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      cards.forEach((card) => {
        const categories = (card.dataset.category || '').split(' ');
        card.hidden = value !== 'all' && !categories.includes(value);
      });
    }),
  );

  // Copiar correo
  document.querySelectorAll('[data-copy]').forEach((button) =>
    button.addEventListener('click', async () => {
      const text = button.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        toasts.show(`Copiado: ${text}. ¡Te respondo pronto!`, { icon: 'mail' });
      } catch {
        window.location.href = `mailto:${text}`;
      }
    }),
  );
}

/* =============================
   INICIO
============================= */
initNav();
initReveal();
initScroll();
initPointer();
initInteractions();
initGarden();
