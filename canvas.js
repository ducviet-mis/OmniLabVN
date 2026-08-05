/**
 * OMNILAB - CANVAS DRAWING & GEOMETRY ENGINE
 * Handles freehand drawing, highlighter opacity, eraser, shapes, and Oxy coordinate system.
 */

class CanvasEngine {
    constructor() {
        this.canvas = document.getElementById('note-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.viewport = document.getElementById('workspace-viewport');

        this.isDrawing = false;
        this.currentTool = 'pen'; // pen, highlighter, eraser, line, rect, circle, oxy
        this.currentColor = '#0284c7';
        this.currentLineWidth = 4;

        this.startX = 0;
        this.startY = 0;
        this.snapshot = null;

        this.initCanvasSize();
        this.initControls();
        this.initEvents();
    }

    initCanvasSize() {
        const resizeCanvas = () => {
            const tempImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            this.canvas.width = Math.max(this.viewport.scrollWidth, this.viewport.clientWidth);
            this.canvas.height = Math.max(this.viewport.scrollHeight, this.viewport.clientHeight);
            this.ctx.putImageData(tempImage, 0, 0);
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

        this.colorPicker = document.getElementById('canvas-color');
        this.lineWidthSelect = document.getElementById('canvas-line-width');
        this.btnClear = document.getElementById('btn-clear-canvas');

        this.toolButtons = [
            this.btnPen, this.btnHighlighter, this.btnEraser,
            this.btnLine, this.btnRect, this.btnCircle, this.btnOxy
        ];
    }

    initEvents() {
        // Tool Switchers
        this.btnPen.addEventListener('click', () => this.setTool('pen', this.btnPen));
        this.btnHighlighter.addEventListener('click', () => this.setTool('highlighter', this.btnHighlighter));
        this.btnEraser.addEventListener('click', () => this.setTool('eraser', this.btnEraser));

        this.btnLine.addEventListener('click', () => this.setTool('line', this.btnLine));
        this.btnRect.addEventListener('click', () => this.setTool('rect', this.btnRect));
        this.btnCircle.addEventListener('click', () => this.setTool('circle', this.btnCircle));
        this.btnOxy.addEventListener('click', () => this.setTool('oxy', this.btnOxy));

        this.colorPicker.addEventListener('input', (e) => this.currentColor = e.target.value);
        this.lineWidthSelect.addEventListener('change', (e) => this.currentLineWidth = parseInt(e.target.value));
        this.btnClear.addEventListener('click', () => this.clearCanvas());

        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
    }

    setTool(toolName, targetBtn) {
        this.currentTool = toolName;
        this.toolButtons.forEach(btn => btn.classList.remove('active'));
        targetBtn.classList.add('active');
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getPointerPos(e);
        this.startX = pos.x;
        this.startY = pos.y;

        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);

        // Save Canvas State for Shapes Preview
        this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getPointerPos(e);

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

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.ctx.beginPath();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
            this.clearCanvas();
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
    }
}

// Global Export Canvas Engine Instance
window.canvasEngine = new CanvasEngine();
