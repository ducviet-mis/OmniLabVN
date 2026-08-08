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

        if (!viewport || !panel) return;

        const fileId = new URLSearchParams(window.location.search).get('fileId') || 'new-note';
        const storageKey = `omnilab_paper_${fileId}`;
        let settings = { ...defaults };

        try {
            const saved = JSON.parse(localStorage.getItem(storageKey));
            if (saved && typeof saved === 'object') settings = { ...defaults, ...saved };
        } catch (_) { /* Dùng mặc định nếu lỗi */ }

        // Tính toán style nền dựa trên lựa chọn
        const backgroundFor = ({ paper, line, density }) => {
            const size = `${density}px ${density}px`;
            if (paper === 'blank') {
                return { image: 'none', size: 'auto' };
            }
            if (paper === 'ruled') {
                return { 
                    image: `repeating-linear-gradient(to bottom, transparent 0 ${density - 1}px, ${line} ${density}px ${density + 1}px)`, 
                    size: '100% 100%' 
                };
            }
            if (paper === 'dots') {
                return { 
                    image: `radial-gradient(${line} 1.2px, transparent 1.6px)`, 
                    size 
                };
            }
            // Ô ly (grid)
            return { 
                image: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, 
                size 
            };
        };

        const apply = ({ persist = true } = {}) => {
            const paperBackground = backgroundFor(settings);
            
            // Ép buộc ghi đè CSS mặc định bằng setProperty với priority 'important'
            viewport.style.setProperty('background-color', settings.background, 'important');
            viewport.style.setProperty('background-image', paperBackground.image, 'important');
            viewport.style.setProperty('background-size', paperBackground.size, 'important');

            if (bgInput) bgInput.value = settings.background;
            if (lineInput) lineInput.value = settings.line;
            if (densityInput) densityInput.value = settings.density;
            if (densityValue) densityValue.textContent = `${settings.density} px`;

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
            if (toggle) {
                toggle.classList.toggle('active', open);
                toggle.setAttribute('aria-expanded', String(open));
            }
        };

        // Gắn sự kiện chuyển đổi kiểu giấy
        presets.forEach((button) => {
            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                settings.paper = button.dataset.paper;
                apply();
            };
        });

        // Gắn sự kiện chọn màu & khoảng cách
        if (bgInput) bgInput.oninput = () => { settings.background = bgInput.value; apply(); };
        if (lineInput) lineInput.oninput = () => { settings.line = lineInput.value; apply(); };
        if (densityInput) densityInput.oninput = () => { settings.density = Number(densityInput.value); apply(); };

        // Xử lý bật/tắt bảng
        if (toggle) {
            toggle.onclick = (event) => {
                event.stopPropagation();
                event.preventDefault();
                setPanel(panel.classList.contains('hidden'));
            };
        }

        if (close) {
            close.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                setPanel(false);
            };
        }

        panel.onclick = (event) => event.stopPropagation();

        document.onclick = (event) => {
            if (!panel.classList.contains('hidden')) setPanel(false);
        };

        document.onkeydown = (event) => {
            if (event.key === 'Escape' && !panel.classList.contains('hidden')) setPanel(false);
        };

        // Áp dụng ngay khi nạp trang
        apply({ persist: false });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
