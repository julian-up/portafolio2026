import { LitElement, html, css, repeat } from '../vendor/lit-3.3.1.min.js';
import { icon } from './app-icon.js';

/**
 * <toast-host>
 * Mensajes cortos y amables: `show('¡Copiado!', { icon: 'mail' })`.
 */
export class ToastHost extends LitElement {
  static properties = {
    _toasts: { state: true },
  };

  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    :host {
      position: fixed;
      top: calc(var(--nav-h, 68px) + 0.75rem);
      right: 1rem;
      z-index: 60;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      max-width: min(360px, calc(100vw - 2rem));
      padding: 0.75rem 1rem;
      border-radius: 14px;
      border: 1px solid rgba(110, 231, 168, 0.3);
      background: rgba(6, 17, 14, 0.9);
      backdrop-filter: blur(12px);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
      color: var(--text, #eef6f2);
      font: 500 0.86rem/1.4 var(--font, system-ui);
      animation: enter 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .toast.leaving {
      animation: leave 0.3s ease forwards;
    }
    .icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: var(--leaf, #6ee7a8);
    }
    @keyframes enter {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
    }
    @keyframes leave {
      to { opacity: 0; transform: translateY(8px); }
    }
    @media (max-width: 720px) {
      :host {
        left: 0.75rem;
        right: 0.75rem;
        align-items: center;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .toast,
      .toast.leaving {
        animation: none;
      }
    }
  `;

  constructor() {
    super();
    this._toasts = [];
    this._nextId = 1;
  }

  show(message, { icon: nombre = 'sprout', timeout = 3600 } = {}) {
    const id = this._nextId++;
    this._toasts = [...this._toasts, { id, message, icon: nombre, leaving: false }].slice(-3);
    setTimeout(() => this._dismiss(id), timeout);
  }

  _dismiss(id) {
    this._toasts = this._toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => (this._toasts = this._toasts.filter((t) => t.id !== id)), 320);
  }

  render() {
    return html`
      <div role="status" aria-live="polite">
        ${repeat(
          this._toasts,
          (t) => t.id,
          (t) => html`
            <div class="toast ${t.leaving ? 'leaving' : ''}">
              ${icon(t.icon)}${t.message}
            </div>
          `,
        )}
      </div>
    `;
  }
}

customElements.define('toast-host', ToastHost);
