/**
 * OMNILAB - RICH TEXT EDITOR ENGINE
 * Fully manages formatting, font selection, alignments, lists, line height,
 * keyboard shortcuts, undo/redo, and a quick scientific-symbol palette.
 */

class RichTextEditor {
    constructor() {
        this.editor = document.getElementById('text-editor');
        this.savedRange = null; // luôn giữ vùng bôi đen (selection) gần nhất trong editor

        // Đảm bảo hành vi xuống dòng nhất quán giữa các trình duyệt
        // (Firefox mặc định dùng <br>, còn Chrome/Edge/Safari dùng <div>).
        try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) { /* no-op */ }

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

        // Các control KHÔNG THỂ preventDefault trên mousedown (select, input[type=color])
        // vì làm vậy sẽ chặn luôn việc mở dropdown / bảng màu.
        // => Giải pháp: chủ động lưu lại selection ngay trước khi chúng cướp focus,
        // rồi khôi phục lại selection đó khi xử lý sự kiện change/input.
        [
            this.fontFamilySelect, this.fontSizeSelect,
            this.textColorInput, this.textBgColorInput,
            this.lineHeightSelect
        ].forEach((el) => {
            el.addEventListener('mousedown', () => this.saveSelection());
            el.addEventListener('focus', () => this.saveSelection());
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

        // Khi có gõ chữ thật vào vị trí đang "chờ định dạng" (pending-style span),
        // biến nó thành đoạn text bình thường: bỏ ký tự placeholder (zero-width space)
        // và gỡ cờ pending, để không còn ảnh hưởng gì tới các lần dọn dẹp sau.
        this.editor.addEventListener('input', () => this.commitPendingStyleSpans());

        // Theo dõi selection liên tục: hễ selection đang nằm trong editor thì lưu lại,
        // đồng thời dọn các pending-style span "mồ côi" (con trỏ đã rời đi mà chưa gõ gì)
        // — đây chính là nguyên nhân gây phình chiều cao dòng khi đổi font/cỡ chữ.
        document.addEventListener('selectionchange', () => {
            this.saveSelection();
            this.cleanupStalePendingSpans();
            this.updateActiveStates();
        });
    }

    /**
     * Lưu lại Range hiện tại của selection, CHỈ khi nó thực sự nằm trong editor.
     * Nhờ vậy, khi người dùng click ra ngoài (vào select, input color...),
     * ta vẫn còn "bản sao" vị trí bôi đen để khôi phục lại sau.
     */
    saveSelection() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        if (this.editor.contains(range.commonAncestorContainer)) {
            this.savedRange = range.cloneRange();
        }
    }

    /**
     * Khôi phục lại selection đã lưu (nếu có) vào document.
     * Trả về true nếu khôi phục thành công.
     */
    restoreSelection() {
        if (!this.savedRange) return false;

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this.savedRange);
        return true;
    }

    // ------------------------------------------------------------------
    // PENDING-STYLE SPAN
    // Khi người dùng đổi font/cỡ chữ mà KHÔNG bôi đen (chỉ đặt con trỏ),
    // Word sẽ áp style đó cho ký tự sắp gõ tiếp theo. Để làm điều này trong
    // contenteditable mà không để lại "rác" ảnh hưởng layout, ta chèn 1 span
    // rỗng chứa ký tự zero-width (vô hình) mang style mong muốn, đặt con trỏ
    // vào trong đó. Nếu người dùng gõ chữ -> span trở thành chữ thật (commit).
    // Nếu người dùng rời đi mà không gõ gì -> span bị dọn dẹp ngay, tránh để
    // lại phần tử vô hình nhưng vẫn mang font-size/font-family lớn, khiến
    // chiều cao dòng (line-box) bị tính sai và phình to bất thường.
    // ------------------------------------------------------------------

    ZERO_WIDTH = '\u200B';

    findPendingSpanAtCaret(range) {
        if (!range || !range.collapsed) return null;
        let node = range.startContainer;
        if (node.nodeType === 3) node = node.parentElement;
        if (node && node.nodeType === 1 && node.hasAttribute('data-pending-style')) return node;
        return null;
    }

    insertPendingStyleSpan(styles) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return;

        // Nếu con trỏ đang nằm ngay trong 1 pending-style span còn trống,
        // gộp thêm style mới vào span đó (VD: vừa đổi font vừa đổi cỡ chữ
        // liên tiếp khi chưa gõ gì) thay vì tạo lồng nhiều span rác.
        const existingSpan = this.findPendingSpanAtCaret(range);
        if (existingSpan) {
            Object.assign(existingSpan.style, styles);
            this.placeCaretInPendingSpan(existingSpan);
            return;
        }

        this.cleanupStalePendingSpans();

        const span = document.createElement('span');
        Object.assign(span.style, styles);
        span.setAttribute('data-pending-style', 'true');
        span.appendChild(document.createTextNode(this.ZERO_WIDTH));
        range.insertNode(span);

        this.placeCaretInPendingSpan(span);
    }

    placeCaretInPendingSpan(span) {
        const selection = window.getSelection();
        const newRange = document.createRange();
        newRange.setStart(span.firstChild, span.firstChild.textContent.length);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    /** Biến pending-style span thành text thường ngay khi người dùng gõ chữ vào đó. */
    commitPendingStyleSpans() {
        const spans = this.editor.querySelectorAll('span[data-pending-style]');
        spans.forEach((span) => {
            const text = span.textContent;
            if (text === '') {
                span.remove();
                return;
            }
            if (text.length > this.ZERO_WIDTH.length && text.charAt(0) === this.ZERO_WIDTH) {
                span.textContent = text.slice(this.ZERO_WIDTH.length);
                span.removeAttribute('data-pending-style');

                const selection = window.getSelection();
                const r = document.createRange();
                r.selectNodeContents(span);
                r.collapse(false);
                selection.removeAllRanges();
                selection.addRange(r);
            }
        });
    }

    /** Xoá các pending-style span "mồ côi" (con trỏ đã rời đi mà vẫn còn rỗng). */
    cleanupStalePendingSpans() {
        if (!this.editor.querySelector('span[data-pending-style]')) return;

        const selection = window.getSelection();
        const activeSpan = (selection && selection.rangeCount > 0)
            ? this.findPendingSpanAtCaret(selection.getRangeAt(0))
            : null;

        this.editor.querySelectorAll('span[data-pending-style]').forEach((span) => {
            if (span === activeSpan) return;
            if (span.textContent === this.ZERO_WIDTH || span.textContent === '') {
                span.remove();
            } else {
                span.removeAttribute('data-pending-style');
            }
        });
    }

    /**
     * Áp style lên vùng đang bôi đen (không collapsed). Dùng execCommand để
     * trình duyệt tự tách đúng ranh giới các node, sau đó convert kết quả
     * (thẻ <font> cũ, deprecated) thành <span> sạch với đúng style mong muốn.
     * Trả về false nếu không có vùng bôi đen (để nơi gọi tự xử lý fallback).
     */
    applyStyleToSelection(kind, value) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return false;

        if (kind === 'fontSize') {
            // execCommand('fontSize') chỉ nhận số 1-7, nên gán tạm size=7
            // (giá trị hiếm khi trùng nội dung có sẵn) rồi thay bằng px thật.
            document.execCommand('fontSize', false, '7');
            this.editor.querySelectorAll('font[size="7"]').forEach((f) => {
                const span = document.createElement('span');
                span.style.fontSize = value;
                while (f.firstChild) span.appendChild(f.firstChild);
                f.parentNode.replaceChild(span, f);
            });
        } else if (kind === 'fontFamily') {
            // Dùng placeholder thay vì truyền thẳng tên font (có khoảng trắng)
            // vào execCommand để tránh lỗi parse tên font ở 1 số trình duyệt.
            const marker = '__omnilab_pending_font__';
            document.execCommand('fontName', false, marker);
            this.editor.querySelectorAll(`font[face="${marker}"]`).forEach((f) => {
                const span = document.createElement('span');
                span.style.fontFamily = value;
                while (f.firstChild) span.appendChild(f.firstChild);
                f.parentNode.replaceChild(span, f);
            });
        }
        return true;
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
            b.addEventListener('mousedown', (e) => e.preventDefault()); // giữ nguyên selection/caret trong editor
            b.addEventListener('click', () => {
                this.insertTextAtCursor(sym);
                this.hidePalette();
            });
            this.palette.appendChild(b);
        });

        document.body.appendChild(this.palette);

        this.btnFormula.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.saveSelection();
        });
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
        this.saveSelection();
        this.updateActiveStates();
    }

    setFontFamily(fontName) {
        this.editor.focus();
        this.restoreSelection();

        const applied = this.applyStyleToSelection('fontFamily', fontName);
        if (!applied) {
            // Không có bôi đen -> chỉ đặt style "chờ" cho ký tự gõ tiếp theo,
            // KHÔNG đổi font mặc định của toàn bộ editor (tránh làm lệch các
            // dòng/đoạn khác đang dùng font khác nhau).
            this.insertPendingStyleSpan({ fontFamily: fontName });
        }

        this.saveSelection();
        this.editor.focus();
        this.updateActiveStates();
    }

    setFontSize(pixelSize) {
        this.editor.focus();
        this.restoreSelection();

        const applied = this.applyStyleToSelection('fontSize', pixelSize);
        if (!applied) {
            this.insertPendingStyleSpan({ fontSize: pixelSize });
        }

        this.saveSelection();
        this.editor.focus();
        this.updateActiveStates();
    }

    setLineHeight(height) {
        this.editor.focus();
        this.restoreSelection();

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

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

        this.saveSelection();
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
