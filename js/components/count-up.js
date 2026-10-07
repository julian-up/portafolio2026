import { LitElement, html, css } from '../vendor/lit-3.3.1.min.js';

const format = new Intl.NumberFormat('es-CO');

/**
 * <count-up to="7000" prefix="" suffix="+">
 * Cuenta desde cero hasta `to` la primera vez que entra en pantalla.
 */
export class CountUp extends LitElement {
  static properties = {
    to: { type: Number },
    prefix: { type: String },
    suffix: { type: String },
    duration: { type: Number },
    _value: { state: true },
  };

  static styles = css`
    :host {
      display: inline;
      font-variant-numeric: tabular-nums;
    }
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;

  constructor() {
    super();
    this.to = 0;
    this.prefix = '';
    this.suffix = '';
    this.duration = 1400;
    this._value = 0;
  }

  connectedCallback() {
    super.connectedCallback();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      this._value = this.to;
      return;
    }
    this._observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        this._observer.disconnect();
        this._animate();
      },
      { threshold: 0.6 },
    );
    this._observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
    cancelAnimationFrame(this._raf);
  }

  _animate() {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / this.duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this._value = Math.round(this.to * eased);
      if (t < 1) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  render() {
    // El lector de pantalla lee el número final, no la cuenta en curso.
    return html`<span aria-hidden="true">${this.prefix}${format.format(this._value)}${this.suffix}</span
      ><span class="sr">${this.prefix}${format.format(this.to)}${this.suffix}</span>`;
  }
}

customElements.define('count-up', CountUp);
