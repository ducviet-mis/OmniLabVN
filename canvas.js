/**
 * OMNILAB - DRAWING ENGINE (SUB-MENU SHAPES & CORRECTED MAPPINGS)
 */

class DrawEngine {
    constructor(opts) {
        this.canvas = opts.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.viewport = opts.viewport || null;
        this.autoResize = !!opts.autoResize;
        this.dockEl = opts.dockEl;
        this.onStrokeEnd = opts.onStrokeEnd || (() => { if (window.scheduleAutosave) window.scheduleAutosave(); });

        this.isDrawing = false;
        this.currentTool = 'pen';
        this.points = [];
        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;

        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 25;
        this.hasStrokeChange = false;

        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.touchAction = 'none';

        this.cursorDot = document.createElement('div');
        this.cursorDot.className = 'pen-cursor-dot';
        document.body.appendChild(this.cursorDot);

        this.initControls();
        if (this.autoResize) this.initCanvasAutoResize();
        this.initDockEvents();
        this.initToolEvents();
        this.initDrawEvents();
        this.updateHistoryButtons();
    }

    initControls() {
        this.fab = this.dockEl.querySelector('.pen-fab');
        this.popover = this.dockEl.querySelector('.pen-popover');
        this.toolButtons = Array.from(this.dockEl.querySelectorAll('[data-tool]'));
        this.colorInput = this.dockEl.querySelector('.pen-color');
        this.widthSelect = this.dockEl.querySelector('.pen-width');
        this.undoBtn = this.dockEl.querySelector('.pen-undo');
        this.redoBtn = this.dockEl.querySelector('.pen-redo');
        this.clearBtn = this.dockEl.querySelector('.pen-clear');
        this.shapeToggleBtn = this.dockEl.querySelector('.btn-shape-toggle');
        this.shapeWrapper = this.dockEl.querySelector('.shape-dropdown-wrapper');

        this.currentColor = this.colorInput ? this.colorInput.value : '#0284c7';
        this.currentLineWidth = this.widthSelect ? parseInt(this.widthSelect.value, 10) : 4;
    }

    initCanvasAutoResize() {
        const resize = () => {
            const tempImage = this.safeGetImage();
            this.canvas.width = Math.max(this.viewport.scrollWidth, this.viewport.clientWidth);
            this.canvas.height = Math.max(this.viewport.scrollHeight, this.viewport.clientHeight);
            if (tempImage) this.ctx.putImageData(tempImage, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);
        const resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(this.viewport);
    }

    safeGetImage() {
        if (!this.canvas.width || !this.canvas.height) return null;
        try {
            return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        } catch {
            return null;
        }
    }

    resizeTo(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    initDockEvents() {
        this.fab.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setOpen(!this.isOpen());
        });

        document.addEventListener('pointerdown', (e) => {
            if (!this.isOpen()) return;
            if (this.dockEl.contains(e.target) || e.target === this.canvas || this.canvas.contains(e.target)) return;
            this.setOpen(false);
        });

        document.addEventListener('keydown', (e) => {
            if (!this.isOpen()) return;
            if (e.key === 'Escape') { this.setOpen(false); return; }
            const ctrl = e.ctrlKey || e.metaKey;
            if (!ctrl) return;
            const key = e.key.toLowerCase();
            if (key === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
            else if (key === 'y') { e.preventDefault(); this.redo(); }
        });
    }

    isOpen() {
        return this.dockEl.classList.contains('open');
    }

    setOpen(open) {
        this.dockEl.classList.toggle('open', open);
        this.canvas.style.pointerEvents = open ? 'auto' : 'none';
        this.canvas.classList.toggle('drawing-active', open);
        if (!open) {
            this.cursorDot.style.display = 'none';
            if (this.shapeWrapper) this.shapeWrapper.classList.remove('open');
        }
    }

    initToolEvents() {
        // Toggle Submenu chọn hình học
        if (this.shapeToggleBtn && this.shapeWrapper) {
            this.shapeToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shapeWrapper.classList.toggle('open');
            });
        }

        this.toolButtons.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const tool = btn.dataset.tool;
                if (tool === 'graph') {
                    if (window.onGraphToolClick) window.onGraphToolClick(this);
                    return;
                }

                this.currentTool = tool;

                // Cập nhật trạng thái active cho nút
                this.toolButtons.forEach((b) => b.classList.remove('active'));
                if (this.shapeToggleBtn) this.shapeToggleBtn.classList.remove('active');

                // Nếu chọn hình nằm trong Submenu, đổi Icon nút chính và Active nút Submenu
                if (btn.closest('.shape-submenu')) {
                    if (this.shapeToggleBtn) {
                        this.shapeToggleBtn.classList.add('active');
                        const iconInside = btn.querySelector('i');
                        if (iconInside) {
                            this.shapeToggleBtn.innerHTML = iconInside.outerHTML;
                        }
                    }
                    if (this.shapeWrapper) this.shapeWrapper.classList.remove('open');
                } else {
                    btn.classList.add('active');
                    if (this.shapeWrapper) this.shapeWrapper.classList.remove('open');
                }
            });
        });

        if (this.colorInput) {
            this.colorInput.addEventListener('input', (e) => { this.currentColor = e.target.value; });
        }
        if (this.widthSelect) {
            this.widthSelect.addEventListener('change', (e) => { this.currentLineWidth = parseInt(e.target.value, 10); });
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', async () => {
                const ok = await window.showConfirm('Toàn bộ nét vẽ trên lớp này sẽ bị xóa. Tiếp tục?', 'Xóa nét vẽ');
                if (ok) this.clearCanvas();
            });
        }
        if (this.undoBtn) this.undoBtn.addEventListener('click', () => this.undo());
        if (this.redoBtn) this.redoBtn.addEventListener('click', () => this.redo());
    }

    initDrawEvents() {
        this.canvas.addEventListener('pointerdown', (e) => {
            if (!this.isOpen()) return;
            e.preventDefault();
            try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
            this.startDrawing(e);
        });

        this.canvas.addEventListener('pointermove', (e) => {
            this.updateCursorDot(e);
            if (!this.isOpen()) return;
            if (this.isDrawing) e.preventDefault();
            this.draw(e);
        });

        this.canvas.addEventListener('pointerup', () => this.stopDrawing());
        this.canvas.addEventListener('pointercancel', () => this.stopDrawing());
        this.canvas.addEventListener('pointerleave', () => { this.cursorDot.style.display = 'none'; });
        this.canvas.addEventListener('pointerenter', () => { if (this.isOpen()) this.cursorDot.style.display = 'block'; });
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure > 0 && e.pointerType !== 'mouse' ? e.pressure : 1
        };
    }

    updateCursorDot(e) {
        if (!this.isOpen()) return;
        this.cursorDot.style.display = 'block';
        this.cursorDot.style.left = `${e.clientX}px`;
        this.cursorDot.style.top = `${e.clientY}px`;

        let size = this.currentLineWidth;
        let bg = this.currentColor;
        let border = 'rgba(255, 255, 255, 0.9)';

        if (this.currentTool === 'highlighter') {
            size = this.currentLineWidth * 3;
            bg = this.hexToRgba(this.currentColor, 0.45);
        } else if (this.currentTool === 'eraser') {
            size = this.currentLineWidth * 4;
            bg = 'rgba(148, 163, 184, 0.15)';
            border = 'var(--text-muted)';
        } else if (this.currentTool !== 'pen') {
            size = 10;
        }

        size = Math.max(size, 6);
        this.cursorDot.style.width = `${size}px`;
        this.cursorDot.style.height = `${size}px`;
        this.cursorDot.style.background = bg;
        this.cursorDot.style.borderColor = border;
    }

    startDrawing(e) {
        this.isDrawing = true;
        this.hasStrokeChange = false;
        const pos = this.getPointerPos(e);
        this.points = [pos];
        this.startX = pos.x;
        this.startY = pos.y;

        this.snapshot = this.safeGetImage();
        this.pushHistory();

        this.applyStrokeStyle(pos);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.ctx.lineTo(pos.x + 0.01, pos.y + 0.01);
        this.ctx.stroke();
    }

    applyStrokeStyle(pos) {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        const pressureScale = 0.55 + (pos.pressure || 1) * 0.6;

        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentLineWidth * pressureScale;
        } else if (this.currentTool === 'highlighter') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.hexToRgba(this.currentColor, 0.4);
            this.ctx.lineWidth = this.currentLineWidth * 3;
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.currentLineWidth * 4;
        }
    }

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getPointerPos(e);
        this.hasStrokeChange = true;

        if (['pen', 'highlighter', 'eraser'].includes(this.currentTool)) {
            this.drawSmoothFreehand(pos);
        } else {
            if (this.snapshot) this.ctx.putImageData(this.snapshot, 0, 0);
            this.drawShapePreview(pos);
        }
    }

    drawSmoothFreehand(pos) {
        this.points.push(pos);
        const len = this.points.length;
        this.applyStrokeStyle(pos);

        if (len < 3) {
            const [p0, p1] = this.points;
            this.ctx.beginPath();
            this.ctx.moveTo(p0.x, p0.y);
            this.ctx.lineTo(p1.x, p1.y);
            this.ctx.stroke();
            return;
        }

        const p0 = this.points[len - 3];
        const p1 = this.points[len - 2];
        const p2 = this.points[len - 1];
        const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        this.ctx.beginPath();
        this.ctx.moveTo(mid1.x, mid1.y);
        this.ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
        this.ctx.stroke();
    }

    drawShapePreview(pos) {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentLineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();

        const x = this.startX;
        const y = this.startY;
        const w = pos.x - this.startX;
        const h = pos.y - this.startY;

        switch (this.currentTool) {
            case 'line':
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
                break;

            case 'arrow':
                this.drawArrow(x, y, pos.x, pos.y);
                break;

            case 'rect':
                this.ctx.strokeRect(x, y, w, h);
                break;

            case 'circle':
                const radius = Math.sqrt(w * w + h * h);
                this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;

            case 'ellipse':
                this.ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;

            case 'triangle':
                this.ctx.moveTo(x + w / 2, y);
                this.ctx.lineTo(x + w, y + h);
                this.ctx.lineTo(x, y + h);
                this.ctx.closePath();
                this.ctx.stroke();
                break;

            case 'right-triangle':
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x, y + h);
                this.ctx.lineTo(x + w, y + h);
                this.ctx.closePath();
                this.ctx.stroke();
                break;

            case 'rhombus':
                this.ctx.moveTo(x + w / 2, y);
                this.ctx.lineTo(x + w, y + h / 2);
                this.ctx.lineTo(x + w / 2, y + h);
                this.ctx.lineTo(x, y + h / 2);
                this.ctx.closePath();
                this.ctx.stroke();
                break;

            case 'parallelogram':
                const offset = w * 0.25;
                this.ctx.moveTo(x + offset, y);
                this.ctx.lineTo(x + w, y);
                this.ctx.lineTo(x + w - offset, y + h);
                this.ctx.lineTo(x, y + h);
                this.ctx.closePath();
                this.ctx.stroke();
                break;

            case 'trapezoid':
                const topOffset = w * 0.2;
                this.ctx.moveTo(x + topOffset, y);
                this.ctx.lineTo(x + w - topOffset, y);
                this.ctx.lineTo(x + w, y + h);
                this.ctx.lineTo(x, y + h);
                this.ctx.closePath();
                this.ctx.stroke();
                break;

            case 'star':
                this.drawStar(x + w / 2, y + h / 2, 5, Math.abs(w / 2), Math.abs(w / 4));
                break;

            case 'oxy':
                this.drawOxyCoordinates(pos);
                break;
        }
    }

    drawArrow(fromx, fromy, tox, toy) {
        const headlen = Math.max(12, this.currentLineWidth * 3);
        const dx = tox - fromx;
        const dy = toy - fromy;
        const angle = Math.atan2(dy, dx);

        this.ctx.moveTo(fromx, fromy);
        this.ctx.lineTo(tox, toy);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(tox, toy);
        this.ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(tox, toy);
        this.ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let step = Math.PI / spikes;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            let x = cx + Math.cos(rot) * outerRadius;
            let y = cy + Math.sin(rot) * outerRadius;
            this.ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
        }
        this.ctx.lineTo(cx, cy - outerRadius);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    drawOxyCoordinates(pos) {
        const width = pos.x - this.startX;
        const height = pos.y - this.startY;
        const originX = this.startX;
        const originY = this.startY + height;

        // X-Axis
        this.ctx.moveTo(originX - 20, originY);
        this.ctx.lineTo(originX + Math.max(width, 40), originY);
        this.ctx.lineTo(originX + Math.max(width, 40) - 8, originY - 5);
        this.ctx.moveTo(originX + Math.max(width, 40), originY);
        this.ctx.lineTo(originX + Math.max(width, 40) - 8, originY + 5);

        // Y-Axis
        this.ctx.moveTo(originX, originY + 20);
        this.ctx.lineTo(originX, originY - Math.max(Math.abs(height), 40));
        this.ctx.lineTo(originX - 5, originY - Math.max(Math.abs(height), 40) + 8);
        this.ctx.moveTo(originX, originY - Math.max(Math.abs(height), 40));
        this.ctx.lineTo(originX + 5, originY - Math.max(Math.abs(height), 40) + 8);

        this.ctx.stroke();

        this.ctx.font = '12px Inter';
        this.ctx.fillStyle = this.currentColor;
        this.ctx.fillText('O', originX - 12, originY + 14);
        this.ctx.fillText('x', originX + Math.max(width, 40) + 5, originY + 4);
        this.ctx.fillText('y', originX - 4, originY - Math.max(Math.abs(height), 40) - 8);
    }

    plotFunction(fnString, evaluate) {
        this.pushHistory();

        const viewWidth = (this.viewport && this.viewport.clientWidth) || this.canvas.width;
        const viewHeight = (this.viewport && this.viewport.clientHeight) || this.canvas.height;
        const originX = ((this.viewport && this.viewport.scrollLeft) || 0) + viewWidth / 2;
        const originY = ((this.viewport && this.viewport.scrollTop) || 0) + viewHeight / 2;

        const rangeX = 200;
        const pxPerUnit = Math.min(viewWidth, 480) / (rangeX * 2) * 4;
        const step = 0.5;

        this.ctx.globalCompositeOperation = 'source-over';

        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(originX - rangeX * pxPerUnit / 4, originY);
        this.ctx.lineTo(originX + rangeX * pxPerUnit / 4, originY);
        this.ctx.moveTo(originX, originY - 160);
        this.ctx.lineTo(originX, originY + 160);
        this.ctx.stroke();
        this.ctx.font = '12px Inter';
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.fillText('O', originX - 14, originY + 14);

        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentLineWidth;
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();

        let started = false;
        for (let px = -100; px <= 100; px += step) {
            const x = px / 4;
            let y;
            try {
                y = evaluate(fnString.replace(/x/g, `(${x})`));
            } catch {
                started = false;
                continue;
            }
            if (!Number.isFinite(y) || Math.abs(y) > 200) { started = false; continue; }

            const canvasX = originX + px * (pxPerUnit / 4) * 4;
            const canvasY = originY - y * (pxPerUnit / 4) * 4;

            if (!started) { this.ctx.moveTo(canvasX, canvasY); started = true; }
            else this.ctx.lineTo(canvasX, canvasY);
        }
        this.ctx.stroke();
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.points = [];
        this.ctx.beginPath();
        if (this.hasStrokeChange) this.onStrokeEnd();
    }

    pushHistory() {
        try {
            this.undoStack.push(this.canvas.toDataURL());
            if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
            this.redoStack = [];
            this.updateHistoryButtons();
        } catch {}
    }

    undo() {
        if (!this.undoStack.length) return;
        const current = this.canvas.toDataURL();
        const prev = this.undoStack.pop();
        this.redoStack.push(current);
        this.restoreFromDataUrl(prev);
        this.updateHistoryButtons();
        this.onStrokeEnd();
    }

    redo() {
        if (!this.redoStack.length) return;
        const current = this.canvas.toDataURL();
        const next = this.redoStack.pop();
        this.undoStack.push(current);
        this.restoreFromDataUrl(next);
        this.updateHistoryButtons();
        this.onStrokeEnd();
    }

    restoreFromDataUrl(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };
        img.src = dataUrl;
    }

    updateHistoryButtons() {
        if (this.undoBtn) {
            this.undoBtn.disabled = this.undoStack.length === 0;
            this.undoBtn.style.opacity = this.undoStack.length ? 1 : 0.4;
        }
        if (this.redoBtn) {
            this.redoBtn.disabled = this.redoStack.length === 0;
            this.redoBtn.style.opacity = this.redoStack.length ? 1 : 0.4;
        }
    }

    clearCanvas(silent = false) {
        if (!silent) this.pushHistory();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!silent) this.onStrokeEnd();
    }

    hexToRgba(hex, alpha) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map((char) => char + char).join('');
        const num = parseInt(c, 16);
        return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
    }

    getCanvasData() {
        return this.canvas.toDataURL();
    }

    loadCanvasData(dataUrl) {
        if (!dataUrl) return;
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };
        img.src = dataUrl;
    }
}

// Global Engine Instances
window.canvasEngine = new DrawEngine({
    canvas: document.getElementById('note-canvas'),
    viewport: document.getElementById('workspace-viewport'),
    dockEl: document.getElementById('pen-dock-note'),
    autoResize: true
});

window.pdfDrawEngine = new DrawEngine({
    canvas: document.getElementById('pdf-draw-canvas'),
    viewport: null,
    dockEl: document.getElementById('pen-dock-pdf'),
    autoResize: false,
    onStrokeEnd: () => { if (window.onPdfDrawStrokeEnd) window.onPdfDrawStrokeEnd(); }
});
