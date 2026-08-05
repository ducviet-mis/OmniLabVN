/**
 * OMNILAB - RICH TEXT EDITOR ENGINE
 * Fully manages formatting, font selection, alignments, lists, and line height.
 */

class RichTextEditor {
    constructor() {
        this.editor = document.getElementById('text-editor');
        this.initControls();
        this.initEvents();
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
        this.lineHeightSelect = document.getElementById('line-height');
    }

    initEvents() {
        // Executive Commands Execution
        this.fontFamilySelect.addEventListener('change', (e) => this.exec('fontName', e.target.value));
        this.fontSizeSelect.addEventListener('change', (e) => this.setFontSize(e.target.value));

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

        // Keep Selection Active State Synced
        document.addEventListener('selectionchange', () => this.updateActiveStates());
    }

    exec(command, value = null) {
        document.execCommand(command, false, value);
        this.editor.focus();
    }

    setFontSize(pixelSize) {
        // Custom Font Size Applying Span Wrappers
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (range.collapsed) return;

        const span = document.createElement('span');
        span.style.fontSize = pixelSize;
        span.appendChild(range.extractContents());
        range.insertNode(span);
        this.editor.focus();
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

    clear() {
        this.editor.innerHTML = '';
    }
}

// Global Export Engine Instance
window.richTextEditor = new RichTextEditor();
