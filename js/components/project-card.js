import { LitElement, html, css, nothing } from '../vendor/lit-3.3.1.min.js';

/**
 * <project-card name kind url repo stack badge note featured previewable>
 *   <p>Descripción (slot por defecto)</p>
 *   <ul slot="highlights"><li>…</li></ul>
 * </project-card>
 *
 * La tarjeta no abre la vista previa ella misma: emite `preview-open` y la
 * página decide quién la muestra (<site-preview>).
 */
export class ProjectCard extends LitElement {
  static properties = {
    name: { type: String },
    kind: { type: String },
    url: { type: String },
    repo: { type: String },
    stack: { type: String },
    badge: { type: String },
    note: { type: String },
    featured: { type: Boolean, reflect: true },
    previewable: { type: Boolean },
  };

  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    :host {
      display: block;
      --spot-x: 50%;
      --spot-y: 0%;
    }
    :host([hidden]) {
      display: none;
    }
    article {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.6rem;
      border-radius: var(--radius-lg, 20px);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.09));
      background:
        radial-gradient(420px circle at var(--spot-x) var(--spot-y), rgba(110, 231, 168, 0.1), transparent 45%),
        var(--glass, rgba(10, 26, 22, 0.6));
      backdrop-filter: blur(14px) saturate(130%);
      overflow: hidden;
      transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
    }
    article:hover {
      border-color: var(--border-strong, rgba(110, 231, 168, 0.35));
      transform: translateY(-4px);
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
    }
    :host([featured]) article {
      border-color: rgba(110, 231, 168, 0.2);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .kind {
      font: 500 0.72rem/1.3 var(--mono, monospace);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--leaf, #6ee7a8);
    }
    .badge {
      font: 600 0.7rem/1 var(--font, system-ui);
      padding: 0.32rem 0.6rem;
      border-radius: 999px;
      color: var(--sun, #fbbf24);
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.3);
    }
    h3 {
      margin: 0;
      font: 600 1.35rem/1.2 var(--serif, Georgia, serif);
      color: var(--text, #eef6f2);
    }
    /* Tecnologías y botones van al fondo: así se alinean entre tarjetas */
    .stack {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin: auto 0 0;
      padding: 0.2rem 0 0;
      list-style: none;
    }
    .stack li {
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      font: 400 0.7rem/1.4 var(--mono, monospace);
      color: var(--muted, #9fb3ad);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.09));
    }
    .note {
      margin: 0;
      font-size: 0.75rem;
      color: var(--dim, #6f857e);
    }
    footer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.4rem;
    }
    .action {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.9rem;
      border-radius: 10px;
      font: 600 0.8rem/1 var(--font, system-ui);
      text-decoration: none;
      cursor: pointer;
      transition: background 0.25s, color 0.25s, border-color 0.25s;
    }
    .primary {
      border: 1px solid transparent;
      background: var(--grad, linear-gradient(135deg, #60a5fa, #34d399));
      color: #04130e;
    }
    .primary:hover {
      filter: brightness(1.1);
    }
    .ghost {
      border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
      background: transparent;
      color: var(--text, #eef6f2);
    }
    .ghost:hover {
      border-color: var(--leaf, #6ee7a8);
      color: var(--leaf, #6ee7a8);
    }
    .action:focus-visible {
      outline: 2px solid var(--leaf, #6ee7a8);
      outline-offset: 3px;
    }
    @media (prefers-reduced-motion: reduce) {
      article,
      article:hover {
        transition: none;
        transform: none;
      }
    }
  `;

  get _stackList() {
    return (this.stack || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  _trackSpot(event) {
    const box = event.currentTarget.getBoundingClientRect();
    this.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
    this.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
  }

  _openPreview() {
    this.dispatchEvent(
      new CustomEvent('preview-open', {
        detail: { url: this.url, name: this.name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <article @pointermove=${this._trackSpot}>
        <header>
          <span class="kind">${this.kind}</span>
          ${this.badge ? html`<span class="badge">${this.badge}</span>` : nothing}
        </header>
        <h3>${this.name}</h3>
        <div class="desc"><slot></slot></div>
        <slot name="highlights"></slot>
        <ul class="stack" aria-label="Tecnologías">
          ${this._stackList.map((item) => html`<li>${item}</li>`)}
        </ul>
        ${this.note ? html`<p class="note">${this.note}</p>` : nothing}
        ${this.url || this.repo
          ? html`
              <footer>
                ${this.url && this.previewable
                  ? html`<button class="action primary" type="button" @click=${this._openPreview}>
                      Vista previa
                    </button>`
                  : nothing}
                ${this.url
                  ? html`<a class="action ghost" href=${this.url} target="_blank" rel="noopener">Visitar ↗</a>`
                  : nothing}
                ${this.repo
                  ? html`<a class="action ghost" href=${this.repo} target="_blank" rel="noopener">Código ↗</a>`
                  : nothing}
              </footer>
            `
          : nothing}
      </article>
    `;
  }
}

customElements.define('project-card', ProjectCard);
