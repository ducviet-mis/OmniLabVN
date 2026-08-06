/**
 * OMNILAB — MAIN APPLICATION CONTROLLER (SUPABASE INTEGRATED)
 * Quản lý đọc PDF, Vẽ Canvas, Rich Text và lưu đồng bộ 2 phần lên Supabase.
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
    // 1. STATE & ELEMENTS
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
    const pdfPlaceholder = document.getElementById('pdf-placeholder');
    const pdfLoading = document.getElementById('pdf-loading');
    const pdfDocName = document.getElementById('pdf-doc-name');

    const activeFileId = new URLSearchParams(window.location.search).get('fileId');
    const noteTitleBadge = document.getElementById('note-title-badge');
    const noteTitleText = document.getElementById('note-title-text');

    // ----------------------------------------------------------------------
    // 2. PDF RENDER ENGINE
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

    const loadPdfFromArrayBuffer = (buffer, fileName = "Tài liệu PDF") => {
        if (!pdfLoading || !pdfPlaceholder || !pdfPageStage) return;
        pdfLoading.classList.remove('hidden');
        pdfPlaceholder.style.display = 'none';

        pdfjsLib.getDocument({ data: buffer }).promise.then((pdf) => {
            pdfDoc = pdf;
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
            const pageCountLabel = document.getElementById('pdf-page-count');
            if (pageCountLabel) pageCountLabel.textContent = pdf.numPages;

            pdfLoading.classList.add('hidden');
            pdfPageStage.style.display = 'block';
            if (pdfDocName) pdfDocName.textContent = fileName;
            pageNum = targetPage;
            renderPage(pageNum);
        }).catch(() => {
            pdfLoading.classList.add('hidden');
            pdfPlaceholder.style.display = 'flex';
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
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Chuyển trang & Zoom PDF
    const btnPrev = document.getElementById('pdf-prev');
    const btnNext = document.getElementById('pdf-next');
    if (btnPrev) btnPrev.onclick = () => { if (pdfDoc && pageNum > 1) { pageNum--; renderPage(pageNum); } };
    if (btnNext) btnNext.onclick = () => { if (pdfDoc && pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); } };

    const btnZoomIn = document.getElementById('pdf-zoom-in');
    const btnZoomOut = document.getElementById('pdf-zoom-out');
    const zoomLevelLabel = document.getElementById('pdf-zoom-level');

    if (btnZoomIn) {
        btnZoomIn.onclick = () => {
            if (!pdfDoc || scale >= 3) return;
            scale += 0.2;
            if (zoomLevelLabel) zoomLevelLabel.textContent = `${Math.round(scale * 100)}%`;
            renderPage(pageNum);
        };
    }
    if (btnZoomOut) {
        btnZoomOut.onclick = () => {
            if (!pdfDoc || scale <= 0.6) return;
            scale -= 0.2;
            if (zoomLevelLabel) zoomLevelLabel.textContent = `${Math.round(scale * 100)}%`;
            renderPage(pageNum);
        };
    }

    // ----------------------------------------------------------------------
    // 3. SUPABASE LOAD & SAVE
    // ----------------------------------------------------------------------
    const loadWorkspaceFromSupabase = async () => {
        if (!activeFileId || !supabaseClient) return;

        const { data: file, error } = await supabaseClient
            .from('files')
            .select('*')
            .eq('id', activeFileId)
            .single();

        if (error || !file) return;

        if (noteTitleBadge && noteTitleText) {
            noteTitleBadge.classList.remove('hidden');
            noteTitleText.textContent = file.title;
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
    };

    const persistToSupabase = async () => {
        if (!activeFileId || !supabaseClient) return;

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return showToast("Vui lòng đăng nhập để lưu bài!", "error");

        let pdfPublicUrl = null;

        // Upload PDF nếu người dùng vừa nạp file mới
        if (currentUploadedPdfFile) {
            const filePath = `${user.id}/${Date.now()}_${currentUploadedPdfFile.name}`;
            const { data: uploadRes, error: uploadErr } = await supabaseClient.storage
                .from('pdf-files')
                .upload(filePath, currentUploadedPdfFile);

            if (!uploadErr) {
                const { data: urlData } = supabaseClient.storage.from('pdf-files').getPublicUrl(filePath);
                pdfPublicUrl = urlData.publicUrl;
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

        if (!error) {
            showToast('Đã lưu bài học lên mây thành công!', 'info', 'fa-cloud-arrow-up');
        } else {
            showToast('Lỗi khi lưu bài học.', 'error');
        }
    };

    const btnSave = document.getElementById('btn-save');
    if (btnSave) btnSave.onclick = persistToSupabase;

    const autosaveDot = document.getElementById('autosave-dot');
    const autosaveText = document.getElementById('autosave-text');
    const markUnsaved = () => {
        if (autosaveDot) autosaveDot.classList.add('unsaved');
        if (autosaveText) autosaveText.textContent = 'Đang chỉnh sửa…';
    };
    const textEditorDiv = document.getElementById('text-editor');
    if (textEditorDiv) textEditorDiv.addEventListener('input', markUnsaved);

    // Tải bài học ban đầu
    await loadWorkspaceFromSupabase();
});
