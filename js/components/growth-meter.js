import { LitElement, html, css } from '../vendor/lit-3.3.1.min.js';

/**
 * <growth-meter>
 * Muestra en qué etapa va la planta del fondo y deja regarla.
 * La página le pasa `progress` (0–1), `stage`, `icon` y `hint`;
 * el botón emite `water`.
 */
export class GrowthMeter extends LitElement {
  static properties = {
    progress: { type: Number },
    stage: { type: String },
    icon: { type: String },
    hint: { type: String },
    waterings: { type: Number },
    _splash: { state: true },
  };

  static styles = css`
    :host {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 50;
      width: 260px;
    }
    .meter {
      padding: 0.85rem 0.95rem 0.8rem;
      border-radius: 16px;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      background: rgba(6, 17, 14, 0.78);
      backdrop-filter: blur(14px) saturate(140%);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 0.7rem;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      flex-shrink: 0;
      border-radius: 12px;
      background: rgba(110, 231, 168, 0.1);
      font-size: 1.2rem;
    }
    .label {
      flex: 1;
      min-width: 0;
    }
    .label small {
      display: block;
      font: 500 0.64rem/1.3 var(--mono, monospace);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--dim, #6f857e);
    }
    .label strong {
      display: block;
      font: 600 0.9rem/1.3 var(--font, system-ui);
      color: var(--text, #eef6f2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .water {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.45rem 0.65rem;
      border-radius: 10px;
      border: 1px solid rgba(96, 165, 250, 0.35);
      background: rgba(96, 165, 250, 0.1);
      color: #bfdbfe;
      font: 600 0.75rem/1 var(--font, system-ui);
      cursor: pointer;
      transition: background 0.25s, transform 0.2s;
    }
    .water:hover {
      background: rgba(96, 165, 250, 0.2);
    }
    .water:active {
      transform: scale(0.95);
    }
    .water:focus-visible {
      outline: 2px solid #93c5fd;
      outline-offset: 2px;
    }
    .water.splash .drop {
      animation: drip 0.6s ease;
    }
    @keyframes drip {
      40% { transform: translateY(3px) scale(1.25); }
    }
    .drop {
      display: inline-block;
    }
    .bar {
      height: 4px;
      margin-top: 0.7rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.07);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #a3e635, #34d399 55%, #fb7185);
      transform-origin: left;
      transition: transform 0.25s linear;
    }
    .hint {
      margin: 0.55rem 0 0;
      font: 400 0.74rem/1.45 var(--font, system-ui);
      color: var(--muted, #9fb3ad);
    }
    @media (max-width: 720px) {
      :host {
        left: 0.75rem;
        right: auto;
        bottom: 0.75rem;
        width: auto;
      }
      .meter {
        padding: 0.45rem 0.5rem 0.45rem 0.45rem;
        border-radius: 999px;
      }
      .icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        font-size: 1rem;
      }
      .label small,
      .bar,
      .hint {
        display: none;
      }
      .label strong {
        font-size: 0.78rem;
        max-width: 9.5rem;
      }
      .water {
        border-radius: 999px;
      }
      .water .text {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar span { transition: none; }
      .water.splash .drop { animation: none; }
    }
  `;

  constructor() {
    super();
    this.progress = 0;
    this.stage = 'Semilla';
    this.icon = '🌰';
    this.hint = '';
    this.waterings = 0;
    this._splash = false;
  }

  _water() {
    this._splash = false;
    requestAnimationFrame(() => (this._splash = true));
    this.dispatchEvent(new CustomEvent('water', { bubbles: true, composed: true }));
  }

  render() {
    const pct = Math.round(Math.min(Math.max(this.progress, 0), 1) * 100);
    return html`
      <div class="meter">
        <div class="row">
          <span class="icon" aria-hidden="true">${this.icon}</span>
          <div class="label">
            <small>Etapa · ${pct}%</small>
            <strong aria-live="polite">${this.stage}</strong>
          </div>
          <button
            class="water ${this._splash ? 'splash' : ''}"
            type="button"
            title="Regar la planta"
            aria-label=${this.waterings ? `Regar la planta (llevas ${this.waterings})` : 'Regar la planta'}
            @click=${this._water}
            @animationend=${() => (this._splash = false)}
          >
            <span class="drop" aria-hidden="true">💧</span>
            <span class="text">${this.waterings ? `×${this.waterings}` : 'Regar'}</span>
          </button>
        </div>
        <div class="bar" aria-hidden="true"><span style="transform: scaleX(${pct / 100})"></span></div>
        <p class="hint">${this.hint}</p>
      </div>
    `;
  }
}

customElements.define('growth-meter', GrowthMeter);
