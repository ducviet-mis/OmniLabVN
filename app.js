/**
 * OMNILAB - MAIN APPLICATION CONTROLLER
 * Integrates PDF.js, Resizer, Casio Calculator, Mode Switcher, and LocalStorage.
 */

document.addEventListener('DOMContentLoaded', () => {

    // PDF.js Worker Configuration
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    // ----------------------------------------------------------------------
    // 1. STATE VARIABLES
    // ----------------------------------------------------------------------
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.2;

    const pdfCanvas = document.getElementById('pdf-canvas');
    const pdfCtx = pdfCanvas.getContext('2d');
    const pdfPlaceholder = document.getElementById('pdf-placeholder');

    // ----------------------------------------------------------------------
    // 2. MODE SWITCHER (Text <-> Canvas)
    // ----------------------------------------------------------------------
    const btnModeText = document.getElementById('btn-mode-text');
    const btnModeCanvas = document.getElementById('btn-mode-canvas');
    const editorToolbar = document.getElementById('editor-toolbar');
    const canvasToolbar = document.getElementById('canvas-toolbar');

    btnModeText.addEventListener('click', () => {
        btnModeText.classList.add('active');
        btnModeCanvas.classList.remove('active');
        document.body.classList.remove('mode-canvas');
        editorToolbar.classList.add('active');
        canvasToolbar.classList.remove('active');
    });

    btnModeCanvas.addEventListener('click', () => {
        btnModeCanvas.classList.add('active');
        btnModeText.classList.remove('active');
        document.body.classList.add('mode-canvas');
        canvasToolbar.classList.add('active');
        editorToolbar.classList.remove('active');
    });

    // ----------------------------------------------------------------------
    // 3. SPLIT SCREEN RESIZER
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
    // 4. PDF RENDERING ENGINE
    // ----------------------------------------------------------------------
    const renderPage = (num) => {
        pageRendering = true;
        pdfDoc.getPage(num).then((page) => {
            const viewport = page.getViewport({ scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: pdfCtx,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            renderTask.promise.then(() => {
                pageRendering = false;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
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
        if (file && file.type === 'application/pdf') {
            const fileReader = new FileReader();
            fileReader.onload = function () {
                const typedarray = new Uint8Array(this.result);
                pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
                    pdfDoc = pdf;
                    document.getElementById('pdf-page-count').textContent = pdf.numPages;
                    pdfPlaceholder.style.display = 'none';
                    pdfCanvas.style.display = 'block';
                    pageNum = 1;
                    renderPage(pageNum);
                });
            };
            fileReader.readAsArrayBuffer(file);
        }
    });

    document.getElementById('pdf-prev').addEventListener('click', () => {
        if (!pdfDoc || pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    });

    document.getElementById('pdf-next').addEventListener('click', () => {
        if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    });

    document.getElementById('pdf-zoom-in').addEventListener('click', () => {
        if (!pdfDoc) return;
        scale += 0.2;
        document.getElementById('pdf-zoom-level').textContent = `${Math.round(scale * 100)}%`;
        queueRenderPage(pageNum);
    });

    document.getElementById('pdf-zoom-out').addEventListener('click', () => {
        if (!pdfDoc || scale <= 0.6) return;
        scale -= 0.2;
        document.getElementById('pdf-zoom-level').textContent = `${Math.round(scale * 100)}%`;
        queueRenderPage(pageNum);
    });

    // ----------------------------------------------------------------------
    // 5. CASIO CALCULATOR & DRAGGABLE MODAL
    // ----------------------------------------------------------------------
    const casioModal = document.getElementById('casio-modal');
    const casioDisplay = document.getElementById('casio-display');
    const btnToggleCasio = document.getElementById('btn-toggle-casio');
    const btnCloseCasio = document.getElementById('btn-close-casio');
    const casioHeader = document.getElementById('casio-header');

    btnToggleCasio.addEventListener('click', () => {
        casioModal.classList.toggle('hidden');
    });

    btnCloseCasio.addEventListener('click', () => {
        casioModal.classList.add('hidden');
    });

    // Make Casio Modal Draggable
    let isDraggingCasio = false;
    let casioOffsetX = 0, casioOffsetY = 0;

    casioHeader.addEventListener('mousedown', (e) => {
        isDraggingCasio = true;
        casioOffsetX = e.clientX - casioModal.offsetLeft;
        casioOffsetY = e.clientY - casioModal.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingCasio) {
            casioModal.style.left = `${e.clientX - casioOffsetX}px`;
            casioModal.style.top = `${e.clientY - casioOffsetY}px`;
            casioModal.style.right = 'auto';
        }
    });

    document.addEventListener('mouseup', () => isDraggingCasio = false);

    // Casio Calculation Execution
    let expression = '';

    document.querySelectorAll('.casio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.value;
            const action = btn.dataset.action;

            if (val) {
                expression += val;
                casioDisplay.value = expression;
            } else if (action === 'clear') {
                expression = '';
                casioDisplay.value = '0';
            } else if (action === 'delete') {
                expression = expression.slice(0, -1);
                casioDisplay.value = expression || '0';
            } else if (action === 'sqrt') {
                try {
                    expression = Math.sqrt(eval(expression)).toString();
                    casioDisplay.value = expression;
                } catch {
                    casioDisplay.value = 'Error';
                }
            } else if (action === 'pow') {
                try {
                    expression = Math.pow(eval(expression), 2).toString();
                    casioDisplay.value = expression;
                } catch {
                    casioDisplay.value = 'Error';
                }
            } else if (action === 'equals') {
                try {
                    expression = eval(expression).toString();
                    casioDisplay.value = expression;
                } catch {
                    casioDisplay.value = 'Error';
                    expression = '';
                }
            }
        });
    });

    // Copy Result to Rich Text Editor
    document.getElementById('btn-copy-casio').addEventListener('click', () => {
        const val = casioDisplay.value;
        if (val && val !== 'Error') {
            window.richTextEditor.insertTextAtCursor(` ${val} `);
        }
    });

    // ----------------------------------------------------------------------
    // 6. LOCAL STORAGE PERSISTENCE & CLEARING
    // ----------------------------------------------------------------------
    const btnSave = document.getElementById('btn-save');
    const btnClearAll = document.getElementById('btn-clear-all');

    const saveData = () => {
        const textContent = window.richTextEditor.getContent();
        const canvasData = window.canvasEngine.getCanvasData();

        localStorage.setItem('omnilab_text', textContent);
        localStorage.setItem('omnilab_canvas', canvasData);

        alert('Bài học đã được lưu thành công vào trình duyệt!');
    };

    const loadData = () => {
        const savedText = localStorage.getItem('omnilab_text');
        const savedCanvas = localStorage.getItem('omnilab_canvas');

        if (savedText) window.richTextEditor.setContent(savedText);
        if (savedCanvas) window.canvasEngine.loadCanvasData(savedCanvas);
    };

    btnClearAll.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ chữ viết và hình vẽ không?')) {
            window.richTextEditor.clear();
            window.canvasEngine.clearCanvas();
            localStorage.removeItem('omnilab_text');
            localStorage.removeItem('omnilab_canvas');
        }
    });

    btnSave.addEventListener('click', saveData);

    // Initial Load
    loadData();
});
