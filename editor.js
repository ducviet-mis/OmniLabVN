/**
 * OMNILAB - RICH TEXT EDITOR ENGINE (WITH EXTENDED TABLE & DROPDOWN MODULE)
 */

class RichTextEditor {
    constructor() {
        this.editor = document.getElementById('text-editor');
        this.activeTable = null;
        this.selectedCells = [];
        this.initControls();
        this.initEvents();
        this.initMoreDropdownAndTable();
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

        this.btnUndo = document.getElementById('btn-undo-text');
        this.btnRedo = document.getElementById('btn-redo-text');

        // Dropdown toggle & Table Context Menu
        this.btnMoreToggle = document.getElementById('btn-more-toggle');
        this.morePopoverMenu = document.getElementById('more-popover-menu');
        this.tableContextMenu = document.getElementById('table-context-menu');
    }

    initEvents() {
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

        [
            this.btnBold, this.btnItalic, this.btnUnderline, this.btnStrikethrough,
            this.btnAlignLeft, this.btnAlignCenter, this.btnAlignRight, this.btnAlignJustify
        ].forEach((btn) => {
            if (btn) btn.addEventListener('mousedown', (e) => e.preventDefault());
        });

        this.textColorInput.addEventListener('input', (e) => this.exec('foreColor', e.target.value));
        this.textBgColorInput.addEventListener('input', (e) => this.exec('hiliteColor', e.target.value));

        this.btnUndo.addEventListener('click', () => this.exec('undo'));
        this.btnRedo.addEventListener('click', () => this.exec('redo'));

        this.editor.addEventListener('keydown', (e) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (!ctrl) return;
            const key = e.key.toLowerCase();
            if (key === 'b') { e.preventDefault(); this.exec('bold'); }
            else if (key === 'i') { e.preventDefault(); this.exec('italic'); }
            else if (key === 'u') { e.preventDefault(); this.exec('underline'); }
        });

        document.addEventListener('selectionchange', () => this.updateActiveStates());

        // Lắng nghe click trong editor để xử lý Bảng
        this.editor.addEventListener('click', (e) => {
            const td = e.target.closest('td, th');
            const table = e.target.closest('table.omni-table');

            if (table) {
                this.activeTable = table;
                this.positionTableContextMenu(table);
            } else {
                this.hideTableContextMenu();
            }

            if (td && e.shiftKey && this.activeTable) {
                if (!this.selectedCells.includes(td)) this.selectedCells.push(td);
                td.classList.add('selected-cell');
            } else if (td) {
                this.clearCellSelections();
                this.selectedCells = [td];
                td.classList.add('selected-cell');
            }
        });
    }

    initMoreDropdownAndTable() {
        if (!this.btnMoreToggle || !this.morePopoverMenu) return;

        // Toggle More Dropdown
        this.btnMoreToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = this.morePopoverMenu.classList.contains('open');
            this.setMoreDropdownOpen(!isOpen);
        });

        // Click outside -> Tự động đóng Dropdown
        document.addEventListener('click', (e) => {
            if (!this.morePopoverMenu.contains(e.target) && !this.btnMoreToggle.contains(e.target)) {
                this.setMoreDropdownOpen(false);
            }
        });

        // Khởi tạo Grid Selector 10x10
        const gridContainer = document.getElementById('table-grid-container');
        const gridStatus = document.getElementById('table-grid-status');

        if (gridContainer) {
            gridContainer.innerHTML = '';
            for (let r = 1; r <= 10; r++) {
                for (let c = 1; c <= 10; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'grid-cell';
                    cell.dataset.row = r;
                    cell.dataset.col = c;

                    cell.addEventListener('mouseenter', () => {
                        this.highlightGridCells(r, c);
                        if (gridStatus) gridStatus.textContent = `${c} x ${r} Table`;
                    });

                    cell.addEventListener('click', () => {
                        this.insertTable(r, c);
                        this.setMoreDropdownOpen(false);
                    });

                    gridContainer.appendChild(cell);
                }
            }
        }

        // Gắn sự kiện cho Context Menu Bảng
        this.initTableContextMenuEvents();
    }

    setMoreDropdownOpen(open) {
        if (open) {
            this.morePopoverMenu.classList.add('open');
            this.btnMoreToggle.classList.add('active');
        } else {
            this.morePopoverMenu.classList.remove('open');
            this.btnMoreToggle.classList.remove('active');
        }
    }

    highlightGridCells(maxR, maxC) {
        const cells = document.querySelectorAll('#table-grid-container .grid-cell');
        cells.forEach((cell) => {
            const r = parseInt(cell.dataset.row, 10);
            const c = parseInt(cell.dataset.col, 10);
            if (r <= maxR && c <= maxC) {
                cell.classList.add('active');
            } else {
                cell.classList.remove('active');
            }
        });
    }

    insertTable(rows, cols) {
        this.editor.focus();
        let html = '<div class="omni-table-wrapper"><table class="omni-table"><tbody>';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) {
                html += '<td><br></td>';
            }
            html += '</tr>';
        }
        html += '</tbody></table></div><p><br></p>';

        document.execCommand('insertHTML', false, html);
        this.attachEdgeButtonsToTables();
    }

    attachEdgeButtonsToTables() {
        const wrappers = this.editor.querySelectorAll('.omni-table-wrapper');
        wrappers.forEach((wrapper) => {
            if (wrapper.querySelector('.btn-add-col-edge')) return;

            const btnAddCol = document.createElement('button');
            btnAddCol.type = 'button';
            btnAddCol.className = 'table-edge-btn btn-add-col-edge';
            btnAddCol.title = 'Thêm cột';
            btnAddCol.innerHTML = '<i class="fa-solid fa-plus"></i>';
            btnAddCol.addEventListener('click', (e) => {
                e.stopPropagation();
                const table = wrapper.querySelector('table');
                if (table) this.addColumnToTable(table);
            });

            const btnAddRow = document.createElement('button');
            btnAddRow.type = 'button';
            btnAddRow.className = 'table-edge-btn btn-add-row-edge';
            btnAddRow.title = 'Thêm dòng';
            btnAddRow.innerHTML = '<i class="fa-solid fa-plus"></i>';
            btnAddRow.addEventListener('click', (e) => {
                e.stopPropagation();
                const table = wrapper.querySelector('table');
                if (table) this.addRowToTable(table);
            });

            wrapper.appendChild(btnAddCol);
            wrapper.appendChild(btnAddRow);
        });
    }

    addRowToTable(table) {
        if (!table) return;
        const colsCount = table.rows[0] ? table.rows[0].cells.length : 1;
        const newRow = table.insertRow();
        for (let i = 0; i < colsCount; i++) {
            const cell = newRow.insertCell();
            cell.innerHTML = '<br>';
        }
        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    addColumnToTable(table) {
        if (!table) return;
        for (let r = 0; r < table.rows.length; r++) {
            const cell = table.rows[r].insertCell();
            cell.innerHTML = '<br>';
        }
        if (window.scheduleAutosave) window.scheduleAutosave();
    }

    initTableContextMenuEvents() {
        const btnAutoFit = document.getElementById('tbl-btn-autofit');
        const btnAlignLeft = document.getElementById('tbl-btn-align-left');
        const btnAlignCenter = document.getElementById('tbl-btn-align-center');
        const btnAlignRight = document.getElementById('tbl-btn-align-right');
        const colorShading = document.getElementById('tbl-cell-shading');
        const btnMerge = document.getElementById('tbl-btn-merge');
        const btnSplit = document.getElementById('tbl-btn-split');
        const btnAddRow = document.getElementById('tbl-btn-add-row');
        const btnAddCol = document.getElementById('tbl-btn-add-col');
        const btnDelTable = document.getElementById('tbl-btn-del-table');

        if (btnAutoFit) {
            btnAutoFit.addEventListener('click', () => {
                if (!this.activeTable) return;
                this.activeTable.classList.toggle('autofit');
            });
        }

        [
            { btn: btnAlignLeft, align: 'left' },
            { btn: btnAlignCenter, align: 'center' },
            { btn: btnAlignRight, align: 'right' }
        ].forEach(({ btn, align }) => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.selectedCells.forEach((cell) => cell.style.textAlign = align);
                });
            }
        });

        if (colorShading) {
            colorShading.addEventListener('input', (e) => {
                const bg = e.target.value;
                this.selectedCells.forEach((cell) => cell.style.backgroundColor = bg);
            });
        }

        if (btnMerge) {
            btnMerge.addEventListener('click', () => this.mergeSelectedCells());
        }

        if (btnSplit) {
            btnSplit.addEventListener('click', () => this.splitSelectedCell());
        }

        if (btnAddRow) {
            btnAddRow.addEventListener('click', () => this.addRowToTable(this.activeTable));
        }

        if (btnAddCol) {
            btnAddCol.addEventListener('click', () => this.addColumnToTable(this.activeTable));
        }

        if (btnDelTable) {
            btnDelTable.addEventListener('click', () => {
                if (this.activeTable) {
                    const wrapper = this.activeTable.closest('.omni-table-wrapper');
                    if (wrapper) wrapper.remove();
                    else this.activeTable.remove();
                    this.hideTableContextMenu();
                }
            });
        }
    }

    mergeSelectedCells() {
        if (this.selectedCells.length < 2) return;
        const first = this.selectedCells[0];
        let combinedText = '';

        this.selectedCells.forEach((cell, idx) => {
            combinedText += (cell.innerText.trim() ? cell.innerText.trim() + ' ' : '');
            if (idx > 0) cell.remove();
        });

        first.colSpan = this.selectedCells.length;
        first.innerHTML = combinedText || '<br>';
        this.clearCellSelections();
    }

    splitSelectedCell() {
        if (this.selectedCells.length !== 1) return;
        const cell = this.selectedCells[0];
        if (cell.colSpan > 1) {
            const span = cell.colSpan;
            cell.colSpan = 1;
            const row = cell.parentElement;
            for (let i = 1; i < span; i++) {
                const newCell = row.insertCell(cell.cellIndex + 1);
                newCell.innerHTML = '<br>';
            }
        }
    }

    positionTableContextMenu(table) {
        if (!this.tableContextMenu) return;
        const rect = table.getBoundingClientRect();
        this.tableContextMenu.style.top = `${rect.top - 46 + window.scrollY}px`;
        this.tableContextMenu.style.left = `${rect.left + window.scrollX}px`;
        this.tableContextMenu.classList.remove('hidden');
    }

    hideTableContextMenu() {
        if (this.tableContextMenu) this.tableContextMenu.classList.add('hidden');
        this.clearCellSelections();
        this.activeTable = null;
    }

    clearCellSelections() {
        this.selectedCells.forEach((c) => c.classList.remove('selected-cell'));
        this.selectedCells = [];
    }

    exec(command, value = null) {
        document.execCommand(command, false, value);
        this.editor.focus();
        this.updateActiveStates();
    }

    setFontFamily(fontName) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
            this.exec('fontName', fontName);
            return;
        }

        this.exec('fontName', fontName);
        this.editor.style.fontFamily = fontName;

        if (selection && selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === 3) node = node.parentNode;
            if (node && node !== this.editor) node.style.fontFamily = fontName;
        }
        this.editor.focus();
    }

    setFontSize(pixelSize) {
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

    updateActiveStates() {
        if (document.activeElement !== this.editor) return;

        if (this.btnBold) this.btnBold.classList.toggle('active', document.queryCommandState('bold'));
        if (this.btnItalic) this.btnItalic.classList.toggle('active', document.queryCommandState('italic'));
        if (this.btnUnderline) this.btnUnderline.classList.toggle('active', document.queryCommandState('underline'));
        if (this.btnStrikethrough) this.btnStrikethrough.classList.toggle('active', document.queryCommandState('strikeThrough'));

        if (this.btnAlignLeft) this.btnAlignLeft.classList.toggle('active', document.queryCommandState('justifyLeft'));
        if (this.btnAlignCenter) this.btnAlignCenter.classList.toggle('active', document.queryCommandState('justifyCenter'));
        if (this.btnAlignRight) this.btnAlignRight.classList.toggle('active', document.queryCommandState('justifyRight'));
        if (this.btnAlignJustify) this.btnAlignJustify.classList.toggle('active', document.queryCommandState('justifyFull'));
    }

    getContent() { return this.editor.innerHTML; }
    setContent(html) {
        this.editor.innerHTML = html;
        this.attachEdgeButtonsToTables();
    }
    getPlainText() { return this.editor.innerText || this.editor.textContent || ''; }
    clear() { this.editor.innerHTML = ''; }
}

// Global Export Engine Instance
window.richTextEditor = new RichTextEditor();
