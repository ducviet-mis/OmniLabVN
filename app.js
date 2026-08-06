/**
 * OMNILAB - MAIN APPLICATION CONTROLLER
 * Integrates PDF.js, Resizer, Scientific Calculator, Mode Switcher,
 * Theme toggle, Autosave, Toast/Confirm UI, and LocalStorage persistence.
 */

document.addEventListener('DOMContentLoaded', () => {

    // PDF.js Worker Configuration
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    // ----------------------------------------------------------------------
    // 0. TOAST & CONFIRM UI HELPERS
    // ----------------------------------------------------------------------
    const toastStack = document.getElementById('toast-stack');

    const showToast = (message, type = 'info', icon = 'fa-circle-check') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
        toastStack.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 220);
        }, 2600);
    };
    window.showToast = showToast;

    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');

    const showConfirm = (message, title = 'Xác nhận thao tác') => {
        return new Promise((resolve) => {
            confirmTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${title}`;
            confirmMessage.textContent = message;
            confirmModal.classList.remove('hidden');

            const cleanup = (result) => {
                confirmModal.classList.add('hidden');
                confirmOk.removeEventListener('click', onOk);
                confirmCancel.removeEventListener('click', onCancel);
                resolve(result);
            };
            const onOk = () => cleanup(true);
            const onCancel = () => cleanup(false);

            confirmOk.addEventListener('click', onOk);
            confirmCancel.addEventListener('click', onCancel);
        });
    };
    window.showConfirm = showConfirm;

    // ----------------------------------------------------------------------
    // 1. THEME TOGGLE (Light / Dark)
    // ----------------------------------------------------------------------
    const btnToggleTheme = document.getElementById('btn-toggle-theme');
    const themeIcon = btnToggleTheme.querySelector('i');

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.className = 'fa-solid fa-sun';
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeIcon.className = 'fa-solid fa-moon';
        }
    };

    const savedTheme = localStorage.getItem('omnilab_theme') || 'light';
    applyTheme(savedTheme);

    btnToggleTheme.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const next = isDark ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('omnilab_theme', next);
    });

    // ----------------------------------------------------------------------
    // 2. STATE VARIABLES
    // ----------------------------------------------------------------------
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.2;

    const pdfCanvas = document.getElementById('pdf-canvas');
    const pdfCtx = pdfCanvas.getContext('2d');
    const pdfPageStage = document.getElementById('pdf-page-stage');
    const pdfDrawCanvas = document.getElementById('pdf-draw-canvas');
    const pdfPlaceholder = document.getElementById('pdf-placeholder');
    const pdfLoading = document.getElementById('pdf-loading');
    const pdfDocName = document.getElementById('pdf-doc-name');

    // ----------------------------------------------------------------------
    // 2b. HOMEPAGE INTEGRATION — note opened from the dashboard (?fileId=...)
    //     Demo only: reads/writes the same localStorage records used by
    //     home.js so a note's title/timestamp stay in sync on the dashboard.
    // ----------------------------------------------------------------------
    const noteTitleBadge = document.getElementById('note-title-badge');
    const noteTitleText = document.getElementById('note-title-text');
    const activeFileId = new URLSearchParams(window.location.search).get('fileId');

    const getDemoFiles = () => {
        try { return JSON.parse(localStorage.getItem('omnilab_files') || '[]'); }
        catch { return []; }
    };
    const setDemoFiles = (files) => localStorage.setItem('omnilab_files', JSON.stringify(files));

    const touchActiveFileRecord = () => {
        if (!activeFileId) return;
        const files = getDemoFiles();
        const idx = files.findIndex((f) => f.id === activeFileId);
        if (idx === -1) return;
        files[idx].updatedAt = Date.now();
        const plainLen = (window.richTextEditor ? window.richTextEditor.getPlainText() : '').length;
        files[idx].sizeKB = Math.max(1, Math.round((plainLen / 1024) * 10) / 10);
        setDemoFiles(files);
    };

    if (activeFileId) {
        const demoRecord = getDemoFiles().find((f) => f.id === activeFileId);
        if (demoRecord) {
            noteTitleBadge.classList.remove('hidden');
            noteTitleText.textContent = demoRecord.title;
            noteTitleBadge.title = 'Nhấp để đổi tên ghi chú';
            noteTitleBadge.style.cursor = 'pointer';
            noteTitleBadge.addEventListener('click', () => {
                const newTitle = prompt('Đổi tên ghi chú:', demoRecord.title);
                if (!newTitle || !newTitle.trim()) return;
                demoRecord.title = newTitle.trim();
                noteTitleText.textContent = demoRecord.title;
                const files = getDemoFiles();
                const idx = files.findIndex((f) => f.id === activeFileId);
                if (idx > -1) { files[idx].title = demoRecord.title; setDemoFiles(files); }
            });
        }
    }

    // In-memory per-page store for direct PDF annotations (pageNum -> dataURL).
    // Reset whenever a new document is loaded.
    let pdfDrawings = new Map();

    const savePdfPageDrawing = (num) => {
        if (!pdfDrawCanvas.width || !pdfDrawCanvas.height) return;
        pdfDrawings.set(num, pdfDrawCanvas.toDataURL());
    };

    const loadPdfPageDrawing = (num) => {
        window.pdfDrawEngine.ctx.clearRect(0, 0, pdfDrawCanvas.width, pdfDrawCanvas.height);
        const data = pdfDrawings.get(num);
        if (data) window.pdfDrawEngine.loadCanvasData(data);
    };

    // ----------------------------------------------------------------------
    // 4. SPLIT SCREEN RESIZER
    // ----------------------------------------------------------------------
    const resizer = document.getElementById('resizer');
    const pdfPane = document.getElementById('pdf-container');
    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerWidth = document.querySelector('.main-container').clientWidth;
        let newWidth = (e.clientX / containerWidth) * 100;

        if (newWidth > 20 && newWidth < 80) {
            pdfPane.style.width = `${newWidth}%`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
        }
    });

    // ----------------------------------------------------------------------
    // 5. PDF RENDERING ENGINE
    // ----------------------------------------------------------------------
    const renderPage = (num) => {
        pageRendering = true;
        pdfDoc.getPage(num).then((page) => {
            const viewport = page.getViewport({ scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;
            window.pdfDrawEngine.resizeTo(viewport.width, viewport.height);

            const renderContext = {
                canvasContext: pdfCtx,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            renderTask.promise.then(() => {
                pageRendering = false;
                loadPdfPageDrawing(num);
                if (pageNumPending !== null) {
                    const next = pageNumPending;
                    pageNumPending = null;
                    renderPage(next);
                }
            });
        });

        document.getElementById('pdf-page-num').textContent = num;
    };

    const queueRenderPage = (num) => {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    };

    document.getElementById('pdf-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            showToast('Vui lòng chọn một tệp định dạng PDF.', 'error', 'fa-circle-exclamation');
            return;
        }

        pdfLoading.classList.remove('hidden');
        pdfPlaceholder.style.display = 'none';

        const fileReader = new FileReader();
        fileReader.onload = function () {
            const typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
                pdfDoc = pdf;
                pdfDrawings = new Map(); // fresh document — discard previous page annotations
                document.getElementById('pdf-page-count').textContent = pdf.numPages;
                pdfLoading.classList.add('hidden');
                pdfPageStage.style.display = 'block';
                pdfDocName.textContent = file.name;
                pageNum = 1;
                renderPage(pageNum);
                showToast(`Đã nạp tài liệu · ${pdf.numPages} trang`, 'info', 'fa-file-pdf');
            }).catch(() => {
                pdfLoading.classList.add('hidden');
                pdfPlaceholder.style.display = 'flex';
                showToast('Không thể đọc tệp PDF này.', 'error', 'fa-circle-exclamation');
            });
        };
        fileReader.readAsArrayBuffer(file);
    });

    document.getElementById('pdf-prev').addEventListener('click', () => {
        if (!pdfDoc || pageNum <= 1) return;
        savePdfPageDrawing(pageNum);
        pageNum--;
        queueRenderPage(pageNum);
    });

    document.getElementById('pdf-next').addEventListener('click', () => {
        if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
        savePdfPageDrawing(pageNum);
        pageNum++;
        queueRenderPage(pageNum);
    });

    document.getElementById('pdf-zoom-in').addEventListener('click', () => {
        if (!pdfDoc || scale >= 3) return;
        savePdfPageDrawing(pageNum);
        scale += 0.2;
        document.getElementById('pdf-zoom-level').textContent = `${Math.round(scale * 100)}%`;
        queueRenderPage(pageNum);
    });

    document.getElementById('pdf-zoom-out').addEventListener('click', () => {
        if (!pdfDoc || scale <= 0.6) return;
        savePdfPageDrawing(pageNum);
        scale -= 0.2;
        document.getElementById('pdf-zoom-level').textContent = `${Math.round(scale * 100)}%`;
        queueRenderPage(pageNum);
    });

    // Keyboard navigation for PDF (only when not typing in the editor)
    document.addEventListener('keydown', (e) => {
        const isTyping = document.activeElement && document.activeElement.id === 'text-editor';
        if (isTyping || !pdfDoc) return;
        if (e.key === 'ArrowLeft') document.getElementById('pdf-prev').click();
        if (e.key === 'ArrowRight') document.getElementById('pdf-next').click();
    });

    // ----------------------------------------------------------------------
    // 6. SCIENTIFIC CALCULATOR (safe expression parser — no eval)
    // ----------------------------------------------------------------------
    const casioModal = document.getElementById('casio-modal');
    const casioDisplay = document.getElementById('casio-display');
    const casioMemoryLabel = document.getElementById('casio-memory');
    const btnToggleCasio = document.getElementById('btn-toggle-casio');
    const btnCloseCasio = document.getElementById('btn-close-casio');
    const casioHeader = document.getElementById('casio-header');

    btnToggleCasio.addEventListener('click', () => {
        casioModal.classList.toggle('hidden');
    });

    btnCloseCasio.addEventListener('click', () => {
        casioModal.classList.add('hidden');
    });

    // Make Casio Modal Draggable (mouse + touch)
    let isDraggingCasio = false;
    let casioOffsetX = 0, casioOffsetY = 0;

    const startDragCasio = (clientX, clientY) => {
        isDraggingCasio = true;
        casioOffsetX = clientX - casioModal.offsetLeft;
        casioOffsetY = clientY - casioModal.offsetTop;
    };
    const moveDragCasio = (clientX, clientY) => {
        if (!isDraggingCasio) return;
        casioModal.style.left = `${clientX - casioOffsetX}px`;
        casioModal.style.top = `${clientY - casioOffsetY}px`;
        casioModal.style.right = 'auto';
    };

    casioHeader.addEventListener('mousedown', (e) => startDragCasio(e.clientX, e.clientY));
    document.addEventListener('mousemove', (e) => moveDragCasio(e.clientX, e.clientY));
    document.addEventListener('mouseup', () => isDraggingCasio = false);

    casioHeader.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        startDragCasio(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
        if (!isDraggingCasio) return;
        const t = e.touches[0];
        moveDragCasio(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener('touchend', () => isDraggingCasio = false);

    /**
     * Tiny recursive-descent parser/evaluator for arithmetic expressions.
     * Supports: + - * / ^ () unary minus, sin cos tan log ln sqrt, pi, e, n!, %
     * Deliberately avoids eval()/Function() on user input.
     */
    class ExpressionError extends Error {}

    function evaluateExpression(input) {
        const src = input.replace(/pi/g, 'π').trim();
        let pos = 0;

        const peek = () => src[pos];
        const isDigit = (c) => c >= '0' && c <= '9';
        const isAlpha = (c) => /[a-zA-Zπ]/.test(c || '');

        function skipSpace() { while (peek() === ' ') pos++; }

        function parseExpression() {
            let value = parseTerm();
            skipSpace();
            while (peek() === '+' || peek() === '-') {
                const op = src[pos++];
                const rhs = parseTerm();
                value = op === '+' ? value + rhs : value - rhs;
                skipSpace();
            }
            return value;
        }

        function parseTerm() {
            let value = parseFactor();
            skipSpace();
            while (peek() === '*' || peek() === '/' || peek() === '%') {
                const op = src[pos++];
                const rhs = parseFactor();
                if (op === '*') value = value * rhs;
                else if (op === '/') {
                    if (rhs === 0) throw new ExpressionError('Chia cho 0');
                    value = value / rhs;
                } else value = value % rhs;
                skipSpace();
            }
            return value;
        }

        function parseFactor() {
            let value = parseUnary();
            skipSpace();
            while (peek() === '^') {
                pos++;
                const rhs = parseUnary();
                value = Math.pow(value, rhs);
                skipSpace();
            }
            return value;
        }

        function parseUnary() {
            skipSpace();
            if (peek() === '-') { pos++; return -parseUnary(); }
            if (peek() === '+') { pos++; return parseUnary(); }
            return parsePostfix();
        }

        function parsePostfix() {
            let value = parsePrimary();
            skipSpace();
            while (peek() === '!') {
                pos++;
                value = factorial(value);
                skipSpace();
            }
            return value;
        }

        function factorial(n) {
            if (n < 0 || !Number.isInteger(n)) throw new ExpressionError('n! không hợp lệ');
            let result = 1;
            for (let i = 2; i <= n; i++) result *= i;
            return result;
        }

        function parsePrimary() {
            skipSpace();
            const c = peek();

            if (c === '(') {
                pos++;
                const value = parseExpression();
                skipSpace();
                if (peek() !== ')') throw new ExpressionError('Thiếu dấu )');
                pos++;
                return value;
            }

            if (c === 'π') { pos++; return Math.PI; }

            if (isAlpha(c)) {
                let name = '';
                while (isAlpha(peek())) name += src[pos++];
                skipSpace();
                if (name === 'e') return Math.E;
                if (peek() !== '(') throw new ExpressionError(`Thiếu ( sau ${name}`);
                pos++;
                const arg = parseExpression();
                skipSpace();
                if (peek() !== ')') throw new ExpressionError('Thiếu dấu )');
                pos++;
                switch (name) {
                    case 'sin': return Math.sin(arg * Math.PI / 180);
                    case 'cos': return Math.cos(arg * Math.PI / 180);
                    case 'tan': return Math.tan(arg * Math.PI / 180);
                    case 'log': return Math.log10(arg);
                    case 'ln': return Math.log(arg);
                    case 'sqrt': return Math.sqrt(arg);
                    default: throw new ExpressionError(`Không rõ hàm ${name}`);
                }
            }

            if (isDigit(c) || c === '.') {
                let numStr = '';
                while (isDigit(peek()) || peek() === '.') numStr += src[pos++];
                return parseFloat(numStr);
            }

            throw new ExpressionError('Biểu thức không hợp lệ');
        }

        if (!src) return 0;
        const result = parseExpression();
        skipSpace();
        if (pos < src.length) throw new ExpressionError('Biểu thức không hợp lệ');
        if (!Number.isFinite(result)) throw new ExpressionError('Kết quả không xác định');
        return result;
    }
    window.evaluateExpression = evaluateExpression;

    let expression = '';
    let memory = 0;

    const refreshMemoryLabel = () => {
        casioMemoryLabel.textContent = `M: ${roundDisplay(memory)}`;
    };
    const roundDisplay = (n) => {
        if (typeof n !== 'number') return n;
        return Math.round(n * 1e10) / 1e10;
    };

    document.querySelectorAll('.casio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.value;
            const action = btn.dataset.action;

            const wrapFunc = (fnName) => {
                expression += `${fnName}(`;
                casioDisplay.value = expression;
            };

            if (val === 'pi') { expression += 'pi'; casioDisplay.value = expression; return; }
            if (val) { expression += val; casioDisplay.value = expression; return; }

            switch (action) {
                case 'clear': expression = ''; casioDisplay.value = '0'; break;
                case 'delete': expression = expression.slice(0, -1); casioDisplay.value = expression || '0'; break;
                case 'sin': wrapFunc('sin'); break;
                case 'cos': wrapFunc('cos'); break;
                case 'tan': wrapFunc('tan'); break;
                case 'log': wrapFunc('log'); break;
                case 'ln': wrapFunc('ln'); break;
                case 'sqrt': wrapFunc('sqrt'); break;
                case 'fact': expression += '!'; casioDisplay.value = expression; break;
                case 'pow':
                    try {
                        const r = evaluateExpression(expression);
                        expression = roundDisplay(Math.pow(r, 2)).toString();
                        casioDisplay.value = expression;
                    } catch { casioDisplay.value = 'Lỗi'; expression = ''; }
                    break;
                case 'mc': memory = 0; refreshMemoryLabel(); break;
                case 'mr': expression += roundDisplay(memory).toString(); casioDisplay.value = expression; break;
                case 'mplus':
                    try { memory += evaluateExpression(expression || casioDisplay.value); refreshMemoryLabel(); }
                    catch { showToast('Không thể cộng vào bộ nhớ.', 'error', 'fa-circle-exclamation'); }
                    break;
                case 'mminus':
                    try { memory -= evaluateExpression(expression || casioDisplay.value); refreshMemoryLabel(); }
                    catch { showToast('Không thể trừ vào bộ nhớ.', 'error', 'fa-circle-exclamation'); }
                    break;
                case 'equals':
                    try {
                        const result = evaluateExpression(expression);
                        expression = roundDisplay(result).toString();
                        casioDisplay.value = expression;
                    } catch (err) {
                        casioDisplay.value = err instanceof ExpressionError ? err.message : 'Lỗi';
                        expression = '';
                    }
                    break;
            }
        });
    });

    // Keyboard input support while calculator is open
    casioDisplay.addEventListener('keydown', (e) => e.preventDefault());

    // Copy Result to Rich Text Editor
    document.getElementById('btn-copy-casio').addEventListener('click', () => {
        const val = casioDisplay.value;
        if (val && val !== 'Lỗi') {
            window.richTextEditor.insertTextAtCursor(` ${val} `);
            showToast('Đã chèn kết quả vào ghi chú.', 'info', 'fa-square-root-variable');
        }
    });

    // ----------------------------------------------------------------------
    // 7. FUNCTION GRAPH DIALOG (y = f(x)) — delegates plotting to CanvasEngine
    // ----------------------------------------------------------------------
    const graphModal = document.getElementById('graph-modal');
    const graphInput = document.getElementById('graph-function-input');
    const graphCancel = document.getElementById('graph-cancel');
    const graphConfirm = document.getElementById('graph-confirm');
    let graphTargetEngine = window.canvasEngine;

    const openGraphDialog = () => {
        graphModal.classList.remove('hidden');
        graphInput.value = '';
        setTimeout(() => graphInput.focus(), 50);
    };
    const closeGraphDialog = () => graphModal.classList.add('hidden');

    // Called by DrawEngine when its "Vẽ đồ thị" pen-dock button is clicked
    window.onGraphToolClick = (engine) => {
        graphTargetEngine = engine;
        openGraphDialog();
    };

    graphCancel.addEventListener('click', closeGraphDialog);
    graphModal.addEventListener('click', (e) => { if (e.target === graphModal) closeGraphDialog(); });

    const submitGraph = () => {
        const fn = graphInput.value.trim();
        if (!fn) { showToast('Vui lòng nhập một hàm số.', 'error', 'fa-circle-exclamation'); return; }
        try {
            graphTargetEngine.plotFunction(fn, evaluateExpression);
            closeGraphDialog();
            showToast(`Đã vẽ đồ thị y = ${fn}`, 'info', 'fa-wave-square');
        } catch (err) {
            showToast('Hàm số không hợp lệ, vui lòng kiểm tra lại.', 'error', 'fa-circle-exclamation');
        }
    };
    graphConfirm.addEventListener('click', submitGraph);
    graphInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGraph(); });

    // ----------------------------------------------------------------------
    // 8. WORD COUNT
    // ----------------------------------------------------------------------
    const statusWordCount = document.getElementById('status-wordcount');
    const updateWordCount = () => {
        const text = window.richTextEditor.getPlainText().trim();
        const words = text ? text.split(/\s+/).length : 0;
        statusWordCount.innerHTML = `<i class="fa-solid fa-input-text"></i> ${words} từ`;
    };
    document.getElementById('text-editor').addEventListener('input', updateWordCount);

    // ----------------------------------------------------------------------
    // 9. LOCAL STORAGE PERSISTENCE, CLEARING & AUTOSAVE
    // ----------------------------------------------------------------------
    const btnSave = document.getElementById('btn-save');
    const btnClearAll = document.getElementById('btn-clear-all');
    const autosaveDot = document.getElementById('autosave-dot');
    const autosaveText = document.getElementById('autosave-text');

    const persist = () => {
        const textContent = window.richTextEditor.getContent();
        const canvasData = window.canvasEngine.getCanvasData();
        localStorage.setItem('omnilab_text', textContent);
        localStorage.setItem('omnilab_canvas', canvasData);
        touchActiveFileRecord();
    };

    const markUnsaved = () => {
        autosaveDot.classList.add('unsaved');
        autosaveText.textContent = 'Đang chỉnh sửa…';
    };

    const markSaved = () => {
        autosaveDot.classList.remove('unsaved');
        autosaveText.textContent = 'Đã lưu';
    };

    let autosaveTimer = null;
    const scheduleAutosave = () => {
        markUnsaved();
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            persist();
            markSaved();
        }, 1200);
    };
    window.scheduleAutosave = scheduleAutosave;

    document.getElementById('text-editor').addEventListener('input', scheduleAutosave);

    const saveData = () => {
        clearTimeout(autosaveTimer);
        persist();
        markSaved();
        showToast('Bài học đã được lưu vào trình duyệt.', 'info', 'fa-floppy-disk');
    };

    const loadData = () => {
        const savedText = localStorage.getItem('omnilab_text');
        const savedCanvas = localStorage.getItem('omnilab_canvas');

        if (savedText) window.richTextEditor.setContent(savedText);
        if (savedCanvas) window.canvasEngine.loadCanvasData(savedCanvas);
        updateWordCount();
    };

    btnClearAll.addEventListener('click', async () => {
        const ok = await showConfirm('Toàn bộ chữ viết và hình vẽ trong bài sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?', 'Xóa toàn bộ dữ liệu');
        if (!ok) return;
        window.richTextEditor.clear();
        window.canvasEngine.clearCanvas(true);
        localStorage.removeItem('omnilab_text');
        localStorage.removeItem('omnilab_canvas');
        updateWordCount();
        markSaved();
        showToast('Đã xóa toàn bộ dữ liệu bài học.', 'info', 'fa-trash-can');
    });

    btnSave.addEventListener('click', saveData);

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveData();
        }
        if (e.key === 'Escape') {
            if (!graphModal.classList.contains('hidden')) closeGraphDialog();
            if (!casioModal.classList.contains('hidden')) casioModal.classList.add('hidden');
        }
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (autosaveDot.classList.contains('unsaved')) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Initial Load
    loadData();
});
