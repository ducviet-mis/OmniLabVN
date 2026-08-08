/**
 * OMNILAB - RICH TEXT EDITOR ENGINE
 * Fully manages formatting, font selection, alignments, lists, line height,
 * keyboard shortcuts, undo/redo, and a quick scientific-symbol palette.
 */

class RichTextEditor {
    constructor() {
        this.editor = document.getElementById('text-editor');
        this.savedRange = null;
        this.initControls();
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

    initEvents() {
        // Save the editor range before a toolbar select receives focus. Native
        // selects otherwise collapse the highlighted text, so font changes are
        // applied at the caret instead of to the selected text.
        ['mouseup', 'keyup', 'input', 'focus'].forEach((eventName) => {
            this.editor.addEventListener(eventName, () => this.saveSelection());
        });
        [this.fontFamilySelect, this.fontSizeSelect].forEach((select) => {
            select.addEventListener('pointerdown', () => this.saveSelection());
            select.addEventListener('mousedown', () => this.saveSelection());
        });

        // Executive Commands Execution
        this.fontFamilySelect.addEventListener('change', (e) => this.setFontFamily(e.target.value));
        this.fontSizeSelect.addEventListener('change', (e) => this.setFontSize(e.target.value));

        this.btnBold.addEventListener('click', () => this.exec('bold'));
        this.btnItalic.addEventListener('click', () => this.exec('italic'));
        this.btnUnderline.addEventListener('click', () => this.exec('underline'));
        this.btnStrikethrough.addEventListener('click', () => this.exec('strikeThrough'));

        this.btnAlignLeft.addEventListener('click', () => this.exec('justifyLeft'));
        this.btnAlignCenter.addEventListener('click', () => this.exec('justifyCenter'));
        this.btnAlignRight.addEventListener('click', () => this.exec('justifyRight'));
        this.btnAlignJustify.addEventListener('click', () => this.exec('justifyFull'));

        // Ngăn các nút định dạng cướp focus/selection của editor khi click.
        [
            this.btnBold, this.btnItalic, this.btnUnderline, this.btnStrikethrough,
            this.btnAlignLeft, this.btnAlignCenter, this.btnAlignRight, this.btnAlignJustify,
            this.btnBulletList, this.btnNumberList
        ].forEach((btn) => {
            btn.addEventListener('mousedown', (e) => e.preventDefault());
        });

        this.textColorInput.addEventListener('input', (e) => this.exec('foreColor', e.target.value));
        this.textBgColorInput.addEventListener('input', (e) => this.exec('hiliteColor', e.target.value));

        this.btnBulletList.addEventListener('click', () => this.exec('insertUnorderedList'));
        this.btnNumberList.addEventListener('click', () => this.exec('insertOrderedList'));

        this.lineHeightSelect.addEventListener('change', (e) => {
            this.setLineHeight(e.target.value);
        });

        this.btnUndo.addEventListener('click', () => this.exec('undo'));
        this.btnRedo.addEventListener('click', () => this.exec('redo'));

        // Keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (!ctrl) return;
            const key = e.key.toLowerCase();
            if (key === 'b') { e.preventDefault(); this.exec('bold'); }
            else if (key === 'i') { e.preventDefault(); this.exec('italic'); }
            else if (key === 'u') { e.preventDefault(); this.exec('underline'); }
        });

        // Keep Selection Active State Synced
        document.addEventListener('selectionchange', () => {
            this.saveSelection();
            this.updateActiveStates();
        });
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
        this.focusAndRestoreSelection();
        document.execCommand(command, false, value);
        this.saveSelection();
        this.updateActiveStates();
    }

    saveSelection() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (this.editor.contains(range.commonAncestorContainer)) {
            this.savedRange = range.cloneRange();
        }
    }

    restoreSelection() {
        if (!this.savedRange || !this.editor.contains(this.savedRange.commonAncestorContainer)) return;

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.savedRange);
    }

    focusAndRestoreSelection() {
        this.editor.focus({ preventScroll: true });
        this.restoreSelection();
    }

    applyTextStyle(property, value) {
        this.focusAndRestoreSelection();

        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!this.editor.contains(range.commonAncestorContainer)) return;

        const styledSpan = document.createElement('span');
        // A newly selected style must override styles from earlier nested spans.
        styledSpan.style.setProperty(property, value, 'important');

        if (range.collapsed) {
            const marker = document.createTextNode('\u200B');
            styledSpan.appendChild(marker);
            range.insertNode(styledSpan);
            range.setStart(marker, 1);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            styledSpan.appendChild(range.extractContents());
            range.insertNode(styledSpan);
            const updatedRange = document.createRange();
            updatedRange.selectNodeContents(styledSpan);
            selection.removeAllRanges();
            selection.addRange(updatedRange);
        }

        this.editor.focus({ preventScroll: true });
        this.saveSelection();
    }

    setFontFamily(fontName) {
        this.applyTextStyle('font-family', fontName);
        return;

        this.restoreSelection();
        const selection = window.getSelection();
        
        // Trường hợp 1: Có văn bản được bôi đen -> Đổi font phần được chọn
        if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
            this.exec('fontName', fontName);
            return;
        }

        // Trường hợp 2: Không bôi đen -> Áp dụng font trực tiếp cho vị trí/đoạn gõ tiếp theo
        this.exec('fontName', fontName);
        this.editor.style.fontFamily = fontName;

        if (selection && selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === 3) node = node.parentNode;
            
            if (node && node !== this.editor) {
                node.style.fontFamily = fontName;
            }
        }

        this.editor.focus();
    }

    setFontSize(pixelSize) {
        this.applyTextStyle('font-size', pixelSize);
        return;

        this.restoreSelection();
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!this.editor.contains(range.commonAncestorContainer)) return;

        if (range.collapsed) {
            // Keep the selected size for the text typed from this point onward.
            document.execCommand('fontSize', false, '7');
            const font = this.editor.querySelector('font[size="7"]');
            if (font) {
                font.removeAttribute('size');
                font.style.fontSize = pixelSize;
            }
            this.editor.focus();
            this.saveSelection();
            return;
        }

        const span = document.createElement('span');
        span.style.fontSize = pixelSize;
        span.appendChild(range.extractContents());
        range.insertNode(span);

        selection.removeAllRanges();
        const updatedRange = document.createRange();
        updatedRange.selectNodeContents(span);
        selection.addRange(updatedRange);
        this.editor.focus();
        this.saveSelection();
    }

    setLineHeight(height) {
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
        this.exec('insertText', text);
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
