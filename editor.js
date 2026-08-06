/**
 * OMNILAB - RICH TEXT EDITOR ENGINE
 * Fully manages formatting, font selection, alignments, lists, line height,
 * keyboard shortcuts, undo/redo, and a quick scientific-symbol palette.
 * (Fixed selection loss and pixel font-size formatting issues)
 */

class RichTextEditor {
    constructor() {
        this.editor = document.getElementById('text-editor');
        this.savedRange = null;

        this.initControls();
        this.initSelectionTracker();
        this.initEvents();
        this.initSymbolPalette();
    }

    initControls() {
        this.fontFamilySelect = document.getElementById('font-family');
        this.fontSizeSelect = document.getElementById('font-size');
        this.btnBold = document.getElementById('btn-bold');
        this.btnItalic = document.getElementById('btn-italic');
        this.btnUnderline = document.getElementById('btn-underline');
        this.btnStrikethrough = document.getElementById('btn-strikethrough');

        this.btnAlignLeft = document.getElementById('btn-align-left');
        this.btnAlignCenter = document.getElementById('btn-align-center');
        this.btnAlignRight = document.getElementById('btn-align-right');
        this.btnAlignJustify = document.getElementById('btn-align-justify');

        this.textColorInput = document.getElementById('text-color');
        this.textBgColorInput = document.getElementById('text-bg-color');

        this.btnBulletList = document.getElementById('btn-bullet-list');
        this.btnNumberList = document.getElementById('btn-number-list');
        this.btnFormula = document.getElementById('btn-formula');
        this.lineHeightSelect = document.getElementById('line-height');

        this.btnUndo = document.getElementById('btn-undo-text');
        this.btnRedo = document.getElementById('btn-redo-text');
    }

    // --- Giữ vùng bôi đen (Selection Tracker) ---
    initSelectionTracker() {
        const saveSelection = () => {
            const sel = window.getSelection();
            if (sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (this.editor.contains(range.commonAncestorContainer)) {
                    this.savedRange = range.cloneRange();
                }
            }
        };

        this.editor.addEventListener('mouseup', saveSelection);
        this.editor.addEventListener('keyup', saveSelection);
        this.editor.addEventListener('touchend', saveSelection);

        // Ngăn toolbar làm mất vùng chọn
        const toolbar = document.getElementById('editor-toolbar');
        if (toolbar) {
            toolbar.addEventListener('mousedown', (e) => {
                saveSelection();
            });
        }
    }

    restoreSelection() {
        if (!this.savedRange) return false;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
        return true;
    }

    initEvents() {
        // Font Family & Font Size Execution
        this.fontFamilySelect.addEventListener('change', (e) => {
            this.setFontFamily(e.target.value);
        });

        this.fontSizeSelect.addEventListener('change', (e) => {
            this.setFontSize(e.target.value);
        });

        this.btnBold.addEventListener('click', () => this.exec('bold'));
        this.btnItalic.addEventListener('click', () => this.exec('italic'));
        this.btnUnderline.addEventListener('click', () => this.exec('underline'));
        this.btnStrikethrough.addEventListener('click', () => this.exec('strikeThrough'));

        this.btnAlignLeft.addEventListener('click', () => this.exec('justifyLeft'));
        this.btnAlignCenter.addEventListener('click', () => this.exec('justifyCenter'));
        this.btnAlignRight.addEventListener('click', () => this.exec('justifyRight'));
        this.btnAlignJustify.addEventListener('click', () => this.exec('justifyFull'));

        this.textColorInput.addEventListener('input', (e) => this.exec('foreColor', e.target.value));
        this.textBgColorInput.addEventListener('input', (e) => this.exec('hiliteColor', e.target.value));

        this.btnBulletList.addEventListener('click', () => this.exec('insertUnorderedList'));
        this.btnNumberList.addEventListener('click', () => this.exec('insertOrderedList'));

        this.lineHeightSelect.addEventListener('change', (e) => {
            this.setLineHeight(e.target.value);
        });

        this.btnUndo.addEventListener('click', () => this.exec('undo'));
        this.btnRedo.addEventListener('click', () => this.exec('redo'));

        // Explicit keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (!ctrl) return;
            const key = e.key.toLowerCase();
            if (key === 'b') { e.preventDefault(); this.exec('bold'); }
            else if (key === 'i') { e.preventDefault(); this.exec('italic'); }
            else if (key === 'u') { e.preventDefault(); this.exec('underline'); }
        });

        // Keep Selection Active State Synced
        document.addEventListener('selectionchange', () => this.updateActiveStates());
    }

    initSymbolPalette() {
        const symbols = ['√', 'π', '∞', '≤', '≥', '±', '→', 'Δ', 'θ', 'α', 'β', 'Σ', '∫', '·', '²', '³', '₂', '°'];

        this.palette = document.createElement('div');
        this.palette.className = 'symbol-palette hidden';
        this.palette.setAttribute('role', 'menu');
        Object.assign(this.palette.style, {
            position: 'absolute', display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px',
            background: 'var(--paper-panel)', border: '1px solid var(--border-color)',
            borderRadius: '10px', padding: '8px', boxShadow: 'var(--shadow-lg)',
            zIndex: '500'
        });
        this.palette.classList.add('hidden');

        symbols.forEach(sym => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = sym;
            Object.assign(b.style, {
                width: '30px', height: '30px', border: 'none', borderRadius: '7px',
                background: 'var(--paper-sunken)', color: 'var(--text-ink)', cursor: 'pointer',
                fontSize: '14px'
            });
            b.addEventListener('mouseenter', () => b.style.background = 'var(--accent-soft)');
            b.addEventListener('mouseleave', () => b.style.background = 'var(--paper-sunken)');
            b.addEventListener('click', () => {
                this.insertTextAtCursor(sym);
                this.hidePalette();
            });
            this.palette.appendChild(b);
        });

        document.body.appendChild(this.palette);

        this.btnFormula.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePalette();
        });
        document.addEventListener('click', (e) => {
            if (!this.palette.contains(e.target) && e.target !== this.btnFormula) this.hidePalette();
        });
    }

    togglePalette() {
        if (this.palette.classList.contains('hidden')) this.showPalette();
        else this.hidePalette();
    }

    showPalette() {
        const rect = this.btnFormula.getBoundingClientRect();
        this.palette.style.top = `${rect.bottom + window.scrollY + 6}px`;
        this.palette.style.left = `${rect.left + window.scrollX}px`;
        this.palette.classList.remove('hidden');
        this.palette.style.display = 'grid';
    }

    hidePalette() {
        this.palette.classList.add('hidden');
        this.palette.style.display = 'none';
    }

    exec(command, value = null) {
        this.editor.focus();
        this.restoreSelection();
        document.execCommand(command, false, value);
        this.editor.focus();
        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    setFontFamily(fontFamily) {
        this.editor.focus();
        this.restoreSelection();

        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) {
            this.editor.style.fontFamily = fontFamily;
            return;
        }

        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontFamily = fontFamily;

        try {
            span.appendChild(range.extractContents());
            range.insertNode(span);

            // Giữ lại bôi đen sau khi áp dụng font
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.removeAllRanges();
            selection.addRange(newRange);
            this.savedRange = newRange.cloneRange();
        } catch {
            document.execCommand('fontName', false, fontFamily);
        }

        this.editor.focus();
        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    setFontSize(pixelSize) {
        this.editor.focus();
        this.restoreSelection();

        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) {
            this.editor.style.fontSize = pixelSize;
            return;
        }

        const range = selection.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = pixelSize;

        try {
            span.appendChild(range.extractContents());
            range.insertNode(span);

            // Giữ lại bôi đen sau khi áp dụng size
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.removeAllRanges();
            selection.addRange(newRange);
            this.savedRange = newRange.cloneRange();
        } catch {}

        this.editor.focus();
        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    setLineHeight(height) {
        this.editor.focus();
        this.restoreSelection();

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        let node = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentNode;

        while (node && node !== this.editor) {
            if (node.nodeName === 'P' || node.nodeName === 'DIV' || node.nodeName === 'LI') {
                node.style.lineHeight = height;
                break;
            }
            node = node.parentNode;
        }

        if (node === this.editor) {
            this.editor.style.lineHeight = height;
        }

        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    updateActiveStates() {
        if (document.activeElement !== this.editor) return;

        this.btnBold.classList.toggle('active', document.queryCommandState('bold'));
        this.btnItalic.classList.toggle('active', document.queryCommandState('italic'));
        this.btnUnderline.classList.toggle('active', document.queryCommandState('underline'));
        this.btnStrikethrough.classList.toggle('active', document.queryCommandState('strikeThrough'));

        this.btnAlignLeft.classList.toggle('active', document.queryCommandState('justifyLeft'));
        this.btnAlignCenter.classList.toggle('active', document.queryCommandState('justifyCenter'));
        this.btnAlignRight.classList.toggle('active', document.queryCommandState('justifyRight'));
        this.btnAlignJustify.classList.toggle('active', document.queryCommandState('justifyFull'));
    }

    insertTextAtCursor(text) {
        this.editor.focus();
        this.restoreSelection();

        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);

            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            this.exec('insertText', text);
        }

        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    getContent() {
        return this.editor.innerHTML;
    }

    setContent(html) {
        this.editor.innerHTML = html;
    }

    getPlainText() {
        return this.editor.innerText || this.editor.textContent || '';
    }

    clear() {
        this.editor.innerHTML = '';
    }
}

// Global Export Engine Instance
window.richTextEditor = new RichTextEditor();
