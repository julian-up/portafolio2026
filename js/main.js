import * as THREE from 'three';

/* =============================
   LOADER
============================= */
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('hidden'), 900);
});

/* ==========================================================
   THREE.JS — VALLE NOCTURNO
   Colinas low-poly con niebla, luciérnagas, estrellas y luna.
   La cámara vuela a través del valle a medida que haces scroll.
========================================================== */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE  = window.matchMedia('(max-width: 768px)').matches;

/* ---------- Ruido (value noise + fbm determinista) ---------- */
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi,        zf = z - zi;
  const a = hash(xi, zi),     b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  let total = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    total += noise(x * freq, z * freq) * amp;
    norm  += amp;
    amp   *= .5;
    freq  *= 2.1;
  }
  return total / norm; // 0..1
}

/* Altura del terreno: valle central + montañas al fondo */
function terrainHeight(x, z) {
  const n = fbm(x * .035 + 10, z * .035 + 10) - .45;
  // corredor: el centro (x≈0) queda bajo para que la cámara pase
  const t = Math.min(1, Math.max(0, (Math.abs(x) - 7) / 34));
  const valley = .16 + .84 * smooth(t);
  // las montañas crecen hacia el fondo del recorrido
  const far = Math.max(0, -z - 55) * .075;
  return n * (7 + far * 2.2) * valley + far * .55;
}

/* ---------- Texturas generadas (glow suave) ---------- */
function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class NightValley {
  constructor() {
    this.canvas = document.getElementById('bg-canvas');
    this.mouse  = { x: 0, y: 0, tx: 0, ty: 0 };
    this.scroll = { p: 0, target: 0 };
    this.clock  = new THREE.Clock();

    this._setup();
    this._buildSky();
    this._buildTerrain();
    this._buildFireflies();
    this._bindEvents();

    if (REDUCED) {
      this._updateCamera(.12, 0);
      this.renderer.render(this.scene, this.camera);
    } else {
      this._loop();
    }
  }

  _setup() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x04100a, MOBILE ? .014 : .0115);

    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, .1, 600
    );

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setClearColor(0x04100a, 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Luz de luna
    this.scene.add(new THREE.HemisphereLight(0x9dc4a8, 0x03150b, .8));
    const moonLight = new THREE.DirectionalLight(0xcfe8d8, .75);
    moonLight.position.set(-55, 80, -40);
    this.scene.add(moonLight);
    this.scene.add(new THREE.AmbientLight(0x16301f, .7));
  }

  /* ---------- Cielo: estrellas + luna ---------- */
  _buildSky() {
    const starTex = glowTexture('rgba(255,255,255,1)', 'rgba(220,255,235,.4)');

    this.starLayers = [];
    [[MOBILE ? 140 : 260, 1.6, .85], [MOBILE ? 90 : 160, 2.6, .5]].forEach(([count, size, op], li) => {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3]     = (Math.random() - .5) * 520;
        pos[i * 3 + 1] = 30 + Math.random() * 200;
        pos[i * 3 + 2] = -260 + Math.random() * 420;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        map: starTex, color: 0xeafff2, size, opacity: op,
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, mat);
      pts.userData = { baseOp: op, phase: li * 2.1 };
      this.scene.add(pts);
      this.starLayers.push(pts);
    });

    // Luna: núcleo + halo
    const moonTex = glowTexture('rgba(250,255,248,1)', 'rgba(214,240,220,.55)');
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex, transparent: true, opacity: .95,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    moon.scale.setScalar(26);
    moon.position.set(-95, 105, -230);
    this.scene.add(moon);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex, transparent: true, opacity: .22,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.setScalar(70);
    halo.position.copy(moon.position);
    this.scene.add(halo);
  }

  /* ---------- Terreno low-poly ---------- */
  _buildTerrain() {
    const segX = MOBILE ? 70 : 110;
    const segZ = MOBILE ? 60 : 96;
    const geo  = new THREE.PlaneGeometry(300, 280, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    this.baseY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 40; // desplaza el plano hacia el fondo
      pos.setZ(i, z);
      const y = terrainHeight(x, z);
      pos.setY(i, y);
      this.baseY[i] = y;
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({
      color: 0x123924, flatShading: true,
    });
    this.terrain = new THREE.Mesh(geo, mat);
    this.scene.add(this.terrain);

    // malla sutil encima (brillo bio-luminiscente)
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x4ade80, wireframe: true, transparent: true, opacity: .05,
    }));
    wire.position.y = .06;
    this.scene.add(wire);

    this.tPos = pos;
  }

  /* ---------- Luciérnagas ---------- */
  _buildFireflies() {
    const makeSwarm = (count, colorInner, colorOuter, tint, size) => {
      const tex = glowTexture(colorInner, colorOuter);
      const pos = new Float32Array(count * 3);
      const data = [];
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - .5) * 44;
        const z = 90 - Math.random() * 260;
        const y = terrainHeight(x, z) + 1.2 + Math.random() * 6.5;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        data.push({
          x, y, z,
          r : .8 + Math.random() * 2.4,       // radio de deambulación
          s : .25 + Math.random() * .55,      // velocidad
          p : Math.random() * Math.PI * 2,    // fase
          p2: Math.random() * Math.PI * 2,
        });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        map: tex, color: tint, size,
        transparent: true, opacity: .85, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true,
      });
      const pts = new THREE.Points(geo, mat);
      pts.userData = { data, baseOp: .85 };
      this.scene.add(pts);
      return pts;
    };

    this.swarms = [
      makeSwarm(MOBILE ? 55 : 95, 'rgba(255,236,170,1)', 'rgba(252,211,77,.5)', 0xffd882, 1.3),
      makeSwarm(MOBILE ? 35 : 60, 'rgba(220,255,235,1)', 'rgba(134,239,172,.5)', 0xa7f3d0, .95),
    ];
  }

  /* ---------- Eventos ---------- */
  _bindEvents() {
    window.addEventListener('mousemove', e => {
      this.mouse.tx =  (e.clientX / window.innerWidth  - .5);
      this.mouse.ty = -(e.clientY / window.innerHeight - .5);
    }, { passive: true });

    window.addEventListener('scroll', () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      this.scroll.target = max > 0 ? window.scrollY / max : 0;
    }, { passive: true });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (REDUCED) this.renderer.render(this.scene, this.camera);
    });
  }

  /* ---------- Cámara: vuelo por el valle ---------- */
  _updateCamera(p, t) {
    const z = 58 - 150 * p;                    // avanza hacia las montañas
    const x = Math.sin(p * Math.PI * 1.6) * 7; // curva suave en S
    const y = 11.5 + Math.sin(p * Math.PI * 2) * 2.2 + Math.sin(t * .4) * .35;

    this.camera.position.set(
      x + this.mouse.x * 3.2,
      y + this.mouse.y * 1.9,
      z
    );
    this.camera.lookAt(x * .25, 4.2 + p * 6, z - 48);
  }

  /* ---------- Loop ---------- */
  _loop() {
    requestAnimationFrame(this._loop.bind(this));
    const t = this.clock.getElapsedTime();

    // scroll con inercia + parallax de mouse suavizado
    this.scroll.p += (this.scroll.target - this.scroll.p) * .055;
    this.mouse.x  += (this.mouse.tx - this.mouse.x) * .04;
    this.mouse.y  += (this.mouse.ty - this.mouse.y) * .04;

    this._updateCamera(this.scroll.p, t);

    // luciérnagas: deambulan y parpadean
    this.swarms.forEach((swarm, si) => {
      const arr = swarm.geometry.attributes.position.array;
      const data = swarm.userData.data;
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        arr[i * 3]     = d.x + Math.sin(t * d.s + d.p)  * d.r;
        arr[i * 3 + 1] = d.y + Math.sin(t * d.s * .8 + d.p2) * d.r * .45;
        arr[i * 3 + 2] = d.z + Math.cos(t * d.s * .6 + d.p)  * d.r;
      }
      swarm.geometry.attributes.position.needsUpdate = true;
      swarm.material.opacity =
        swarm.userData.baseOp * (.62 + .38 * Math.sin(t * 1.25 + si * 2.4));
    });

    // estrellas titilan
    this.starLayers.forEach(l => {
      l.material.opacity = l.userData.baseOp * (.72 + .28 * Math.sin(t * .7 + l.userData.phase));
    });

    // brisa: ondulación muy sutil y coherente del terreno (cada 2 frames)
    if ((this._f = (this._f || 0) + 1) % 2 === 0) {
      const pos = this.tPos;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, this.baseY[i] + Math.sin(t * .7 + x * .18 + z * .12) * .22);
      }
      pos.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

/* =============================
   NAVBAR
============================= */
function initNavbar() {
  const navbar   = document.getElementById('navbar');
  const toggle   = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  const links    = navLinks.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
    updateActive();
  }, { passive: true });

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  links.forEach(l => l.addEventListener('click', () => {
    toggle.classList.remove('open');
    navLinks.classList.remove('open');
  }));
}

function updateActive() {
  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.nav-link');
  const scrollY  = window.scrollY + 80;

  sections.forEach(sec => {
    if (scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight) {
      links.forEach(l => l.classList.remove('active'));
      const a = document.querySelector(`.nav-link[href="#${sec.id}"]`);
      if (a) a.classList.add('active');
    }
  });
}

/* =============================
   BARRA DE PROGRESO DE SCROLL
============================= */
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* =============================
   REVEAL ON SCROLL
============================= */
function initReveal() {
  const io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach(el => {
    // Stagger dentro de grids
    const parent = el.parentElement;
    if (parent && (
      parent.classList.contains('skills-grid')    ||
      parent.classList.contains('projects-grid')  ||
      parent.classList.contains('education-grid') ||
      parent.classList.contains('contact-grid')   ||
      parent.classList.contains('about-facts')
    )) {
      const siblings = Array.from(parent.querySelectorAll('.reveal'));
      el.style.transitionDelay = `${siblings.indexOf(el) * 75}ms`;
    }
    io.observe(el);
  });
}

/* =============================
   INIT
============================= */
document.addEventListener('DOMContentLoaded', () => {
  new NightValley();
  initNavbar();
  initScrollProgress();
  initReveal();
});
