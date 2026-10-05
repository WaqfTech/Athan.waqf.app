// Credits and acknowledgments modal overlay

import { Translations } from '../i18n/translations';
import { i18n } from '../i18n/manager';

export interface CreditsModal {
  element: HTMLElement;
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  updateTranslations: (translations: Translations) => void;
  dispose: () => void;
}

export function createCreditsModal(options: {
  onOpen?: () => void;
  onClose?: () => void;
}): CreditsModal {
  let openState = false;
  let t = i18n.getTranslations();

  const container = document.createElement('div');
  container.className = 'credits-modal-container';
  container.setAttribute('aria-hidden', 'true');

  const backdrop = document.createElement('div');
  backdrop.className = 'credits-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'credits-dialog hud-panel';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'credits-dialog-title');

  function renderDialog(): void {
    dialog.innerHTML = `
      <div class="credits-header">
        <div class="credits-header-title">
          <svg class="credits-title-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <h2 id="credits-dialog-title" class="credits-title">${t.credits.title}</h2>
        </div>
        <button type="button" class="btn-icon-toggle credits-close-btn" aria-label="${t.credits.close}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="credits-body">
        <!-- 1. Special Contributor Section -->
        <section class="credits-section" aria-labelledby="credits-ack-heading">
          <div class="credits-section-label" id="credits-ack-heading">${t.credits.acknowledgments}</div>
          <div class="contributor-card">
            <div class="contributor-header">
              <div class="contributor-avatar" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div class="contributor-names">
                <div class="contributor-primary-name">${t.credits.contributorName}</div>
                <div class="contributor-arabic-name" dir="rtl">${t.credits.contributorArabicName}</div>
                <div class="contributor-handle">${t.credits.contributorHandle}</div>
              </div>
            </div>

            <p class="contributor-role">${t.credits.contributorRole}</p>

            <div class="contributor-links">
              <a href="https://x.com/theIslampill" target="_blank" rel="noopener noreferrer" class="credits-link-pill" aria-label="Muddaththir on X">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>theIslampill</span>
              </a>

              <a href="https://github.com/theIslampill" target="_blank" rel="noopener noreferrer" class="credits-link-pill" aria-label="Muddaththir on GitHub">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </section>

        <div class="credits-divider" role="separator" aria-hidden="true"></div>

        <!-- 2. Organization & License Section -->
        <section class="credits-section" aria-labelledby="credits-project-heading">
          <div class="credits-section-label" id="credits-project-heading">${t.credits.projectBy}</div>
          <div class="credits-org-card">
            <p class="credits-org-desc">${t.credits.waqfDescription}</p>
            <div class="credits-links">
              <a href="https://waqftech.org" target="_blank" rel="noopener noreferrer" class="credits-link-pill primary" aria-label="WaqfTech.org website">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>WaqfTech.org</span>
              </a>

              <a href="https://github.com/WaqfTech/waqf-license-draft-" target="_blank" rel="noopener noreferrer" class="credits-link-pill" aria-label="Waqf Digital Public License on GitHub">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>${t.credits.licenseTitle}</span>
              </a>
            </div>
          </div>
        </section>

        <div class="credits-divider" role="separator" aria-hidden="true"></div>

        <!-- 3. Technical Stack Section -->
        <section class="credits-section" aria-labelledby="credits-stack-heading">
          <div class="credits-section-label" id="credits-stack-heading">${t.credits.stackTitle}</div>
          <div class="credits-stack-list">
            <div class="credits-stack-item">
              <div class="credits-stack-bullet" aria-hidden="true">
                <span class="stack-bullet-dot"></span>
              </div>
              <div class="credits-stack-text">${t.credits.stack3d}</div>
            </div>

            <div class="credits-stack-item">
              <div class="credits-stack-bullet" aria-hidden="true">
                <span class="stack-bullet-dot"></span>
              </div>
              <div class="credits-stack-text">${t.credits.stackAstronomy}</div>
            </div>

            <div class="credits-stack-item">
              <div class="credits-stack-bullet" aria-hidden="true">
                <span class="stack-bullet-dot"></span>
              </div>
              <div class="credits-stack-text">${t.credits.stackEdge}</div>
            </div>
          </div>
        </section>
      </div>

      <div class="credits-footer">
        <button type="button" class="btn-dock-pill credits-footer-close">${t.credits.close}</button>
      </div>
    `;

    const closeBtn = dialog.querySelector('.credits-close-btn') as HTMLButtonElement | null;
    const footerCloseBtn = dialog.querySelector('.credits-footer-close') as HTMLButtonElement | null;

    closeBtn?.addEventListener('click', () => close());
    footerCloseBtn?.addEventListener('click', () => close());
  }

  renderDialog();
  container.appendChild(backdrop);
  container.appendChild(dialog);

  function syncUrl(open: boolean): void {
    if (typeof window === 'undefined') return;

    const loc = i18n.getLocale();
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.delete('lang');
    const query = currentParams.toString();
    const queryString = query ? `?${query}` : '';

    if (open) {
      const creditsPath = loc === 'en' ? '/credits' : `/${loc}/credits`;
      if (window.location.pathname !== creditsPath) {
        window.history.pushState({ modal: 'credits' }, '', `${creditsPath}${queryString}`);
      }
    } else {
      const basePath = loc === 'en' ? '/' : `/${loc}`;
      if (window.location.pathname.endsWith('/credits')) {
        window.history.pushState(null, '', `${basePath}${queryString}`);
      }
    }
  }

  function open(): void {
    if (openState) return;
    openState = true;
    container.classList.add('active');
    container.setAttribute('aria-hidden', 'false');
    syncUrl(true);
    if (options.onOpen) options.onOpen();

    // Focus close button for accessibility
    requestAnimationFrame(() => {
      const closeBtn = dialog.querySelector('.credits-close-btn') as HTMLElement | null;
      closeBtn?.focus();
    });
  }

  function close(): void {
    if (!openState) return;
    openState = false;
    container.classList.remove('active');
    container.setAttribute('aria-hidden', 'true');
    syncUrl(false);
    if (options.onClose) options.onClose();
  }

  function toggle(): void {
    if (openState) close();
    else open();
  }

  function isOpen(): boolean {
    return openState;
  }

  function updateTranslations(newTranslations: Translations): void {
    t = newTranslations;
    renderDialog();
  }

  backdrop.addEventListener('click', () => close());

  function onPopState(): void {
    if (typeof window === 'undefined') return;
    const isCreditsPath = window.location.pathname === '/credits' || window.location.pathname.endsWith('/credits');
    if (isCreditsPath && !openState) {
      open();
    } else if (!isCreditsPath && openState) {
      close();
    }
  }

  window.addEventListener('popstate', onPopState);

  function dispose(): void {
    window.removeEventListener('popstate', onPopState);
    container.remove();
  }

  return {
    element: container,
    open,
    close,
    toggle,
    isOpen,
    updateTranslations,
    dispose,
  };
}
