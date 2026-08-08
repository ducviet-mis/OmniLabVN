/**
 * OMNILAB - RICH TEXT EDITOR ENGINE
 * Fully manages formatting, font selection, alignments, lists, line height,
 * keyboard shortcuts, undo/redo, and a quick scientific-symbol palette.
 */

class RichTextEditor {
    constructor() {
        this.editor = document.getElementById('text-editor');
        this.savedRange = null; // luôn giữ vùng bôi đen (selection) gần nhất trong editor
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

        // Theo dõi selection liên tục: hễ selection đang nằm trong editor thì lưu lại.
        // Đây là lưới an toàn thứ 2, phòng trường hợp mousedown/focus ở trên không bắt kịp.
        document.addEventListener('selectionchange', () => {
            this.saveSelection();
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

        const selection = window.getSelection();

        // Trường hợp 1: Có văn bản được bôi đen -> Đổi font phần được chọn
        if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
            document.execCommand('fontName', false, fontName);
            this.saveSelection();
            this.editor.focus();
            return;
        }

        // Trường hợp 2: Không bôi đen -> Áp dụng font trực tiếp cho vị trí/đoạn gõ tiếp theo
        document.execCommand('fontName', false, fontName);
        this.editor.style.fontFamily = fontName;

        if (selection && selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === 3) node = node.parentNode;

            if (node && node !== this.editor) {
                node.style.fontFamily = fontName;
            }
        }

        this.saveSelection();
        this.editor.focus();
    }

    setFontSize(pixelSize) {
        this.editor.focus();

        // Khôi phục lại đúng vùng bôi đen đã lưu trước khi <select> cướp focus.
        // Đây là nguyên nhân chính khiến cỡ chữ "không đổi": lúc sự kiện change
        // của <select> bắn ra thì selection trong editor đã bị mất/thay đổi.
        this.restoreSelection();

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        // Dùng "chiêu" kinh điển: execCommand('fontSize') chỉ nhận giá trị 1-7,
        // nên ta gán tạm size=7 (giá trị hiếm khi trùng với nội dung có sẵn),
        // sau đó tìm đúng các thẻ <font size="7"> vừa được trình duyệt tạo ra
        // và đổi chúng thành <span style="font-size: ...px"> theo đúng ý muốn.
        // Cách này hoạt động ổn định cho cả trường hợp bôi đen nhiều dòng/nhiều
        // thẻ lồng nhau, và cả khi con trỏ chỉ đứng yên (không bôi đen) để áp
        // dụng cỡ chữ cho đoạn sắp gõ tiếp theo — điều mà cách extractContents
        // thủ công trước đây không xử lý được.
        document.execCommand('fontSize', false, '7');

        const fontElements = this.editor.querySelectorAll('font[size="7"]');
        fontElements.forEach((f) => {
            f.removeAttribute('size');
            f.style.fontSize = pixelSize;
            // Đổi thẻ <font> (deprecated) sang <span> cho markup sạch hơn
            const span = document.createElement('span');
            span.style.fontSize = pixelSize;
            while (f.firstChild) span.appendChild(f.firstChild);
            f.parentNode.replaceChild(span, f);
        });

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
