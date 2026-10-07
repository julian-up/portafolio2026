import { LitElement, html, css } from '../vendor/lit-3.3.1.min.js';

const VISITS_KEY = 'jsg:visitas';

function readVisits() {
  try {
    return Number(localStorage.getItem(VISITS_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveVisits(count) {
  try {
    localStorage.setItem(VISITS_KEY, String(count));
  } catch {
    /* modo privado: no pasa nada, solo no recordamos la visita */
  }
}

/**
 * <greeting-line>
 * Saludo según la hora de quien visita y un "qué bueno verte de nuevo"
 * si ya había pasado por aquí.
 */
export class GreetingLine extends LitElement {
  static properties = {
    _hour: { state: true },
  };

  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    :host {
      display: inline-flex;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      padding: 0.42rem 0.95rem 0.42rem 0.6rem;
      border-radius: 999px;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      background: var(--glass, rgba(10, 26, 22, 0.55));
      backdrop-filter: blur(10px);
      font: 500 0.82rem/1.3 var(--font, system-ui);
      color: var(--muted, #9fb3ad);
    }
    .chip strong {
      color: var(--text, #eef6f2);
      font-weight: 600;
    }
    .wave {
      display: inline-block;
      font-size: 1.05rem;
      transform-origin: 70% 70%;
      animation: wave 2.4s ease-in-out 0.8s 2;
    }
    @keyframes wave {
      0%, 60%, 100% { transform: rotate(0); }
      10%, 30% { transform: rotate(16deg); }
      20% { transform: rotate(-8deg); }
      40% { transform: rotate(-4deg); }
      50% { transform: rotate(10deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .wave { animation: none; }
    }
  `;

  constructor() {
    super();
    this._hour = new Date().getHours();
    this._visits = readVisits();
    saveVisits(this._visits + 1);
  }

  get _salute() {
    if (this._hour >= 5 && this._hour < 12) return 'Buenos días';
    if (this._hour >= 12 && this._hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get _message() {
    return this._visits > 0 ? 'qué bueno verte de nuevo' : 'te doy la bienvenida';
  }

  render() {
    return html`
      <span class="chip">
        <span class="wave" aria-hidden="true">👋</span>
        <span><strong>${this._salute}</strong>, ${this._message}.</span>
      </span>
    `;
  }
}

customElements.define('greeting-line', GreetingLine);
