# portafolio2026

Mi portafolio como profesional, donde agrego los proyectos que voy realizando en mi carrera como
desarrollador e ingeniero.

Mientras bajas, una semilla germina en el fondo: sale la raíz, el tallo rompe el suelo en forma de
gancho, abren los cotiledones, aparecen las hojas en filotaxis áurea y, al llegar a Contacto, florece.

## Cómo está hecho

Sitio estático, sin paso de compilación: HTML, CSS y módulos de JavaScript que el navegador carga
directamente.

```
index.html
css/styles.css
js/
├── main.js              arranque: scroll → etapas de la planta, navegación, interacciones
├── garden.js            la planta en WebGL (Three.js + shaders GLSL propios)
├── components/          Web Components con Lit
│   ├── app-icon.js        íconos de línea propios (SVG), en lugar de emojis
│   ├── greeting-line.js   saludo según la hora y si ya habías visitado
│   ├── intent-picker.js   "¿Qué te trae por aquí?"
│   ├── project-card.js    tarjeta de proyecto con vista previa
│   ├── site-preview.js    ventana con el sitio en vivo (escritorio / celular)
│   ├── growth-meter.js    etapa de la planta y botón para regarla
│   ├── toast-host.js      mensajes cortos
│   └── count-up.js        cifras que cuentan al aparecer
└── vendor/              Lit y Three.js empaquetados en un solo archivo cada uno
assets/
├── fotos/profile.jpeg
├── hv/Julian_Gonzalez_HV.pdf
├── og-image.jpg         imagen que se ve al compartir el enlace
└── favicon.svg
```

Respeta `prefers-reduced-motion` y, si el navegador no tiene WebGL, el fondo pasa a un degradado
y todo el contenido sigue igual.

## Verlo en local

Los módulos de JavaScript no cargan abriendo el archivo con doble clic; hace falta un servidor:

```bash
npx serve .
# o
python3 -m http.server 8000
```

## Publicar en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio `julian-up/portafolio2026`.
2. Framework Preset: **Other**. Sin comando de build y con el directorio de salida vacío (la raíz).
3. Deploy. `vercel.json` ya trae las cabeceras de caché.

Cuando tengas la URL definitiva, cámbiala en la etiqueta `og:image` de `index.html` para que la
vista previa al compartir el enlace (WhatsApp, LinkedIn) apunte a ese dominio.

## Actualizar Lit o Three.js

Los archivos de `js/vendor/` llevan la versión en el nombre y se generaron con esbuild:

```bash
npm i three@0.180.0 lit@3.3.1 esbuild
# Lit
echo "export { LitElement, html, css, svg, nothing } from 'lit';
export { repeat } from 'lit/directives/repeat.js';" > lit-entry.js
npx esbuild lit-entry.js --bundle --format=esm --minify --outfile=js/vendor/lit-3.3.1.min.js
# Three.js: solo las clases que usa garden.js
echo "export { Scene, PerspectiveCamera, WebGLRenderer, Mesh, Points, BufferGeometry, BufferAttribute,
  InstancedBufferGeometry, InstancedBufferAttribute, ShaderMaterial, SphereGeometry, PlaneGeometry,
  CatmullRomCurve3, Vector3, Color, AdditiveBlending, DoubleSide } from 'three';" > three-entry.js
npx esbuild three-entry.js --bundle --format=esm --minify --outfile=js/vendor/three-0.180.0.min.js
```
