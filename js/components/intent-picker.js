import { LitElement, html, css } from '../vendor/lit-3.3.1.min.js';
import { icon } from './app-icon.js';

const INTENTS = [
  {
    id: 'talento',
    icon: 'search',
    label: 'Busco talento frontend',
    target: '#stack',
    reply: '¡Genial! Esto es lo que puedo aportar a tu equipo.',
  },
  {
    id: 'proyectos',
    icon: 'grid',
    label: 'Quiero ver proyectos',
    target: '#projects',
    reply: 'Vamos. Cada proyecto tiene vista previa en vivo.',
  },
  {
    id: 'propuesta',
    icon: 'message',
    label: 'Tengo una propuesta',
    target: '#contact',
    reply: '¡Me encanta! Estos son los caminos más rápidos para hablar.',
  },
  {
    id: 'curiosear',
    icon: 'sprout',
    label: 'Solo vengo a curiosear',
    target: '#about',
    reply: 'Bienvenido el curioseo. Baja despacio y mira crecer la planta.',
  },
];

/**
 * <intent-picker>
 * "¿Qué te trae por aquí?": cada opción lleva a la sección que le sirve a
 * quien visita. Emite `intent-select` con { id, target, reply, icon }.
 */
export class IntentPicker extends LitElement {
  static properties = {
    selected: { type: String, reflect: true },
  };

  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    :host {
      display: block;
    }
    p {
      margin: 0 0 0.8rem;
      font: 500 0.78rem/1.4 var(--mono, monospace);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--dim, #6f857e);
    }
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 0.95rem;
      border-radius: 999px;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      background: var(--glass, rgba(10, 26, 22, 0.55));
      backdrop-filter: blur(10px);
      color: var(--text, #eef6f2);
      font: 500 0.86rem/1.2 var(--font, system-ui);
      cursor: pointer;
      transition: border-color 0.25s, background 0.25s, transform 0.25s;
    }
    button:hover {
      border-color: var(--leaf, #6ee7a8);
      transform: translateY(-2px);
    }
    button:focus-visible {
      outline: 2px solid var(--leaf, #6ee7a8);
      outline-offset: 3px;
    }
    button[aria-pressed='true'] {
      border-color: var(--leaf, #6ee7a8);
      background: rgba(110, 231, 168, 0.14);
    }
    .icon {
      width: 17px;
      height: 17px;
      color: var(--leaf, #6ee7a8);
    }
  `;

  _choose(intent) {
    this.selected = intent.id;
    this.dispatchEvent(
      new CustomEvent('intent-select', {
        detail: { id: intent.id, target: intent.target, reply: intent.reply, icon: intent.icon },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <p id="question">¿Qué te trae por aquí?</p>
      <ul aria-labelledby="question">
        ${INTENTS.map(
          (intent) => html`
            <li>
              <button
                type="button"
                aria-pressed=${this.selected === intent.id ? 'true' : 'false'}
                @click=${() => this._choose(intent)}
              >
                ${icon(intent.icon)}${intent.label}
              </button>
            </li>
          `,
        )}
      </ul>
    `;
  }
}

customElements.define('intent-picker', IntentPicker);
