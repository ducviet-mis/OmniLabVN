/**
 * OMNILAB — MAIN APPLICATION CONTROLLER (SUPABASE INTEGRATED — FULL FEATURES)
 * Quản lý đọc PDF, Vẽ Canvas, Rich Text, Máy tính khoa học, Vẽ đồ thị,
 * Theme, Resizer, và lưu đồng bộ lên Supabase.
 */

// ⚠️ ĐIỀN THÔNG TIN SUPABASE CỦA BẠN VÀO ĐÂY:
const SUPABASE_URL = 'https://vnwqhacajbrlmtoixuzy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZud3FoYWNhamJybG10b2l4dXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTU2OTEsImV4cCI6MjEwMTU3MTY5MX0.OQZVSpBBYRqcpD-cf7FkOv2iDX20zU5_zZaz1KJuXTA';

// Đổi tên biến thành supabaseClient để tránh trùng lặp Identifier SyntaxError
const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

document.addEventListener('DOMContentLoaded', async () => {

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }

    // ----------------------------------------------------------------------
    // 0. TOAST & CONFIRM UI
    // ----------------------------------------------------------------------
    const toastStack = document.getElementById('toast-stack');
    const showToast = (message, type = 'info', icon = 'fa-circle-check') => {
        if (!toastStack) return;
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
            if (!confirmModal) return resolve(false);
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
    const themeIcon = btnToggleTheme ? btnToggleTheme.querySelector('i') : null;

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeIcon) themeIcon.className = 'fa-solid fa-sun';
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (themeIcon) themeIcon.className = 'fa-solid fa-moon';
        }
    };

    const savedTheme = localStorage.getItem('omnilab_theme') || 'light';
    applyTheme(savedTheme);

    if (btnToggleTheme) {
        btnToggleTheme.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const next = isDark ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('omnilab_theme', next);
        });
    }

    // ----------------------------------------------------------------------
    // 2. STATE & ELEMENTS
    // ----------------------------------------------------------------------
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.2;
    let currentUploadedPdfFile = null;

    const pdfCanvas = document.getElementById('pdf-canvas');
    const pdfCtx = pdfCanvas ? pdfCanvas.getContext('2d') : null;
    const pdfPageStage = document.getElementById('pdf-page-stage');
    const pdfDrawCanvas = document.getElementById('pdf-draw-canvas');
    const pdfPlaceholder = document.getElementById('pdf-placeholder');
    const pdfLoading = document.getElementById('pdf-loading');
    const pdfDocName = document.getElementById('pdf-doc-name');

    const activeFileId = new URLSearchParams(window.location.search).get('fileId');
    const noteTitleBadge = document.getElementById('note-title-badge');
    const noteTitleText = document.getElementById('note-title-text');
    let currentNoteTitle = '';

    // Đổi tên ghi chú — click vào badge tiêu đề, lưu thẳng lên Supabase
    if (noteTitleBadge && noteTitleText) {
        noteTitleBadge.title = 'Nhấp để đổi tên ghi chú';
        noteTitleBadge.style.cursor = 'pointer';
        noteTitleBadge.addEventListener('click', async () => {
            const newTitle = prompt('Đổi tên ghi chú:', currentNoteTitle);
            if (!newTitle || !newTitle.trim()) return;
            currentNoteTitle = newTitle.trim();
            noteTitleText.textContent = currentNoteTitle;

            if (activeFileId && supabaseClient) {
                const { error } = await supabaseClient
                    .from('files')
                    .update({ title: currentNoteTitle })
                    .eq('id', activeFileId);
                if (error) {
                    showToast('Không thể đổi tên ghi chú.', 'error', 'fa-circle-exclamation');
                } else {
                    showToast('Đã đổi tên ghi chú.', 'info', 'fa-pen');
                }
            }
        });
    }

    // In-memory per-page store for direct PDF annotations (pageNum -> dataURL).
    // Reset whenever a new document is loaded. (Chỉ giữ trong phiên làm việc,
    // giống hành vi bản gốc — không đồng bộ lên Supabase.)
    let pdfDrawings = new Map();

    const savePdfPageDrawing = (num) => {
        if (!pdfDrawCanvas || !pdfDrawCanvas.width || !pdfDrawCanvas.height) return;
        pdfDrawings.set(num, pdfDrawCanvas.toDataURL());
    };

    const loadPdfPageDrawing = (num) => {
        if (!window.pdfDrawEngine || !pdfDrawCanvas) return;
        window.pdfDrawEngine.ctx.clearRect(0, 0, pdfDrawCanvas.width, pdfDrawCanvas.height);
        const data = pdfDrawings.get(num);
        if (data) window.pdfDrawEngine.loadCanvasData(data);
    };

    // ----------------------------------------------------------------------
    // 3. SPLIT SCREEN RESIZER
    // ----------------------------------------------------------------------
    const resizer = document.getElementById('resizer');
    const pdfPane = document.getElementById('pdf-container');
    let isResizing = false;

    if (resizer && pdfPane) {
        resizer.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const mainContainer = document.querySelector('.main-container');
            if (!mainContainer) return;
            const containerWidth = mainContainer.clientWidth;
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
    }

    // ----------------------------------------------------------------------
    // 3B. VIEW MODE SWITCHER — Song song / Chỉ PDF / Chỉ Ghi chú
    //     + nút "Mở nhanh" nổi để bật lại khung còn lại khi đang ở chế độ đơn.
    //     Trạng thái được ghi nhớ trong localStorage giữa các phiên làm việc.
    // ----------------------------------------------------------------------
    const mainContainer = document.querySelector('.main-container');
    const viewModeButtons = document.querySelectorAll('.viewmode-btn');
    const quickSwitchBtn = document.getElementById('btn-quick-switch');
    const quickSwitchLabel = document.getElementById('quick-switch-label');
    const quickSwitchIcon = quickSwitchBtn ? quickSwitchBtn.querySelector('i') : null;

    const VIEW_MODES = ['split', 'pdf', 'note'];
    let lastSplitWidth = null; // ghi nhớ tỉ lệ cột PDF trước khi rời chế độ song song

    const applyViewMode = (mode, { persist = true } = {}) => {
        if (!mainContainer) return;
        if (!VIEW_MODES.includes(mode)) mode = 'split';

        const currentMode = mainContainer.getAttribute('data-view-mode');

        // Trước khi rời chế độ song song, lưu lại tỉ lệ cột hiện tại để khôi phục sau
        if (currentMode === 'split' && mode !== 'split' && pdfPane && pdfPane.style.width) {
            lastSplitWidth = pdfPane.style.width;
        }

        mainContainer.setAttribute('data-view-mode', mode);

        viewModeButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Khôi phục / gỡ tỉ lệ cột theo chế độ
        if (pdfPane) {
            pdfPane.style.width = (mode === 'split') ? (lastSplitWidth || '50%') : '';
        }

        // Nút "Mở nhanh" — chỉ hiển thị khi đang ở chế độ xem đơn (pdf hoặc note)
        if (quickSwitchBtn) {
            if (mode === 'pdf') {
                quickSwitchBtn.classList.remove('hidden');
                quickSwitchBtn.dataset.target = 'note';
                quickSwitchBtn.title = 'Mở nhanh Ghi chú';
                if (quickSwitchLabel) quickSwitchLabel.textContent = 'Mở Ghi chú';
                if (quickSwitchIcon) quickSwitchIcon.className = 'fa-solid fa-note-sticky';
            } else if (mode === 'note') {
                quickSwitchBtn.classList.remove('hidden');
                quickSwitchBtn.dataset.target = 'pdf';
                quickSwitchBtn.title = 'Mở nhanh PDF';
                if (quickSwitchLabel) quickSwitchLabel.textContent = 'Mở PDF';
                if (quickSwitchIcon) quickSwitchIcon.className = 'fa-solid fa-file-pdf';
            } else {
                quickSwitchBtn.classList.add('hidden');
            }
        }

        if (persist) localStorage.setItem('omnilab_view_mode', mode);

        // Bố cục vừa đổi kích thước — vẽ lại canvas/PDF cho khớp khung mới (nếu có)
        requestAnimationFrame(() => {
            if (window.canvasEngine && typeof window.canvasEngine.resizeToContainer === 'function') {
                window.canvasEngine.resizeToContainer();
            }
            if (pdfDoc && typeof queueRenderPage === 'function') {
                queueRenderPage(pageNum);
            }
        });
    };
    window.applyViewMode = applyViewMode;

    viewModeButtons.forEach((btn) => {
        btn.addEventListener('click', () => applyViewMode(btn.dataset.mode));
    });

    if (quickSwitchBtn) {
        quickSwitchBtn.addEventListener('click', () => {
            const target = quickSwitchBtn.dataset.target;
            if (target) applyViewMode(target);
        });
    }

    // Khôi phục chế độ xem đã lưu từ phiên trước (mặc định: song song)
    const savedViewMode = localStorage.getItem('omnilab_view_mode') || 'split';
    applyViewMode(savedViewMode, { persist: false });

    // ----------------------------------------------------------------------
    // 4. PDF RENDER ENGINE
    // ----------------------------------------------------------------------
    const renderPage = (num) => {
        if (!pdfDoc || !pdfCtx) return;
        pageRendering = true;
        pdfDoc.getPage(num).then((page) => {
            const viewport = page.getViewport({ scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            if (window.pdfDrawEngine && window.pdfDrawEngine.resizeTo) {
                window.pdfDrawEngine.resizeTo(viewport.width, viewport.height);
            }

            const renderTask = page.render({ canvasContext: pdfCtx, viewport });
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

        const pageNumLabel = document.getElementById('pdf-page-num');
        if (pageNumLabel) pageNumLabel.textContent = num;
    };

    const queueRenderPage = (num) => {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    };

    const loadPdfFromArrayBuffer = (buffer, fileName = "Tài liệu PDF") => {
        if (!pdfLoading || !pdfPlaceholder || !pdfPageStage) return;
        pdfLoading.classList.remove('hidden');
        pdfPlaceholder.style.display = 'none';

        pdfjsLib.getDocument({ data: buffer }).promise.then((pdf) => {
            pdfDoc = pdf;
            pdfDrawings = new Map(); // fresh document — discard previous page annotations
            const pageCountLabel = document.getElementById('pdf-page-count');
            if (pageCountLabel) pageCountLabel.textContent = pdf.numPages;

            pdfLoading.classList.add('hidden');
            pdfPageStage.style.display = 'block';
            if (pdfDocName) pdfDocName.textContent = fileName;
            pageNum = 1;
            renderPage(pageNum);
        }).catch((err) => {
            console.error("Lỗi nạp PDF:", err);
            pdfLoading.classList.add('hidden');
            pdfPlaceholder.style.display = 'flex';
            showToast('Không thể hiển thị file PDF này.', 'error', 'fa-circle-exclamation');
        });
    };

    const loadPdfFromUrl = (url, fileName = "PDF Đám mây", targetPage = 1) => {
        if (!pdfLoading || !pdfPlaceholder || !pdfPageStage) return;
        pdfLoading.classList.remove('hidden');
        pdfPlaceholder.style.display = 'none';

        pdfjsLib.getDocument(url).promise.then((pdf) => {
            pdfDoc = pdf;
            pdfDrawings = new Map();
            const pageCountLabel = document.getElementById('pdf-page-count');
            if (pageCountLabel) pageCountLabel.textContent = pdf.numPages;

            pdfLoading.classList.add('hidden');
            pdfPageStage.style.display = 'block';
            if (pdfDocName) pdfDocName.textContent = fileName;
            pageNum = targetPage;
            renderPage(pageNum);
        }).catch((err) => {
            console.error("Lỗi nạp PDF từ URL:", err);
            pdfLoading.classList.add('hidden');
            pdfPlaceholder.style.display = 'flex';
            showToast('Không thể tải file PDF từ máy chủ.', 'error', 'fa-circle-exclamation');
        });
    };

    // LẮNG NGHE NÚT "MỞ PDF" TỪ MÁY TÍNH
    const pdfUploadInput = document.getElementById('pdf-upload');
    if (pdfUploadInput) {
        pdfUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.type !== 'application/pdf') {
                showToast('Vui lòng chọn tệp định dạng PDF.', 'error', 'fa-circle-exclamation');
                return;
            }

            currentUploadedPdfFile = file;

            const reader = new FileReader();
            reader.onload = function () {
                loadPdfFromArrayBuffer(new Uint8Array(this.result), file.name);
                showToast(`Đã nạp file "${file.name}". Bấm "Lưu Bài" để đồng bộ lên mây!`, 'info');
                scheduleAutosave();
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Chuyển trang & Zoom PDF (lưu nét vẽ trang hiện tại trước khi chuyển)
    const btnPrev = document.getElementById('pdf-prev');
    const btnNext = document.getElementById('pdf-next');
    if (btnPrev) {
        btnPrev.onclick = () => {
            if (!pdfDoc || pageNum <= 1) return;
            savePdfPageDrawing(pageNum);
            pageNum--;
            queueRenderPage(pageNum);
        };
    }
    if (btnNext) {
        btnNext.onclick = () => {
            if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
            savePdfPageDrawing(pageNum);
            pageNum++;
            queueRenderPage(pageNum);
        };
    }

    const btnZoomIn = document.getElementById('pdf-zoom-in');
    const btnZoomOut = document.getElementById('pdf-zoom-out');
    const zoomLevelLabel = document.getElementById('pdf-zoom-level');

    if (btnZoomIn) {
        btnZoomIn.onclick = () => {
            if (!pdfDoc || scale >= 3) return;
            savePdfPageDrawing(pageNum);
            scale += 0.2;
            if (zoomLevelLabel) zoomLevelLabel.textContent = `${Math.round(scale * 100)}%`;
            queueRenderPage(pageNum);
        };
    }
    if (btnZoomOut) {
        btnZoomOut.onclick = () => {
            if (!pdfDoc || scale <= 0.6) return;
            savePdfPageDrawing(pageNum);
            scale -= 0.2;
            if (zoomLevelLabel) zoomLevelLabel.textContent = `${Math.round(scale * 100)}%`;
            queueRenderPage(pageNum);
        };
    }

    // Điều hướng PDF bằng phím mũi tên (chỉ khi không gõ trong ô ghi chú)
    document.addEventListener('keydown', (e) => {
        const isTyping = document.activeElement && document.activeElement.id === 'text-editor';
        if (isTyping || !pdfDoc) return;
        if (e.key === 'ArrowLeft' && btnPrev) btnPrev.onclick();
        if (e.key === 'ArrowRight' && btnNext) btnNext.onclick();
    });

    // ----------------------------------------------------------------------
    // 5. SCIENTIFIC CALCULATOR (safe expression parser — no eval)
    // ----------------------------------------------------------------------
    const casioModal = document.getElementById('casio-modal');
    const casioDisplay = document.getElementById('casio-display');
    const casioMemoryLabel = document.getElementById('casio-memory');
    const btnToggleCasio = document.getElementById('btn-toggle-casio');
    const btnCloseCasio = document.getElementById('btn-close-casio');
    const casioHeader = document.getElementById('casio-header');

    if (btnToggleCasio && casioModal) {
        btnToggleCasio.addEventListener('click', () => {
            casioModal.classList.toggle('hidden');
        });
    }
    if (btnCloseCasio && casioModal) {
        btnCloseCasio.addEventListener('click', () => {
            casioModal.classList.add('hidden');
        });
    }

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

    if (casioHeader && casioModal) {
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
    }

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

    const roundDisplay = (n) => {
        if (typeof n !== 'number') return n;
        return Math.round(n * 1e10) / 1e10;
    };
    const refreshMemoryLabel = () => {
        if (casioMemoryLabel) casioMemoryLabel.textContent = `M: ${roundDisplay(memory)}`;
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
    if (casioDisplay) casioDisplay.addEventListener('keydown', (e) => e.preventDefault());

    // Copy Result to Rich Text Editor
    const btnCopyCasio = document.getElementById('btn-copy-casio');
    if (btnCopyCasio) {
        btnCopyCasio.addEventListener('click', () => {
            const val = casioDisplay.value;
            if (val && val !== 'Lỗi' && window.richTextEditor) {
                window.richTextEditor.insertTextAtCursor(` ${val} `);
                showToast('Đã chèn kết quả vào ghi chú.', 'info', 'fa-square-root-variable');
            }
        });
    }

    // ----------------------------------------------------------------------
    // 6. FUNCTION GRAPH DIALOG (y = f(x)) — delegates plotting to CanvasEngine
    // ----------------------------------------------------------------------
    const graphModal = document.getElementById('graph-modal');
    const graphInput = document.getElementById('graph-function-input');
    const graphCancel = document.getElementById('graph-cancel');
    const graphConfirm = document.getElementById('graph-confirm');
    let graphTargetEngine = window.canvasEngine;

    const openGraphDialog = () => {
        if (!graphModal) return;
        graphModal.classList.remove('hidden');
        graphInput.value = '';
        setTimeout(() => graphInput.focus(), 50);
    };
    const closeGraphDialog = () => { if (graphModal) graphModal.classList.add('hidden'); };

    // Called by DrawEngine when its "Vẽ đồ thị" pen-dock button is clicked
    window.onGraphToolClick = (engine) => {
        graphTargetEngine = engine;
        openGraphDialog();
    };

    if (graphCancel) graphCancel.addEventListener('click', closeGraphDialog);
    if (graphModal) graphModal.addEventListener('click', (e) => { if (e.target === graphModal) closeGraphDialog(); });

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
    if (graphConfirm) graphConfirm.addEventListener('click', submitGraph);
    if (graphInput) graphInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGraph(); });

    // ----------------------------------------------------------------------
    // 7. WORD COUNT
    // ----------------------------------------------------------------------
    const statusWordCount = document.getElementById('status-wordcount');
    const updateWordCount = () => {
        if (!statusWordCount || !window.richTextEditor) return;
        const text = window.richTextEditor.getPlainText().trim();
        const words = text ? text.split(/\s+/).length : 0;
        statusWordCount.innerHTML = `<i class="fa-solid fa-input-text"></i> ${words} từ`;
    };
    const textEditorDiv = document.getElementById('text-editor');
    if (textEditorDiv) textEditorDiv.addEventListener('input', updateWordCount);

    // ----------------------------------------------------------------------
    // 8. SUPABASE LOAD, SAVE & AUTOSAVE
    // ----------------------------------------------------------------------
    const loadWorkspaceFromSupabase = async () => {
        if (!activeFileId || !supabaseClient) return;

        const { data: file, error } = await supabaseClient
            .from('files')
            .select('*')
            .eq('id', activeFileId)
            .single();

        if (error || !file) return;

        currentNoteTitle = file.title || '';
        if (noteTitleBadge && noteTitleText) {
            noteTitleBadge.classList.remove('hidden');
            noteTitleText.textContent = currentNoteTitle;
        }

        // Tải lại file PDF nếu có
        if (file.pdf_url) {
            loadPdfFromUrl(file.pdf_url, "Tài liệu PDF", file.last_page || 1);
        }

        // Tải lại Text & Nét vẽ
        if (file.text_data && window.richTextEditor) {
            window.richTextEditor.setContent(file.text_data);
        }
        if (file.canvas_data && window.canvasEngine) {
            window.canvasEngine.loadCanvasData(file.canvas_data);
        }
        updateWordCount();
    };

    const persistToSupabase = async () => {
        if (!activeFileId || !supabaseClient) return;

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return showToast("Vui lòng đăng nhập để lưu bài!", "error");

        let pdfPublicUrl = null;

        // Upload PDF nếu người dùng vừa nạp file mới
        if (currentUploadedPdfFile) {
            const filePath = `${user.id}/${Date.now()}_${currentUploadedPdfFile.name}`;
            const { error: uploadErr } = await supabaseClient.storage
                .from('pdf-files')
                .upload(filePath, currentUploadedPdfFile);

            if (!uploadErr) {
                const { data: urlData } = supabaseClient.storage.from('pdf-files').getPublicUrl(filePath);
                pdfPublicUrl = urlData.publicUrl;
                currentUploadedPdfFile = null; // đã upload xong, tránh upload lại lần sau
            }
        }

        const textContent = window.richTextEditor ? window.richTextEditor.getContent() : '';
        const canvasData = window.canvasEngine ? window.canvasEngine.getCanvasData() : '';
        const plainLen = window.richTextEditor ? window.richTextEditor.getPlainText().length : 0;
        const sizeKB = Math.max(1, Math.round((plainLen / 1024) * 10) / 10);

        const updatePayload = {
            canvas_data: canvasData,
            text_data: textContent,
            last_page: pageNum,
            size_kb: sizeKB,
            updated_at: new Date()
        };

        if (pdfPublicUrl) updatePayload.pdf_url = pdfPublicUrl;

        const { error } = await supabaseClient
            .from('files')
            .update(updatePayload)
            .eq('id', activeFileId);

        return !error;
    };

    const autosaveDot = document.getElementById('autosave-dot');
    const autosaveText = document.getElementById('autosave-text');
    const markUnsaved = () => {
        if (autosaveDot) autosaveDot.classList.add('unsaved');
        if (autosaveText) autosaveText.textContent = 'Đang chỉnh sửa…';
    };
    const markSaved = () => {
        if (autosaveDot) autosaveDot.classList.remove('unsaved');
        if (autosaveText) autosaveText.textContent = 'Đã lưu';
    };

    let autosaveTimer = null;
    const scheduleAutosave = () => {
        markUnsaved();
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async () => {
            const ok = await persistToSupabase();
            if (ok) markSaved();
        }, 1500);
    };
    window.scheduleAutosave = scheduleAutosave;

    if (textEditorDiv) textEditorDiv.addEventListener('input', scheduleAutosave);

    const saveData = async () => {
        clearTimeout(autosaveTimer);
        const ok = await persistToSupabase();
        if (ok) {
            markSaved();
            showToast('Đã lưu bài học lên mây thành công!', 'info', 'fa-cloud-arrow-up');
        } else {
            showToast('Lỗi khi lưu bài học.', 'error');
        }
    };

    const btnSave = document.getElementById('btn-save');
    if (btnSave) btnSave.addEventListener('click', saveData);

    // Nút xóa toàn bộ dữ liệu (chữ viết + hình vẽ), đồng bộ lên Supabase
    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', async () => {
            const ok = await showConfirm('Toàn bộ chữ viết và hình vẽ trong bài sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?', 'Xóa toàn bộ dữ liệu');
            if (!ok) return;
            if (window.richTextEditor) window.richTextEditor.clear();
            if (window.canvasEngine) window.canvasEngine.clearCanvas(true);
            updateWordCount();
            await persistToSupabase();
            markSaved();
            showToast('Đã xóa toàn bộ dữ liệu bài học.', 'info', 'fa-trash-can');
        });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (ctrl && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveData();
        }
        if (e.key === 'Escape') {
            if (graphModal && !graphModal.classList.contains('hidden')) closeGraphDialog();
            if (casioModal && !casioModal.classList.contains('hidden')) casioModal.classList.add('hidden');
        }
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (autosaveDot && autosaveDot.classList.contains('unsaved')) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Tải bài học ban đầu
    await loadWorkspaceFromSupabase();
});
