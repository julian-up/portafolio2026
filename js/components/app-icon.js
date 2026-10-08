import { LitElement, html, css, svg, nothing } from '../vendor/lit-3.3.1.min.js';

/*
 * Íconos de línea propios (24 × 24, trazo de 1,75). A diferencia de los
 * emojis, se ven igual en Windows, macOS, Android e iOS y toman el color del
 * texto que los rodea.
 */
export const ICONS = {
  // Etapas de la planta
  seed: svg`<ellipse cx="12" cy="12" rx="6" ry="7.8" transform="rotate(-28 12 12)"/><path d="M10.9 8.7c1.1 1 1.2 2.1 1.1 3.2-.1 1.1.2 2.3 1.2 3.4"/>`,
  germination: svg`<ellipse cx="12" cy="8" rx="5.5" ry="4.5"/><path d="M12 12.5v3.2c0 2.2-1.4 3.7-3.5 4.8"/><path d="M12 16.4c.9 1.4 2.3 2.2 4 2.4"/>`,
  sprout: svg`<path d="M12 20v-8"/><path d="M12 12C12 8.6 9.6 6.2 5 6.2c0 3.9 2.5 5.8 7 5.8z"/><path d="M12 12c0-3.4 2.4-5.8 7-5.8 0 3.9-2.5 5.8-7 5.8z"/><path d="M7 20h10"/>`,
  leaves: svg`<path d="M12 21V7.5"/><path d="M12 14c-1.4-2.6-4-3.7-7.2-3.2.6 3.1 3.2 4.4 7.2 3.2z"/><path d="M12 10c1.4-2.6 4-3.7 7.2-3.2-.6 3.1-3.2 4.4-7.2 3.2z"/><path d="M12 7.5c0-2 .8-3.6 2.3-4.8"/><path d="M8 21h8"/>`,
  bud: svg`<path d="M12 21.5v-7"/><path d="M12 14.5c-2.8 0-4.6-2.3-4.6-5S9.6 3.6 12 2.5c2.4 1.1 4.6 4.3 4.6 7s-1.8 5-4.6 5z"/><path d="M12 14.5c-.9-1.9-1-4.8 0-8"/><path d="M12 18.5c-1.9 0-3.4-.9-4-2.3M12 18.5c1.9 0 3.4-.9 4-2.3"/>`,
  flower: svg`<path d="M12.0 3.4L12.7 3.5L13.3 3.9L13.8 4.4L14.2 5.2L14.4 6.1L14.5 7.1L14.3 8.3L13.8 9.6L14.9 8.7L15.9 8.1L16.9 7.8L17.8 7.8L18.6 7.9L19.3 8.3L19.9 8.7L20.2 9.3L20.3 10.0L20.1 10.7L19.8 11.4L19.2 12.0L18.4 12.5L17.4 12.9L16.3 13.0L14.9 12.9L16.1 13.7L16.9 14.5L17.5 15.3L17.8 16.2L17.9 17.1L17.8 17.8L17.5 18.5L17.1 19.0L16.4 19.3L15.7 19.3L15.0 19.2L14.2 18.8L13.5 18.2L12.9 17.4L12.3 16.4L12.0 15.0L11.7 16.4L11.1 17.4L10.5 18.2L9.8 18.8L9.0 19.2L8.3 19.3L7.6 19.3L6.9 19.0L6.5 18.5L6.2 17.8L6.1 17.1L6.2 16.2L6.5 15.3L7.1 14.5L7.9 13.7L9.1 12.9L7.7 13.0L6.6 12.9L5.6 12.5L4.8 12.0L4.2 11.4L3.9 10.7L3.7 10.0L3.8 9.3L4.1 8.7L4.7 8.3L5.4 7.9L6.2 7.8L7.1 7.8L8.1 8.1L9.1 8.7L10.2 9.6L9.7 8.3L9.5 7.1L9.6 6.1L9.8 5.2L10.2 4.4L10.7 3.9L11.3 3.5Z"/><circle cx="12" cy="12" r="2"/>`,
  drop: svg`<path d="M12 3c3.5 4.2 6 7.4 6 10.6a6 6 0 0 1-12 0C6 10.4 8.5 7.2 12 3z"/><path d="M9.4 14.2a2.7 2.7 0 0 0 2.4 2.6"/>`,
  leaf: svg`<path d="M5 19.5C5 11 10.5 4.5 20 4.5c0 9.5-6 15-14 15z"/><path d="M5 19.5c3-4.3 6.3-7 10-9"/>`,

  // Saludo según la hora
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>`,
  sunset: svg`<path d="M3.5 17.5h17"/><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0"/><path d="M12 9V7M6 11.5 4.6 10.1M18 11.5l1.4-1.4"/><path d="M8 21h8"/>`,
  moon: svg`<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/>`,

  // Acciones e intenciones
  search: svg`<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>`,
  grid: svg`<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>`,
  message: svg`<path d="M5 19.5v-13A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9z"/><path d="M9 8.6h6M9 11.6h3.6"/>`,
  mail: svg`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.6 6.6 8.4 6.4 8.4-6.4"/>`,
  pin: svg`<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>`,
  'arrow-up-right': svg`<path d="M7 17 17 7M8.5 7H17v8.5"/>`,
  close: svg`<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,

  // Habilidades
  cube: svg`<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>`,
  braces: svg`<path d="M9 4H8a2 2 0 0 0-2 2v3.5A2.5 2.5 0 0 1 3.8 12 2.5 2.5 0 0 1 6 14.5V18a2 2 0 0 0 2 2h1"/><path d="M15 4h1a2 2 0 0 1 2 2v3.5a2.5 2.5 0 0 0 2.2 2.5 2.5 2.5 0 0 0-2.2 2.5V18a2 2 0 0 1-2 2h-1"/>`,
  code: svg`<path d="m8 7.5-4.5 4.5L8 16.5M16 7.5l4.5 4.5-4.5 4.5M13.6 4.5l-3.2 15"/>`,
  exchange: svg`<path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5"/><path d="M20 16H6M9.5 12.5 6 16l3.5 3.5"/>`,
  atom: svg`<ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>`,
  devices: svg`<rect x="2.5" y="4.5" width="12" height="9" rx="1.5"/><path d="M6.5 17.5h4M8.5 13.5v4"/><rect x="16.5" y="8.5" width="5" height="11" rx="1.2"/>`,
  branch: svg`<circle cx="6.5" cy="5.5" r="2"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="7.5" r="2"/><path d="M6.5 7.5v9"/><path d="M17.5 9.5c0 4.2-3.4 5.3-6.6 5.8-2 .3-3.6 1-4.4 1.6"/>`,
  check: svg`<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.8 2.8L16.4 9.4"/>`,

  // Formación
  monitor: svg`<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16v4"/><path d="m9.5 8.2-2 1.8 2 1.8M14.5 8.2l2 1.8-2 1.8"/>`,
  laptop: svg`<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 19h19M4.5 15l-2 4M19.5 15l2 4"/>`,
  phone: svg`<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>`,
  network: svg`<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18.5" r="2.2"/><circle cx="19" cy="18.5" r="2.2"/><path d="M11 7 6.1 16.5M13 7l4.9 9.5M7.2 18.5h9.6"/>`,
};

/** Plantilla SVG de un ícono, para usar dentro de otros componentes. */
export function icon(name, className = 'icon') {
  const paths = ICONS[name];
  if (!paths) return nothing;
  return html`<svg
    class=${className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >${paths}</svg>`;
}

/**
 * <app-icon name="sprout">
 * El mismo ícono para usar directo en el HTML. Su tamaño se da con width y
 * height (o con font-size: mide 1em por defecto).
 */
export class AppIcon extends LitElement {
  static properties = {
    name: { type: String, reflect: true },
  };

  static styles = css`
    :host {
      display: inline-block;
      width: 1em;
      height: 1em;
      flex-shrink: 0;
      line-height: 0;
      vertical-align: -0.125em;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    return icon(this.name);
  }
}

customElements.define('app-icon', AppIcon);
