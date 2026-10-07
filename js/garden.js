/*
 * La planta del fondo.
 *
 * Una semilla de germinación epigea (como el fríjol) que crece con el scroll:
 *   semilla → sale la radícula → el hipocótilo empuja el suelo en forma de
 *   gancho → el gancho se endereza y suelta la testa → abren los cotiledones →
 *   hojas verdaderas en filotaxis áurea (137,5°) → botón → flor.
 *
 * Todo es geometría procedural deformada en los shaders: el tallo, las hojas
 * y la flor comparten la misma función `shoot()`, así el gancho, el vaivén y
 * la inclinación hacia la luz (el cursor) los mueven juntos sin costuras.
 */
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Mesh,
  Points,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  ShaderMaterial,
  SphereGeometry,
  PlaneGeometry,
  CatmullRomCurve3,
  Vector3,
  Color,
  AdditiveBlending,
  DoubleSide,
} from './vendor/three-0.180.0.min.js';

/* ------------------------------------------------------------------ */
/* Constantes de la planta (unidades de mundo; el suelo está en y = 0) */
/* ------------------------------------------------------------------ */
const BASE_Y = -0.8; // cuello de la raíz: donde estaba la semilla
const HOOK_LEN = 0.9; // largo del gancho del hipocótilo
const STEM_MAX = 8.6; // largo final del tallo
const COT_NODE = 2.45; // altura (sobre la base) donde quedan los cotiledones
const LEAF_OPEN_LEN = 0.9; // cuánto debe crecer el tallo para abrir una hoja
const GOLDEN_ANGLE = 2.39996;

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);

/** Estado de la planta para un progreso p ∈ [0, 1]. */
function plantState(p) {
  return {
    stem:
      1.65 * smooth(seg(p, 0.1, 0.3)) +
      0.8 * smooth(seg(p, 0.3, 0.4)) +
      (STEM_MAX - 2.45) * smooth(seg(p, 0.46, 0.88)),
    roots: 0.6 * smooth(seg(p, 0.03, 0.3)) + 0.4 * smooth(seg(p, 0.3, 0.92)),
    hook: 1 - smooth(seg(p, 0.31, 0.4)),
    crack: smooth(seg(p, 0.05, 0.12)),
    shed: smooth(seg(p, 0.37, 0.47)),
    cotOpen: smooth(seg(p, 0.39, 0.49)),
    bud: smooth(seg(p, 0.84, 0.9)),
    bloom: smooth(seg(p, 0.9, 0.985)),
    thick: 0.045 + 0.075 * smooth(seg(p, 0.3, 0.95)),
    seedGlow: 1 - smooth(seg(p, 0.0, 0.3)),
  };
}

/** Generador pseudoaleatorio con semilla: la planta sale igual en cada visita. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* GLSL compartido                                                     */
/* ------------------------------------------------------------------ */
const SHOOT_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uB;
  uniform float uS;
  uniform float uHook;
  uniform float uHookL;
  uniform float uLean;
  uniform float uSway;
  uniform float uTopH;
  uniform float uJoy;
  uniform float uThick;
  uniform float uHeadTilt;

  float stemCurveX(float h) { return 0.16 * sin(h * 0.5) + 0.06 * sin(h * 1.31 + 1.0); }
  float stemCurveZ(float h) { return 0.1 * sin(h * 0.42 + 2.0); }
  vec3 stemAxis(float h) { return vec3(stemCurveX(h), uB + h, stemCurveZ(h)); }

  // Rotación horaria en el plano XY (la que dobla el gancho hacia +x).
  vec3 rotXY(vec3 v, float a) {
    float c = cos(a), s = sin(a);
    return vec3(v.x * c + v.y * s, -v.x * s + v.y * c, v.z);
  }
  vec3 rotZ(vec3 v, float a) {
    float c = cos(a), s = sin(a);
    return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z);
  }
  vec3 rotY(vec3 v, float a) {
    float c = cos(a), s = sin(a);
    return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
  }
  // Inclina hacia la cámara (+z) lo que apunta hacia arriba.
  vec3 rotX(vec3 v, float a) {
    float c = cos(a), s = sin(a);
    return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
  }

  // Deformación común a todo lo que está sobre el cuello de la raíz.
  vec3 shoot(vec3 p, inout vec3 n) {
    // 1. Gancho del hipocótilo: el último tramo del tallo se curva en arco.
    if (uHook > 0.001) {
      float h0 = max(uB, uB + uS - uHookL);
      float a = p.y - h0;
      if (a > 0.0) {
        float span = min(uS, uHookL);
        float k = uHook * 3.14159265 / uHookL;
        float aa = min(a, span);
        float phi = k * aa;
        float sp = sin(phi), cp = cos(phi);
        vec2 c = vec2((1.0 - cp) / k, h0 + sp / k);
        vec2 t = vec2(sp, cp);
        vec2 side = vec2(cp, -sp);
        vec2 q = c + t * (a - aa) + side * p.x;
        p = vec3(q, p.z);
        n = rotXY(n, phi);
      }
    }
    // 2. Inclinación hacia la luz y vaivén: más fuerte cuanto más arriba.
    float f = clamp(max(p.y, 0.0) / max(uTopH, 1.2), 0.0, 1.0);
    float f2 = f * f;
    float sway = sin(uTime * 0.8 + p.y * 0.4) * uSway + sin(uTime * 1.9 + p.y * 1.1) * uSway * 0.3;
    float joy = sin(uTime * 10.0 - p.y * 1.4) * uJoy;
    float amp = uTopH * 0.13;
    p.x += (uLean + sway + joy * 0.5) * f2 * amp;
    p.z += (sin(uTime * 0.63 + 1.3) * uSway * 0.7 + joy * 0.2) * f2 * amp;
    return p;
  }
`;

// Lo que está bajo tierra se ve un poco más apagado.
const UNDERGROUND_GLSL = /* glsl */ `
  float underground(float y) { return mix(0.72, 1.0, smoothstep(-0.25, 0.08, y)); }
`;

const LIGHT_GLSL = /* glsl */ `
  uniform vec3 uLight;
  float lambert(vec3 n, vec3 p) { return max(dot(n, normalize(uLight - p)), 0.0); }
  float rimLight(vec3 n, vec3 p) { return pow(1.0 - abs(dot(n, normalize(cameraPosition - p))), 2.4); }
`;

/* ------------------------------------------------------------------ */
/* Tallo                                                               */
/* ------------------------------------------------------------------ */
function buildUnitTube(along, around) {
  const count = (along + 1) * (around + 1);
  const aT = new Float32Array(count);
  const aAng = new Float32Array(count);
  let k = 0;
  for (let i = 0; i <= along; i++) {
    for (let j = 0; j <= around; j++) {
      aT[k] = i / along;
      aAng[k] = (j / around) * Math.PI * 2;
      k++;
    }
  }
  const index = [];
  for (let i = 0; i < along; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j;
      const b = a + around + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aT', new BufferAttribute(aT, 1));
  geo.setAttribute('aAng', new BufferAttribute(aAng, 1));
  geo.setIndex(index);
  return geo;
}

function stemMaterial(U) {
  return new ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      ${SHOOT_GLSL}
      attribute float aT;
      attribute float aAng;
      varying vec3 vN;
      varying vec3 vP;
      varying float vH;
      varying float vAng;
      void main() {
        float h = aT * uS;
        float distTip = (1.0 - aT) * uS;
        float r = uThick * mix(1.0, 0.5, smoothstep(0.0, 8.5, h));
        r *= mix(0.22, 1.0, smoothstep(0.0, 0.28, distTip));
        r *= 1.0 + 0.3 * (1.0 - smoothstep(0.0, 0.35, h));
        vec3 n = vec3(cos(aAng), 0.0, sin(aAng));
        vec3 p = shoot(stemAxis(h) + n * r, n);
        vN = n;
        vP = p;
        vH = h;
        vAng = aAng;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      ${UNDERGROUND_GLSL}
      varying vec3 vN;
      varying vec3 vP;
      varying float vH;
      varying float vAng;
      void main() {
        vec3 n = normalize(vN);
        // Bajo tierra el hipocótilo es pálido; al salir a la luz se pone verde.
        vec3 pale = vec3(0.86, 0.80, 0.6);
        vec3 green = vec3(0.22, 0.58, 0.32);
        vec3 base = mix(pale, green, smoothstep(-0.1, 0.9, vP.y));
        base = mix(base, vec3(0.5, 0.82, 0.42), smoothstep(3.0, 8.5, vH) * 0.55);
        base *= 0.9 + 0.1 * sin(vAng * 8.0);
        vec3 col = base * (0.34 + 0.75 * lambert(n, vP)) + rimLight(n, vP) * vec3(0.4, 0.95, 0.75) * 0.5;
        gl_FragColor = vec4(col * underground(vP.y), 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Hojas, cotiledones y pétalos: una misma lámina con distinta forma   */
/* ------------------------------------------------------------------ */
function buildBlade(instances, segU = 18, segV = 8) {
  const verts = (segU + 1) * (segV + 1);
  const uv = new Float32Array(verts * 2);
  let k = 0;
  for (let i = 0; i <= segU; i++) {
    for (let j = 0; j <= segV; j++) {
      uv[k++] = i / segU;
      uv[k++] = (j / segV) * 2 - 1;
    }
  }
  const index = [];
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = a + segV + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
  geo.setAttribute('aUV', new BufferAttribute(uv, 2));
  geo.setIndex(index);

  const n = instances.length;
  const node = new Float32Array(n);
  const yaw = new Float32Array(n);
  const size = new Float32Array(n);
  const tilt = new Float32Array(n);
  const seed = new Float32Array(n);
  instances.forEach((it, i) => {
    node[i] = it.node;
    yaw[i] = it.yaw;
    size[i] = it.size;
    tilt[i] = it.tilt;
    seed[i] = it.seed;
  });
  geo.setAttribute('iNode', new InstancedBufferAttribute(node, 1));
  geo.setAttribute('iYaw', new InstancedBufferAttribute(yaw, 1));
  geo.setAttribute('iSize', new InstancedBufferAttribute(size, 1));
  geo.setAttribute('iTilt', new InstancedBufferAttribute(tilt, 1));
  geo.setAttribute('iSeed', new InstancedBufferAttribute(seed, 1));
  geo.instanceCount = n;
  return geo;
}

function bladeMaterial(U, shape) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      ...U,
      uOpen: { value: 0 },
      uGrow: { value: 1 },
      uWidthK: { value: shape.widthK },
      uFold: { value: shape.fold },
      uDroop: { value: shape.droop },
      uPuff: { value: shape.puff },
      uShape: { value: shape.kind },
      uColA: { value: new Color(...shape.colors[0]) },
      uColB: { value: new Color(...shape.colors[1]) },
      uColC: { value: new Color(...shape.colors[2]) },
    },
    vertexShader: /* glsl */ `
      ${SHOOT_GLSL}
      attribute vec2 aUV;
      attribute float iNode;
      attribute float iYaw;
      attribute float iSize;
      attribute float iTilt;
      attribute float iSeed;
      uniform float uOpen;
      uniform float uGrow;
      uniform float uWidthK;
      uniform vec2 uFold;
      uniform vec2 uDroop;
      uniform float uPuff;
      uniform float uShape;
      varying vec2 vUV;
      varying vec3 vN;
      varying vec3 vP;
      varying float vOpen;
      varying float vSeed;

      float widthAt(float u) {
        if (uShape < 0.5) {
          // hoja: pecíolo delgado y lámina ovada con punta
          float b = clamp((u - 0.12) / 0.88, 0.0, 1.0);
          float blade = pow(sin(3.14159 * pow(b, 0.8)), 0.85) * (1.0 - 0.18 * b);
          return mix(0.05, blade, smoothstep(0.08, 0.2, u));
        }
        if (uShape < 1.5) return pow(sin(3.14159 * u), 0.55); // cotiledón carnoso
        return pow(sin(3.14159 * pow(u, 0.72)), 0.75);        // pétalo
      }

      vec3 bladeLocal(float u, float v, float o, float len) {
        float w = widthAt(u) * len * uWidthK;
        float s = v * w;
        float fold = mix(uFold.x, uFold.y, o);
        vec3 q = vec3(u * len, abs(s) * sin(fold), s * cos(fold));
        q.y -= uPuff * len * (1.0 - v * v) * sin(3.14159 * u);
        float droop = mix(uDroop.x, uDroop.y, o) * (0.8 + 0.4 * fract(iSeed * 7.31));
        q.y -= droop * q.x * q.x / (2.0 * max(len, 0.001));
        return q;
      }

      void main() {
        float u = aUV.x;
        float v = aUV.y;
        float o;
        float grow;
        if (uShape < 0.5) {
          o = smoothstep(iNode, iNode + ${LEAF_OPEN_LEN.toFixed(2)}, uS);
          grow = uS < iNode ? 0.0 : mix(0.22, 1.0, smoothstep(iNode, iNode + ${(LEAF_OPEN_LEN * 1.7).toFixed(2)}, uS));
        } else {
          o = uOpen;
          grow = uGrow;
        }
        float len = iSize * grow;
        vec3 q = bladeLocal(u, v, o, len);
        vec3 qu = bladeLocal(u + 0.01, v, o, len);
        vec3 qv = bladeLocal(u, v + 0.01, o, len);
        vec3 n = normalize(cross(qv - q, qu - q) + vec3(0.0, 1e-5, 0.0));

        // Cerrada apunta hacia arriba pegada al tallo; abierta se extiende.
        float elev = mix(1.52, iTilt, o);
        q = rotY(rotZ(q, elev), iYaw);
        n = rotY(rotZ(n, elev), iYaw);
        if (uShape > 1.5) {
          // La flor mira hacia quien visita, como mira hacia el sol.
          q = rotX(q, uHeadTilt);
          n = rotX(n, uHeadTilt);
        }

        float d = min(iNode, uS);
        vec3 outward = vec3(cos(iYaw), 0.0, -sin(iYaw));
        vec3 p = stemAxis(d) + outward * uThick * 0.7 + q;
        p = shoot(p, n);

        vUV = aUV;
        vN = n;
        vP = p;
        vOpen = o;
        vSeed = iSeed;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      ${UNDERGROUND_GLSL}
      uniform vec3 uColA;
      uniform vec3 uColB;
      uniform vec3 uColC;
      uniform float uShape;
      varying vec2 vUV;
      varying vec3 vN;
      varying vec3 vP;
      varying float vOpen;
      varying float vSeed;
      void main() {
        float u = vUV.x;
        float v = vUV.y;
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;

        vec3 base = mix(uColA, uColB, smoothstep(0.05, 0.75, u));
        if (uShape > 1.5) {
          base = mix(base, uColC, smoothstep(0.65, 1.0, u) * 0.6);
          base = mix(vec3(0.32, 0.62, 0.34), base, smoothstep(0.05, 0.7, vOpen)); // botón verde
        } else {
          float mid = 1.0 - smoothstep(0.0, 0.05 + 0.04 * (1.0 - u), abs(v));
          float lat = abs(fract(u * 7.0 - abs(v) * 1.3 + vSeed) - 0.5);
          float veins = (1.0 - smoothstep(0.0, 0.05, lat)) * smoothstep(0.18, 0.3, u) * (1.0 - smoothstep(0.7, 0.95, abs(v)));
          float amount = uShape < 0.5 ? 1.0 : 0.35;
          base = mix(base, uColC, (mid * 0.55 + veins * 0.25) * amount);
          base = mix(base, uColC, smoothstep(0.88, 1.0, abs(v)) * 0.2);
        }

        float diff = lambert(n, vP);
        float through = max(dot(-n, normalize(uLight - vP)), 0.0) * 0.5; // luz que atraviesa
        vec3 col = base * (0.32 + 0.7 * diff + through) + rimLight(n, vP) * uColC * 0.3;
        if (!gl_FrontFacing) col *= 0.86;
        gl_FragColor = vec4(col * underground(vP.y), 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Testa (cáscara de la semilla) y centro de la flor                   */
/* ------------------------------------------------------------------ */
function blobMaterial(U, { side, colors, transparent }) {
  return new ShaderMaterial({
    side: DoubleSide,
    transparent,
    uniforms: {
      ...U,
      uSide: { value: side },
      uRadii: { value: new Vector3(1, 1, 1) },
      uLift: { value: 0 },
      uCrack: { value: 0 },
      uShed: { value: 0 },
      uScale: { value: 1 },
      uColA: { value: new Color(...colors[0]) },
      uColB: { value: new Color(...colors[1]) },
    },
    vertexShader: /* glsl */ `
      ${SHOOT_GLSL}
      uniform float uSide;
      uniform vec3 uRadii;
      uniform float uLift;
      uniform float uCrack;
      uniform float uShed;
      uniform float uScale;
      varying vec3 vN;
      varying vec3 vP;
      varying vec3 vLocal;
      void main() {
        vec3 lp = position * uRadii * uScale;
        vec3 n = normalize(normal / uRadii);
        if (uSide == 0.0) {
          lp = rotX(lp, uHeadTilt);
          n = rotX(n, uHeadTilt);
        }
        if (uSide != 0.0) {
          // Las dos mitades de la testa se abren como bisagra desde abajo.
          float open = uCrack * 0.22 + uShed * 0.9;
          vec3 hinge = vec3(0.0, -uRadii.y * uScale, 0.0);
          lp = rotZ(lp - hinge, uSide * open) + hinge;
          n = rotZ(n, uSide * open);
        }
        vec3 p = shoot(stemAxis(uS) + vec3(0.0, uLift, 0.0) + lp, n);
        if (uSide != 0.0) {
          // y luego caen al suelo.
          p += vec3(-uSide * uShed * 0.7, -uShed * uShed * 1.9, uShed * 0.35);
        }
        vN = n;
        vP = p;
        vLocal = position;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      ${UNDERGROUND_GLSL}
      uniform vec3 uColA;
      uniform vec3 uColB;
      uniform float uShed;
      uniform float uSide;
      varying vec3 vN;
      varying vec3 vP;
      varying vec3 vLocal;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y);
        float b = mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y);
        return mix(a, b, f.z);
      }
      void main() {
        vec3 n = normalize(vN);
        bool inside = !gl_FrontFacing;
        if (inside) n = -n;
        vec3 base = mix(uColA, uColB, smoothstep(-0.8, 1.0, vLocal.y));
        if (uSide != 0.0) {
          // Moteado de la testa; por dentro es crema.
          float speck = smoothstep(0.58, 0.72, noise(vLocal * 7.0));
          base = mix(base, base * 0.62, speck * 0.7);
          if (inside) base = vec3(0.88, 0.82, 0.66);
        }
        float spec = pow(max(dot(reflect(-normalize(uLight - vP), n), normalize(cameraPosition - vP)), 0.0), 24.0);
        vec3 col = base * (0.36 + 0.72 * lambert(n, vP)) + spec * 0.35 + rimLight(n, vP) * vec3(0.95, 0.8, 0.55) * 0.35;
        gl_FragColor = vec4(col * underground(vP.y), 1.0 - uShed * uShed);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Raíces                                                              */
/* ------------------------------------------------------------------ */
function buildRoots(rand) {
  const roots = [];
  const main = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i <= 8; i++) {
    main.push(new Vector3(x, BASE_Y - i * 0.42, z));
    x += (rand() - 0.5) * 0.22;
    z += (rand() - 0.5) * 0.16;
  }
  const mainCurve = new CatmullRomCurve3(main);
  roots.push({ curve: mainCurve, radius: 0.05, start: 0, span: 0.55, length: mainCurve.getLength() });

  const laterals = 12;
  for (let i = 0; i < laterals; i++) {
    const tb = 0.08 + (i / laterals) * 0.78 + rand() * 0.04;
    const origin = mainCurve.getPointAt(tb);
    const ang = i * GOLDEN_ANGLE + rand() * 0.6;
    const len = (1.6 - tb * 1.1) * (0.75 + rand() * 0.4);
    const dir = new Vector3(Math.cos(ang), 0, Math.sin(ang) * 0.6);
    const pts = [origin.clone()];
    for (let s = 1; s <= 4; s++) {
      const f = s / 4;
      pts.push(
        origin
          .clone()
          .addScaledVector(dir, len * f)
          .add(new Vector3((rand() - 0.5) * 0.12, -len * (0.25 * f + 0.45 * f * f), (rand() - 0.5) * 0.1)),
      );
    }
    const curve = new CatmullRomCurve3(pts);
    const start = 0.55 * tb * 0.9 + 0.05;
    roots.push({ curve, radius: 0.024, start, span: 0.35, length: curve.getLength() });

    // Raicillas secundarias
    const subs = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < subs; k++) {
      const ts = 0.3 + rand() * 0.5;
      const o2 = curve.getPointAt(ts);
      const a2 = ang + (rand() - 0.5) * 1.8;
      const l2 = len * (0.25 + rand() * 0.2);
      const d2 = new Vector3(Math.cos(a2), 0, Math.sin(a2) * 0.6);
      const p2 = [
        o2.clone(),
        o2.clone().addScaledVector(d2, l2 * 0.5).add(new Vector3(0, -l2 * 0.25, 0)),
        o2.clone().addScaledVector(d2, l2).add(new Vector3(0, -l2 * 0.7, 0)),
      ];
      const c2 = new CatmullRomCurve3(p2);
      roots.push({ curve: c2, radius: 0.012, start: start + 0.15 + rand() * 0.05, span: 0.25, length: c2.getLength() });
    }
  }

  const along = 36;
  const around = 6;
  const perRoot = (along + 1) * (around + 1);
  const total = perRoot * roots.length;
  const center = new Float32Array(total * 3);
  const dir = new Float32Array(total * 3);
  const aT = new Float32Array(total);
  const info = new Float32Array(total * 4); // start, span, radius, length
  const seedArr = new Float32Array(total);
  const index = [];
  let v = 0;
  roots.forEach((root, r) => {
    const frames = root.curve.computeFrenetFrames(along, false);
    const seedValue = rand();
    for (let i = 0; i <= along; i++) {
      const t = i / along;
      const c = root.curve.getPointAt(t);
      for (let j = 0; j <= around; j++) {
        const ang = (j / around) * Math.PI * 2;
        const d = frames.normals[i]
          .clone()
          .multiplyScalar(Math.cos(ang))
          .addScaledVector(frames.binormals[i], Math.sin(ang));
        center.set([c.x, c.y, c.z], v * 3);
        dir.set([d.x, d.y, d.z], v * 3);
        aT[v] = t;
        info.set([root.start, root.span, root.radius, root.length], v * 4);
        seedArr[v] = seedValue;
        v++;
      }
    }
    const offset = r * perRoot;
    for (let i = 0; i < along; i++) {
      for (let j = 0; j < around; j++) {
        const a = offset + i * (around + 1) + j;
        const b = a + around + 1;
        index.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(center, 3));
  geo.setAttribute('aDir', new BufferAttribute(dir, 3));
  geo.setAttribute('aT', new BufferAttribute(aT, 1));
  geo.setAttribute('aInfo', new BufferAttribute(info, 4));
  geo.setAttribute('aSeed', new BufferAttribute(seedArr, 1));
  geo.setIndex(index);
  return geo;
}

function rootMaterial(U) {
  return new ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      uniform float uRoots;
      attribute vec3 aDir;
      attribute float aT;
      attribute vec4 aInfo;
      attribute float aSeed;
      varying vec3 vN;
      varying vec3 vP;
      varying float vT;
      varying float vToFront;
      varying float vLen;
      varying float vSeed;
      void main() {
        float front = clamp((uRoots - aInfo.x) / aInfo.y, 0.0, 1.0);
        float toFront = (front - aT) * aInfo.w;
        float r = aInfo.z * mix(1.0, 0.45, aT) * smoothstep(0.0, 0.14, toFront);
        vec3 p = position + aDir * r;
        vN = aDir;
        vP = p;
        vT = aT;
        vToFront = toFront;
        vLen = aInfo.w;
        vSeed = aSeed;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform float uTime;
      uniform float uWet;
      varying vec3 vN;
      varying vec3 vP;
      varying float vT;
      varying float vToFront;
      varying float vLen;
      varying float vSeed;
      void main() {
        vec3 n = normalize(vN);
        vec3 base = vec3(0.86, 0.8, 0.66);
        base = mix(base, vec3(1.0, 0.97, 0.9), (1.0 - smoothstep(0.0, 0.35, vToFront)) * 0.6); // punta clara
        vec3 col = base * (0.4 + 0.6 * lambert(n, vP)) * 0.78;
        // Pulsos que suben por la raíz como paquetes por una red.
        float pulse = smoothstep(0.9, 1.0, fract(vT * vLen * 0.9 + uTime * (0.35 + uWet * 0.6) + vSeed));
        col += pulse * vec3(0.3, 0.92, 0.82) * (0.55 + uWet * 0.8);
        col += uWet * vec3(0.1, 0.25, 0.35) * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ */
/* Suelo en corte, polen flotante, gotas y halos de luz                */
/* ------------------------------------------------------------------ */
function soilMesh(U) {
  const geo = new PlaneGeometry(60, 20, 1, 1);
  geo.translate(0, -9.6, 0);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { ...U, uFade: { value: 6 } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uWet;
      uniform float uFade;
      varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float surface = 0.06 * (noise(vec2(vW.x * 2.2, 0.5)) - 0.5) + 0.03 * (noise(vec2(vW.x * 7.0, 1.5)) - 0.5);
        float d = surface - vW.y;
        if (d < 0.0) discard;
        float depth = clamp(d / 5.0, 0.0, 1.0);
        vec3 col = mix(vec3(0.17, 0.115, 0.08), vec3(0.04, 0.045, 0.04), pow(depth, 0.7));
        float grain = noise(vW.xy * 18.0) * 0.5 + noise(vW.xy * 41.0) * 0.5;
        col *= 0.76 + 0.42 * grain;
        vec2 cell = floor(vW.xy * 9.0);
        vec2 local = fract(vW.xy * 9.0) - 0.5 - (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.5;
        float pebble = step(0.62, hash(cell)) * (1.0 - smoothstep(0.05, 0.11 + 0.08 * hash(cell + 1.3), length(local)));
        col += pebble * vec3(0.11, 0.085, 0.06) * (1.0 - depth);
        col *= 0.92 + 0.08 * sin(vW.y * 5.0 + noise(vec2(vW.x * 0.6, vW.y)) * 4.0);
        float wet = uWet * exp(-pow(vW.x / 1.8, 2.0)) * smoothstep(-3.0, 0.0, vW.y);
        col = mix(col, col * vec3(0.55, 0.68, 0.85), wet * 0.8);
        float edge = 1.0 - smoothstep(0.0, 0.05, d);
        col += edge * vec3(0.3, 0.55, 0.38) * 0.5;
        float side = 1.0 - smoothstep(uFade * 0.3, uFade * 0.85, abs(vW.x));
        float bottom = 1.0 - smoothstep(3.5, 8.0, d);
        gl_FragColor = vec4(col, side * bottom * 0.96);
      }
    `,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.z = -1.1;
  mesh.renderOrder = -1;
  return mesh;
}

function sporePoints(U, count, rand) {
  const geo = new BufferGeometry();
  const r = new Float32Array(count * 4);
  for (let i = 0; i < r.length; i++) r[i] = rand();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aRand', new BufferAttribute(r, 4));
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { ...U, uSporeTime: { value: 0 }, uPR: { value: 1 }, uTopY: { value: 3 } },
    vertexShader: /* glsl */ `
      uniform float uSporeTime;
      uniform float uPR;
      uniform float uTopY;
      attribute vec4 aRand;
      varying float vA;
      varying float vWarm;
      void main() {
        float H = uTopY + 1.5;
        float t = uSporeTime;
        float y = 0.15 + fract(aRand.y + t * (0.006 + 0.012 * aRand.w)) * H;
        float x = (aRand.x - 0.5) * 9.0 + sin(t * 0.3 + aRand.z * 6.28) * 0.5;
        float z = (aRand.z - 0.5) * 5.0 - 0.3;
        vec4 mv = viewMatrix * vec4(x, y, z, 1.0);
        float edge = smoothstep(0.0, 0.8, y) * (1.0 - smoothstep(H - 1.2, H, y));
        vA = edge * (0.35 + 0.65 * (0.5 + 0.5 * sin(t * 2.0 + aRand.x * 40.0)));
        vWarm = aRand.w;
        gl_PointSize = (1.5 + 3.0 * aRand.w) * uPR * (14.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      varying float vWarm;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(1.0 - smoothstep(0.0, 0.5, d), 1.6) * vA;
        vec3 col = mix(vec3(0.55, 1.0, 0.82), vec3(1.0, 0.86, 0.5), step(0.65, vWarm));
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function dropPoints(max) {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(max * 3), 3));
  geo.setDrawRange(0, 0);
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uPR: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uPR;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 11.0 * uPR * (14.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      void main() {
        // Gota: redonda abajo y en punta arriba.
        vec2 c = gl_PointCoord - 0.5;
        c.x *= 1.0 + (1.0 - smoothstep(-0.5, 0.1, c.y)) * 1.6;
        float d = length(c * vec2(1.6, 1.0));
        float a = 1.0 - smoothstep(0.36, 0.5, d);
        vec3 col = mix(vec3(0.45, 0.72, 1.0), vec3(0.92, 0.97, 1.0), 1.0 - smoothstep(0.0, 0.22, length(c + vec2(0.06, -0.08))));
        gl_FragColor = vec4(col, a * 0.92);
      }
    `,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function glowMesh(color) {
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uColor: { value: new Color(...color) }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(max(1.0 - d, 0.0), 2.2) * uAlpha;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 2;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Jardín                                                              */
/* ------------------------------------------------------------------ */
export function createGarden(canvas, { reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);

  const rand = mulberry32(2026);
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);

  const U = {
    uTime: { value: 0 },
    uB: { value: BASE_Y },
    uS: { value: 0 },
    uHook: { value: 1 },
    uHookL: { value: HOOK_LEN },
    uLean: { value: 0 },
    uSway: { value: reducedMotion ? 0 : 0.08 },
    uTopH: { value: 1.5 },
    uJoy: { value: 0 },
    uThick: { value: 0.045 },
    uHeadTilt: { value: 0.95 },
    uLight: { value: new Vector3(3, 6, 8) },
    uRoots: { value: 0 },
    uWet: { value: 0 },
  };

  // Suelo
  const soil = soilMesh(U);
  scene.add(soil);

  // Raíces
  const roots = new Mesh(buildRoots(rand), rootMaterial(U));
  roots.frustumCulled = false;
  scene.add(roots);

  // Tallo
  const stem = new Mesh(buildUnitTube(160, 12), stemMaterial(U));
  stem.frustumCulled = false;
  scene.add(stem);

  // Cotiledones
  const cotyledons = new Mesh(
    buildBlade([
      { node: COT_NODE, yaw: -0.45, size: 0.46, tilt: 0.38, seed: 0.31 },
      { node: COT_NODE, yaw: Math.PI - 0.45, size: 0.46, tilt: 0.38, seed: 0.77 },
    ]),
    bladeMaterial(U, {
      kind: 1,
      widthK: 0.52,
      fold: [0.0, 0.05],
      droop: [0.0, 0.3],
      puff: 0.17,
      colors: [
        [0.6, 0.74, 0.36],
        [0.78, 0.86, 0.46],
        [0.93, 0.95, 0.72],
      ],
    }),
  );
  cotyledons.frustumCulled = false;
  scene.add(cotyledons);

  // Hojas verdaderas en filotaxis áurea
  const leafData = [];
  const LEAVES = 9;
  for (let i = 0; i < LEAVES; i++) {
    const f = i / (LEAVES - 1);
    leafData.push({
      node: 3.0 + i * 0.56,
      yaw: i * GOLDEN_ANGLE + 1.2,
      size: (1.95 - 0.85 * f) * (0.9 + rand() * 0.2),
      tilt: 0.3 + 0.35 * f,
      seed: rand(),
    });
  }
  const leaves = new Mesh(
    buildBlade(leafData),
    bladeMaterial(U, {
      kind: 0,
      widthK: 0.47,
      fold: [1.25, 0.3],
      droop: [-0.4, 0.75],
      puff: 0,
      colors: [
        [0.12, 0.5, 0.3],
        [0.42, 0.82, 0.45],
        [0.75, 0.98, 0.76],
      ],
    }),
  );
  leaves.frustumCulled = false;
  scene.add(leaves);

  // Flor
  const PETALS = 7;
  const petalData = [];
  for (let i = 0; i < PETALS; i++) {
    petalData.push({ node: STEM_MAX + 1, yaw: (i / PETALS) * Math.PI * 2 + 0.3, size: 1.2, tilt: 0.18, seed: rand() });
  }
  for (let i = 0; i < 5; i++) {
    petalData.push({ node: STEM_MAX + 1, yaw: (i / 5) * Math.PI * 2 + 0.9, size: 0.8, tilt: 0.6, seed: rand() });
  }
  const petals = new Mesh(
    buildBlade(petalData, 14, 8),
    bladeMaterial(U, {
      kind: 2,
      widthK: 0.5,
      fold: [0.55, 0.16],
      droop: [-1.2, 0.4],
      puff: 0,
      colors: [
        [0.99, 0.74, 0.27],
        [0.98, 0.44, 0.58],
        [1.0, 0.88, 0.93],
      ],
    }),
  );
  petals.frustumCulled = false;
  scene.add(petals);

  const flowerCenter = new Mesh(
    new SphereGeometry(1, 24, 16),
    blobMaterial(U, { side: 0, colors: [[0.85, 0.55, 0.15], [1.0, 0.82, 0.3]], transparent: false }),
  );
  flowerCenter.material.uniforms.uRadii.value.set(0.24, 0.12, 0.24);
  flowerCenter.material.uniforms.uLift.value = 0.04;
  flowerCenter.frustumCulled = false;
  scene.add(flowerCenter);

  // Testa: dos mitades
  const coat = [-1, 1].map((side) => {
    const geo = new SphereGeometry(1, 32, 20, side < 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI);
    const mesh = new Mesh(
      geo,
      blobMaterial(U, { side, colors: [[0.42, 0.24, 0.13], [0.66, 0.42, 0.24]], transparent: true }),
    );
    mesh.material.uniforms.uRadii.value.set(0.26, 0.3, 0.23);
    mesh.material.uniforms.uLift.value = 0.2;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    return mesh;
  });

  // Polen flotante, gotas y halos
  const spores = sporePoints(U, reducedMotion ? 40 : 90, rand);
  scene.add(spores);

  const MAX_DROPS = 48;
  const drops = dropPoints(MAX_DROPS);
  scene.add(drops);
  const dropList = [];

  const seedGlow = glowMesh([0.55, 1.0, 0.75]);
  scene.add(seedGlow);
  const bloomGlow = glowMesh([1.0, 0.62, 0.55]);
  scene.add(bloomGlow);

  /* ---------------- estado ---------------- */
  let target = 0;
  let progress = 0;
  let width = 1;
  let height = 1;
  let shift = 0.2;
  // Sin cursor, la luz llega desde arriba a la derecha.
  const pointer = { x: 0.25, y: 0.75 };
  const cam = { y: -0.4, dist: 6, yaw: 0, pitch: 0 };
  let lean = 0;
  let joy = 0;
  let wet = 0;
  let last = performance.now();
  let raf = 0;
  let running = true;
  const tmp = new Vector3();

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, width < 720 ? 1.5 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // En escritorio la planta se corre a la derecha para dejar el texto libre.
    shift = width >= 1100 ? 0.24 : width >= 760 ? 0.16 : 0;
    camera.setViewOffset(width, height, -width * shift, 0, width, height);
    camera.updateProjectionMatrix();
    spores.material.uniforms.uPR.value = pr;
    drops.material.uniforms.uPR.value = pr;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;

    progress += (target - progress) * Math.min(1, dt * 2.4);
    if (Math.abs(target - progress) < 0.0005) progress = target;
    const st = plantState(progress);

    // Uniforms de la planta
    U.uTime.value = reducedMotion ? 0 : time;
    U.uS.value = st.stem;
    U.uHook.value = st.hook;
    U.uThick.value = st.thick;
    U.uRoots.value = st.roots;
    U.uTopH.value = Math.max(BASE_Y + st.stem, 1.5);

    const breathe = reducedMotion ? 0 : Math.sin(time * 1.6) * 0.02;
    coat.forEach((m) => {
      const u = m.material.uniforms;
      u.uCrack.value = st.crack;
      u.uShed.value = st.shed;
      u.uScale.value = 1 + 0.1 * st.crack + breathe;
      m.visible = st.shed < 0.999;
    });
    const cotU = cotyledons.material.uniforms;
    cotU.uOpen.value = st.cotOpen;
    cotU.uGrow.value = 1 + 0.4 * st.cotOpen;

    const petU = petals.material.uniforms;
    petU.uOpen.value = st.bloom;
    petU.uGrow.value = st.bud * (0.45 + 0.55 * st.bloom);
    petals.visible = st.bud > 0.001;
    flowerCenter.visible = st.bloom > 0.001;
    flowerCenter.material.uniforms.uScale.value = st.bloom;
    stem.visible = st.stem > 0.01;
    leaves.visible = st.stem > 3.0;

    // Luz: sigue al cursor.
    tmp.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize();
    U.uLight.value.copy(camera.position).addScaledVector(tmp, cam.dist * 0.75);
    U.uLight.value.z += 2.5;

    // Fototropismo: la planta se inclina hacia la luz.
    const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect * cam.dist;
    const leanTarget = Math.max(-1, Math.min(1, U.uLight.value.x / Math.max(halfW, 1))) * 0.85;
    lean += (leanTarget - lean) * Math.min(1, dt * 1.2);
    U.uLean.value = reducedMotion ? 0 : lean;

    // Riego: alegría y suelo húmedo que se secan solos
    joy *= Math.exp(-dt * 1.6);
    wet *= Math.exp(-dt * 0.25);
    U.uJoy.value = reducedMotion ? 0 : joy;
    U.uWet.value = wet;

    // Gotas
    if (dropList.length) {
      const arr = drops.geometry.attributes.position.array;
      for (let i = dropList.length - 1; i >= 0; i--) {
        const d = dropList[i];
        d.vy = Math.max(d.vy - 6 * dt, -5.5);
        d.y += d.vy * dt;
        if (d.y <= 0.02) {
          dropList.splice(i, 1);
          wet = Math.min(1, wet + 0.06);
          joy = Math.min(0.35, joy + 0.02);
        }
      }
      dropList.forEach((d, i) => arr.set([d.x, d.y, d.z], i * 3));
      drops.geometry.setDrawRange(0, dropList.length);
      drops.geometry.attributes.position.needsUpdate = true;
    } else {
      drops.geometry.setDrawRange(0, 0);
    }

    // Encuadre: de la semilla en primer plano a la planta entera.
    const tipY = BASE_Y + st.stem;
    const top = Math.max(1.9, tipY + (st.stem > 3 ? 1.3 : 0.7) + st.bud * 1.0);
    const bottom = -1.6 - 1.6 * smooth(seg(progress, 0.05, 0.6)) + 0.8 * smooth(seg(progress, 0.8, 1));
    const centerY = (top + bottom) / 2;
    const halfH = ((top - bottom) / 2) * 1.12;
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    // Espacio a la derecha del eje de la planta, en mitades del ancho visible.
    const rightRoom = (1 - 2 * shift) * 0.9;
    const needW = st.stem > 3 ? 2.5 : 1.1;
    const distH = halfH / tanHalf;
    const distW = needW / (tanHalf * camera.aspect * rightRoom);
    const distTarget = Math.max(distH, distW, 4.6);
    const ease = Math.min(1, dt * 2.2);
    cam.dist += (distTarget - cam.dist) * ease;
    cam.y += (centerY - cam.y) * ease;
    const yawTarget = reducedMotion ? 0 : pointer.x * 0.16;
    const pitchTarget = reducedMotion ? 0 : pointer.y * 0.05;
    cam.yaw += (yawTarget - cam.yaw) * Math.min(1, dt * 1.5);
    cam.pitch += (pitchTarget - cam.pitch) * Math.min(1, dt * 1.5);
    // Un poco desde arriba, para ver la cara de las hojas.
    camera.position.set(Math.sin(cam.yaw) * cam.dist, cam.y + (0.1 + cam.pitch) * cam.dist, Math.cos(cam.yaw) * cam.dist);
    camera.lookAt(0, cam.y, 0);
    soil.material.uniforms.uFade.value = Math.max(3.4, halfW * 1.15);
    spores.material.uniforms.uTopY.value = Math.max(top, 2.5);
    spores.material.uniforms.uSporeTime.value = reducedMotion ? 0 : time;

    // Halos: la semilla brilla al inicio; la flor al final.
    seedGlow.position.set(0.02, BASE_Y + 0.2, -0.4);
    seedGlow.scale.setScalar(2.1 + (reducedMotion ? 0 : Math.sin(time * 1.6) * 0.12));
    seedGlow.material.uniforms.uAlpha.value = 0.85 * st.seedGlow;
    seedGlow.visible = st.seedGlow > 0.01;
    seedGlow.quaternion.copy(camera.quaternion);

    const topAmp = U.uTopH.value * 0.13;
    bloomGlow.position.set(Math.sin(st.stem * 0.5) * 0.16 + lean * topAmp, tipY + 0.3, -0.3);
    bloomGlow.scale.setScalar(4.2);
    bloomGlow.material.uniforms.uAlpha.value = 0.55 * st.bloom;
    bloomGlow.visible = st.bloom > 0.01;
    bloomGlow.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      running = false;
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    cancelAnimationFrame(raf);
    canvas.classList.add('is-lost');
  });

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    /** Progreso del recorrido, de 0 (semilla) a 1 (flor). */
    setProgress(p) {
      target = clamp01(p);
    },
    /** Posición del puntero en coordenadas normalizadas (-1 a 1). */
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    /** Lluvia de gotas sobre la planta. */
    water() {
      const st = plantState(progress);
      // Nacen en el borde superior de lo que se ve, sobre la planta.
      const visibleTop = cam.y + Math.tan((camera.fov * Math.PI) / 360) * cam.dist * 0.85;
      const spread = st.stem > 3 ? 1.6 : 0.8;
      for (let i = 0; i < 26 && dropList.length < MAX_DROPS; i++) {
        dropList.push({
          x: (Math.random() - 0.5) * spread * 2 + lean * 0.3,
          y: visibleTop + Math.random() * 1.8,
          z: (Math.random() - 0.5) * 1.2,
          vy: -Math.random(),
        });
      }
      joy = Math.min(0.35, joy + 0.1);
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
}

