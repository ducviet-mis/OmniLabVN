/* Paper appearance settings for the note workspace. */
(() => {
    const defaults = { paper: 'grid', background: '#fffdf7', line: '#efb8b8', density: 28 };

    const init = () => {
        const viewport = document.getElementById('workspace-viewport');
        const toggle = document.getElementById('btn-paper-settings');
        const panel = document.getElementById('paper-settings-panel');
        const close = document.getElementById('btn-close-paper-settings');
        const bgInput = document.getElementById('paper-bg-color');
        const lineInput = document.getElementById('paper-line-color');
        const densityInput = document.getElementById('paper-density');
        const densityValue = document.getElementById('paper-density-value');
        const presets = Array.from(document.querySelectorAll('.paper-preset'));
        if (!viewport || !toggle || !panel || !bgInput || !lineInput || !densityInput) return;

        const fileId = new URLSearchParams(window.location.search).get('fileId') || 'new-note';
        const storageKey = `omnilab_paper_${fileId}`;
        let settings = { ...defaults };

        try {
            const saved = JSON.parse(localStorage.getItem(storageKey));
            if (saved && typeof saved === 'object') settings = { ...defaults, ...saved };
        } catch (_) { /* Use defaults when a saved value is unavailable. */ }

        const backgroundFor = ({ paper, line, density }) => {
            const size = `${density}px ${density}px`;
            if (paper === 'blank') return { image: 'none', size };
            if (paper === 'ruled') return { image: `repeating-linear-gradient(to bottom, transparent 0 ${density - 1}px, ${line} ${density}px ${density + 1}px)`, size: '100% 100%' };
            if (paper === 'dots') return { image: `radial-gradient(${line} 1px, transparent 1.6px)`, size };
            return { image: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, size };
        };

        const apply = ({ persist = true } = {}) => {
            const paperBackground = backgroundFor(settings);
            viewport.style.backgroundColor = settings.background;
            viewport.style.backgroundImage = paperBackground.image;
            viewport.style.backgroundSize = paperBackground.size;
            bgInput.value = settings.background;
            lineInput.value = settings.line;
            densityInput.value = settings.density;
            densityValue.textContent = `${settings.density} px`;
            presets.forEach((button) => {
                const selected = button.dataset.paper === settings.paper;
                button.classList.toggle('active', selected);
                button.setAttribute('aria-pressed', String(selected));
            });
            if (persist) {
                localStorage.setItem(storageKey, JSON.stringify(settings));
                if (typeof window.scheduleAutosave === 'function') window.scheduleAutosave();
            }
        };

        const setPanel = (open) => {
            panel.classList.toggle('hidden', !open);
            toggle.classList.toggle('active', open);
            toggle.setAttribute('aria-expanded', String(open));
        };

        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            setPanel(panel.classList.contains('hidden'));
        });
        close?.addEventListener('click', () => setPanel(false));
        presets.forEach((button) => button.addEventListener('click', () => {
            settings.paper = button.dataset.paper;
            apply();
        }));
        bgInput.addEventListener('input', () => { settings.background = bgInput.value; apply(); });
        lineInput.addEventListener('input', () => { settings.line = lineInput.value; apply(); });
        densityInput.addEventListener('input', () => { settings.density = Number(densityInput.value); apply(); });
        document.addEventListener('click', (event) => {
            if (!panel.classList.contains('hidden') && !panel.contains(event.target) && event.target !== toggle) setPanel(false);
        });

        apply({ persist: false });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
