import * as THREE from 'three';

/* =============================
   LOADER
============================= */
window.addEventListener('load', () => {
  setTimeout(() => document.getElementById('loader').classList.add('hidden'), 900);
});

/* =============================
   THREE.JS — PARTICLE NETWORK
   Nodos flotantes conectados por líneas (topología de red)
============================= */
class ParticleNetwork {
  constructor() {
    this.canvas    = document.getElementById('bg-canvas');
    this.mouse     = { x: 0, y: 0, tx: 0, ty: 0 };
    this.COUNT     = 100;
    this.DIST      = 12;
    this.MAX_LINES = 450;

    this._setup();
    this._buildParticles();
    this._buildLineSystem();
    this._bindEvents();
    this._loop();
  }

  _setup() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    this.camera.position.z = 35;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, alpha: true, antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  _buildParticles() {
    const pos = new Float32Array(this.COUNT * 3);
    this.vel  = [];

    for (let i = 0; i < this.COUNT; i++) {
      pos[i*3]   = (Math.random() - .5) * 58;
      pos[i*3+1] = (Math.random() - .5) * 38;
      pos[i*3+2] = (Math.random() - .5) * 12;

      this.vel.push({
        x: (Math.random() - .5) * .022,
        y: (Math.random() - .5) * .022
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x60a5fa, size: .28,
      transparent: true, opacity: .8, sizeAttenuation: true
    });

    this.pts    = new THREE.Points(geo, mat);
    this.posArr = geo.attributes.position;
    this.scene.add(this.pts);
  }

  _buildLineSystem() {
    const lPos = new Float32Array(this.MAX_LINES * 6);
    const lCol = new Float32Array(this.MAX_LINES * 6);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(lPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color',    new THREE.BufferAttribute(lCol, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true,
      opacity: .45, blending: THREE.AdditiveBlending
    });

    this.lines    = new THREE.LineSegments(geo, mat);
    this.lPosAttr = geo.attributes.position;
    this.lColAttr = geo.attributes.color;
    this.scene.add(this.lines);
  }

  _updateLines() {
    const p = this.posArr.array;
    const n = this.COUNT;
    const d = this.DIST;
    // rgb de --primary (#60a5fa)
    const r = .376, g = .647, b = .980;
    let idx = 0;

    for (let i = 0; i < n && idx < this.MAX_LINES; i++) {
      let conn = 0;
      for (let j = i + 1; j < n && idx < this.MAX_LINES && conn < 4; j++) {
        const dx = p[i*3] - p[j*3];
        const dy = p[i*3+1] - p[j*3+1];
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < d) {
          const a = 1 - dist / d;
          this.lPosAttr.array.set([p[i*3], p[i*3+1], p[i*3+2], p[j*3], p[j*3+1], p[j*3+2]], idx * 6);
          this.lColAttr.array.set([r*a, g*a, b*a, r*a, g*a, b*a], idx * 6);
          idx++;
          conn++;
        }
      }
    }

    this.lines.geometry.setDrawRange(0, idx * 2);
    this.lPosAttr.needsUpdate = true;
    this.lColAttr.needsUpdate = true;
  }

  _bindEvents() {
    window.addEventListener('mousemove', e => {
      this.mouse.tx =  (e.clientX / window.innerWidth  - .5);
      this.mouse.ty = -(e.clientY / window.innerHeight - .5);
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  _loop() {
    requestAnimationFrame(this._loop.bind(this));

    const p = this.posArr.array;
    for (let i = 0; i < this.COUNT; i++) {
      p[i*3]   += this.vel[i].x;
      p[i*3+1] += this.vel[i].y;
      if (p[i*3]   >  29) p[i*3]   = -29;
      if (p[i*3]   < -29) p[i*3]   =  29;
      if (p[i*3+1] >  19) p[i*3+1] = -19;
      if (p[i*3+1] < -19) p[i*3+1] =  19;
    }
    this.posArr.needsUpdate = true;

    // Smooth mouse parallax
    this.mouse.x += (this.mouse.tx - this.mouse.x) * .03;
    this.mouse.y += (this.mouse.ty - this.mouse.y) * .03;
    this.scene.rotation.x = this.mouse.y * .14;
    this.scene.rotation.y = this.mouse.x * .14;

    this._updateLines();
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
  });

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

  document.querySelectorAll('.reveal').forEach((el, i) => {
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
  new ParticleNetwork();
  initNavbar();
  initReveal();
});
