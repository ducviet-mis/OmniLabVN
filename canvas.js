/**
 * OMNILAB - CANVAS DRAWING & GEOMETRY ENGINE
 * Handles freehand drawing, highlighter opacity, eraser, shapes, the Oxy
 * coordinate system, function-graph plotting, touch input, and undo/redo.
 */

class CanvasEngine {
    constructor() {
        this.canvas = document.getElementById('note-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.viewport = document.getElementById('workspace-viewport');

        this.isDrawing = false;
        this.currentTool = 'pen'; // pen, highlighter, eraser, line, rect, circle, oxy, graph
        this.currentColor = '#0284c7';
        this.currentLineWidth = 4;

        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;

        // Undo / redo history (bounded stack of dataURLs)
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 25;
        this.hasStrokeChange = false;

        this.initCanvasSize();
        this.initControls();
        this.initEvents();
        this.updateHistoryButtons();
    }

    initCanvasSize() {
        const resizeCanvas = () => {
            const tempImage = (this.canvas.width && this.canvas.height)
                ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
                : null;
            this.canvas.width = Math.max(this.viewport.scrollWidth, this.viewport.clientWidth);
            this.canvas.height = Math.max(this.viewport.scrollHeight, this.viewport.clientHeight);
            if (tempImage) this.ctx.putImageData(tempImage, 0, 0);
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Sync with Text Editor Expansion Dynamic Observer
        const resizeObserver = new ResizeObserver(() => resizeCanvas());
        resizeObserver.observe(document.getElementById('text-editor'));
    }

    initControls() {
        this.btnPen = document.getElementById('tool-pen');
        this.btnHighlighter = document.getElementById('tool-highlighter');
        this.btnEraser = document.getElementById('tool-eraser');

        this.btnLine = document.getElementById('tool-line');
        this.btnRect = document.getElementById('tool-rect');
        this.btnCircle = document.getElementById('tool-circle');
        this.btnOxy = document.getElementById('tool-oxy');
        this.btnGraph = document.getElementById('tool-graph');

        this.colorPicker = document.getElementById('canvas-color');
        this.lineWidthSelect = document.getElementById('canvas-line-width');
        this.btnClear = document.getElementById('btn-clear-canvas');
        this.btnUndo = document.getElementById('btn-undo-canvas');
        this.btnRedo = document.getElementById('btn-redo-canvas');

        this.toolButtons = [
            this.btnPen, this.btnHighlighter, this.btnEraser,
            this.btnLine, this.btnRect, this.btnCircle, this.btnOxy, this.btnGraph
        ];
    }

    initEvents() {
        // Tool Switchers (graph tool click is handled by app.js which opens the dialog)
        this.btnPen.addEventListener('click', () => this.setTool('pen', this.btnPen));
        this.btnHighlighter.addEventListener('click', () => this.setTool('highlighter', this.btnHighlighter));
        this.btnEraser.addEventListener('click', () => this.setTool('eraser', this.btnEraser));

        this.btnLine.addEventListener('click', () => this.setTool('line', this.btnLine));
        this.btnRect.addEventListener('click', () => this.setTool('rect', this.btnRect));
        this.btnCircle.addEventListener('click', () => this.setTool('circle', this.btnCircle));
        this.btnOxy.addEventListener('click', () => this.setTool('oxy', this.btnOxy));

        this.colorPicker.addEventListener('input', (e) => this.currentColor = e.target.value);
        this.lineWidthSelect.addEventListener('change', (e) => this.currentLineWidth = parseInt(e.target.value));
        this.btnClear.addEventListener('click', async () => {
            const ok = await window.showConfirm('Toàn bộ nét vẽ trên lớp canvas sẽ bị xóa. Tiếp tục?', 'Xóa nét vẽ');
            if (ok) this.clearCanvas();
        });

        this.btnUndo.addEventListener('click', () => this.undo());
        this.btnRedo.addEventListener('click', () => this.redo());

        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        // Touch Events (tablets / stylus support for hand-drawn notes)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this.startDrawing(t.clientX, t.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this.draw(t.clientX, t.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        }, { passive: false });

        // Keyboard shortcuts for undo/redo while in canvas mode
        document.addEventListener('keydown', (e) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (!ctrl) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && document.body.classList.contains('mode-canvas')) {
                e.preventDefault();
                e.shiftKey ? this.redo() : this.undo();
            } else if (key === 'y' && document.body.classList.contains('mode-canvas')) {
                e.preventDefault();
                this.redo();
            }
        });
    }

    setTool(toolName, targetBtn) {
        this.currentTool = toolName;
        this.toolButtons.forEach(btn => btn.classList.remove('active'));
        targetBtn.classList.add('active');
    }

    getPointerPos(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    startDrawing(clientX, clientY) {
        this.isDrawing = true;
        this.hasStrokeChange = false;
        const pos = this.getPointerPos(clientX, clientY);
        this.startX = pos.x;
        this.startY = pos.y;

        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);

        // Save Canvas State for Shapes Preview + undo checkpoint
        this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.pushHistory(this.snapshot);
    }

    draw(clientX, clientY) {
        if (!this.isDrawing) return;
        const pos = this.getPointerPos(clientX, clientY);
        this.hasStrokeChange = true;

        if (['pen', 'highlighter', 'eraser'].includes(this.currentTool)) {
            this.drawFreehand(pos);
        } else {
            // Restore snapshot to preview geometric shapes smoothly
            this.ctx.putImageData(this.snapshot, 0, 0);
            this.drawShapePreview(pos);
        }
    }

    drawFreehand(pos) {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (this.currentTool === 'pen') {
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.currentLineWidth;
        } else if (this.currentTool === 'highlighter') {
            this.ctx.globalCompositeOperation = 'source-over';
            // Convert Hex Color to RGBA with 0.4 Alpha Opacity
            const rgba = this.hexToRgba(this.currentColor, 0.4);
            this.ctx.strokeStyle = rgba;
            this.ctx.lineWidth = this.currentLineWidth * 3;
        } else if (this.currentTool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.lineWidth = this.currentLineWidth * 4;
        }

        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
    }

    drawShapePreview(pos) {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentLineWidth;
        this.ctx.lineCap = 'round';

        this.ctx.beginPath();

        if (this.currentTool === 'line') {
            this.ctx.moveTo(this.startX, this.startY);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else if (this.currentTool === 'rect') {
            const width = pos.x - this.startX;
            const height = pos.y - this.startY;
            this.ctx.strokeRect(this.startX, this.startY, width, height);
        } else if (this.currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(pos.x - this.startX, 2) + Math.pow(pos.y - this.startY, 2));
            this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
            this.ctx.stroke();
        } else if (this.currentTool === 'oxy') {
            this.drawOxyCoordinates(pos);
        }
    }

    drawOxyCoordinates(pos) {
        const width = pos.x - this.startX;
        const height = pos.y - this.startY;
        const originX = this.startX;
        const originY = this.startY + height;

        // X-Axis
        this.ctx.moveTo(originX - 20, originY);
        this.ctx.lineTo(originX + Math.max(width, 40), originY);
        // Arrow X
        this.ctx.lineTo(originX + Math.max(width, 40) - 8, originY - 5);
        this.ctx.moveTo(originX + Math.max(width, 40), originY);
        this.ctx.lineTo(originX + Math.max(width, 40) - 8, originY + 5);

        // Y-Axis
        this.ctx.moveTo(originX, originY + 20);
        this.ctx.lineTo(originX, originY - Math.max(Math.abs(height), 40));
        // Arrow Y
        this.ctx.lineTo(originX - 5, originY - Math.max(Math.abs(height), 40) + 8);
        this.ctx.moveTo(originX, originY - Math.max(Math.abs(height), 40));
        this.ctx.lineTo(originX + 5, originY - Math.max(Math.abs(height), 40) + 8);

        this.ctx.stroke();

        // Label Labels O, x, y
        this.ctx.font = '12px Inter';
        this.ctx.fillStyle = this.currentColor;
        this.ctx.fillText('O', originX - 12, originY + 14);
        this.ctx.fillText('x', originX + Math.max(width, 40) + 5, originY + 4);
        this.ctx.fillText('y', originX - 4, originY - Math.max(Math.abs(height), 40) - 8);
    }

    /**
     * Plots y = f(x) centered in the current viewport, using the same Oxy
     * axis convention as drawOxyCoordinates. `evaluate` is the safe
     * expression evaluator from app.js, injected to avoid using eval().
     */
    plotFunction(fnString, evaluate) {
        this.pushHistory(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));

        const viewWidth = this.viewport.clientWidth || this.canvas.width;
        const viewHeight = this.viewport.clientHeight || this.canvas.height;
        const originX = (this.viewport.scrollLeft || 0) + viewWidth / 2;
        const originY = (this.viewport.scrollTop || 0) + viewHeight / 2;

        const rangeX = 200; // math units shown left-right
        const pxPerUnit = Math.min(viewWidth, 480) / (rangeX * 2) * 4;
        const step = 0.5;

        this.ctx.globalCompositeOperation = 'source-over';

        // Axes
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

        // Curve
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentLineWidth;
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();

        let started = false;
        for (let px = -100; px <= 100; px += step) {
            const x = px / 4; // math x value
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
        this.ctx.beginPath();
        if (this.hasStrokeChange && window.scheduleAutosave) window.scheduleAutosave();
    }

    // --- Undo / Redo history -------------------------------------------------
    pushHistory(imageData) {
        try {
            this.undoStack.push(this.canvas.toDataURL());
            if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
            this.redoStack = [];
            this.updateHistoryButtons();
        } catch {
            // toDataURL can throw on tainted canvases; ignore silently
        }
    }

    undo() {
        if (!this.undoStack.length) return;
        const current = this.canvas.toDataURL();
        const prev = this.undoStack.pop();
        this.redoStack.push(current);
        this.restoreFromDataUrl(prev);
        this.updateHistoryButtons();
        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    redo() {
        if (!this.redoStack.length) return;
        const current = this.canvas.toDataURL();
        const next = this.redoStack.pop();
        this.undoStack.push(current);
        this.restoreFromDataUrl(next);
        this.updateHistoryButtons();
        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    restoreFromDataUrl(dataUrl) {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
    }

    updateHistoryButtons() {
        if (this.btnUndo) this.btnUndo.disabled = this.undoStack.length === 0;
        if (this.btnRedo) this.btnRedo.disabled = this.redoStack.length === 0;
        if (this.btnUndo) this.btnUndo.style.opacity = this.undoStack.length ? 1 : 0.4;
        if (this.btnRedo) this.btnRedo.style.opacity = this.redoStack.length ? 1 : 0.4;
    }

    clearCanvas(silent = false) {
        if (!silent) this.pushHistory();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (window.scheduleAutosave && !silent) window.scheduleAutosave();
    }

    hexToRgba(hex, alpha) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(char => char + char).join('');
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
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
    }
}

// Global Export Canvas Engine Instance
window.canvasEngine = new CanvasEngine();
