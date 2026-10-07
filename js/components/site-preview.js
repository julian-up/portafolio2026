import { LitElement, html, css, nothing } from '../vendor/lit-3.3.1.min.js';
import { icon } from './app-icon.js';

/**
 * <site-preview>
 * Ventana con el sitio en vivo dentro de un iframe, con cambio entre vista de
 * escritorio y de celular. Se abre con `open({ url, name })`.
 */
export class SitePreview extends LitElement {
  static properties = {
    _url: { state: true },
    _name: { state: true },
    _device: { state: true },
    _loaded: { state: true },
  };

  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    dialog {
      width: min(1180px, 94vw);
      height: min(820px, 90vh);
      padding: 0;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
      border-radius: 18px;
      background: var(--bg, #06110e);
      color: var(--text, #eef6f2);
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.6);
      overflow: hidden;
    }
    dialog[open] {
      display: flex;
      flex-direction: column;
      animation: rise 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    dialog::backdrop {
      background: rgba(2, 8, 6, 0.72);
      backdrop-filter: blur(6px);
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(24px) scale(0.98); }
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.8rem;
      border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      background: rgba(255, 255, 255, 0.03);
    }
    .dots {
      display: flex;
      gap: 6px;
    }
    .dots i {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: #ff5f57;
    }
    .dots i:nth-child(2) { background: #febc2e; }
    .dots i:nth-child(3) { background: #28c840; }
    .address {
      flex: 1;
      min-width: 0;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.35);
      font: 400 0.78rem/1.2 var(--mono, monospace);
      color: var(--muted, #9fb3ad);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .devices {
      display: flex;
      padding: 3px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.35);
    }
    button,
    a {
      font: 600 0.78rem/1 var(--font, system-ui);
      color: var(--text, #eef6f2);
    }
    .devices button {
      padding: 0.45rem 0.7rem;
      border: 0;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      color: var(--muted, #9fb3ad);
    }
    .devices button[aria-pressed='true'] {
      background: rgba(110, 231, 168, 0.16);
      color: var(--leaf, #6ee7a8);
    }
    .open {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
      text-decoration: none;
      white-space: nowrap;
    }
    .close {
      width: 34px;
      height: 34px;
      border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: transparent;
      cursor: pointer;
    }
    .icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }
    .close .icon {
      width: 17px;
      height: 17px;
    }
    .hint .icon {
      vertical-align: -2px;
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid var(--leaf, #6ee7a8);
      outline-offset: 2px;
    }
    .stage {
      position: relative;
      flex: 1;
      display: flex;
      justify-content: center;
      background:
        radial-gradient(circle at 50% 0%, rgba(110, 231, 168, 0.08), transparent 60%),
        #030a08;
      overflow: auto;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      background: #fff;
      transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .mobile iframe {
      width: 390px;
      max-width: 100%;
      height: calc(100% - 32px);
      margin: 16px 0;
      border-radius: 28px;
      box-shadow: 0 0 0 10px #111a17, 0 20px 60px rgba(0, 0, 0, 0.6);
    }
    .loading {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font: 500 0.9rem/1.4 var(--font, system-ui);
      color: var(--muted, #9fb3ad);
      pointer-events: none;
    }
    .loading span {
      animation: breathe 1.4s ease-in-out infinite;
    }
    @keyframes breathe {
      50% { opacity: 0.4; }
    }
    .hint {
      margin: 0;
      padding: 0.55rem 1rem;
      border-top: 1px solid var(--border, rgba(255, 255, 255, 0.1));
      font: 400 0.75rem/1.4 var(--font, system-ui);
      color: var(--dim, #6f857e);
    }
    .hint a {
      color: var(--leaf, #6ee7a8);
      font-weight: 500;
    }
    @media (max-width: 720px) {
      dialog {
        width: 100vw;
        height: 100dvh;
        max-width: none;
        max-height: none;
        border-radius: 0;
      }
      .dots,
      .devices {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      dialog[open] { animation: none; }
      iframe { transition: none; }
    }
  `;

  constructor() {
    super();
    this._url = '';
    this._name = '';
    this._device = 'desktop';
    this._loaded = false;
  }

  async open({ url, name }) {
    this._url = url;
    this._name = name;
    this._device = 'desktop';
    this._loaded = false;
    await this.updateComplete;
    const dialog = this.renderRoot.querySelector('dialog');
    if (!dialog.open) dialog.showModal();
  }

  close() {
    this.renderRoot.querySelector('dialog')?.close();
  }

  _onClose() {
    // Descargar el iframe al cerrar: libera memoria y detiene videos o audio.
    this._url = '';
  }

  _onBackdrop(event) {
    if (event.target === event.currentTarget) this.close();
  }

  get _host() {
    try {
      return new URL(this._url).host;
    } catch {
      return this._url;
    }
  }

  render() {
    return html`
      <dialog aria-label="Vista previa de ${this._name}" @close=${this._onClose} @click=${this._onBackdrop}>
        ${this._url
          ? html`
              <div class="bar">
                <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
                <div class="address" title=${this._url}>${this._host}</div>
                <div class="devices" role="group" aria-label="Tamaño de la vista">
                  <button
                    type="button"
                    aria-pressed=${this._device === 'desktop' ? 'true' : 'false'}
                    @click=${() => (this._device = 'desktop')}
                  >
                    Escritorio
                  </button>
                  <button
                    type="button"
                    aria-pressed=${this._device === 'mobile' ? 'true' : 'false'}
                    @click=${() => (this._device = 'mobile')}
                  >
                    Celular
                  </button>
                </div>
                <a class="open" href=${this._url} target="_blank" rel="noopener">Abrir ${icon('arrow-up-right')}</a>
                <button class="close" type="button" aria-label="Cerrar vista previa" @click=${this.close}>${icon('close')}</button>
              </div>
              <div class="stage ${this._device}">
                ${this._loaded
                  ? nothing
                  : html`<div class="loading"><span>Cargando ${this._name}…</span></div>`}
                <iframe
                  src=${this._url}
                  title="Vista previa de ${this._name}"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  referrerpolicy="no-referrer-when-downgrade"
                  @load=${() => (this._loaded = true)}
                ></iframe>
              </div>
              <p class="hint">
                ¿No carga? Algunos sitios no se dejan mostrar dentro de otro.
                <a href=${this._url} target="_blank" rel="noopener">Ábrelo en una pestaña nueva ${icon('arrow-up-right')}</a>
              </p>
            `
          : nothing}
      </dialog>
    `;
  }
}

customElements.define('site-preview', SitePreview);
