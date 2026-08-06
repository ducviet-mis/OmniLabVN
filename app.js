/**
 * OMNILAB — MAIN APPLICATION CONTROLLER (SUPABASE INTEGRATED)
 * Quản lý đọc PDF, Vẽ Canvas, Rich Text và lưu đồng bộ 2 phần lên Supabase.
 */

// ⚠️ ĐIỀN THÔNG TIN SUPABASE CỦA BẠN VÀO ĐÂY:
const SUPABASE_URL = 'https://vnwqhacajbrlmtoixuzy.supabase.co';
const SUPABASE_ANON_KEY = 'DÁN_CHUỖI_ANON_PUBLIC_CỦA_BẠN_VÀO_ĐÂY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    // ----------------------------------------------------------------------
    // 0. TOAST & CONFIRM UI
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
            confirmOk.addEventListener('click', () => cleanup(true));
            confirmCancel.addEventListener('click', () => cleanup(false));
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
    let currentUploadedPdfFile = null; // Lưu file PDF gốc vừa chọn để upload

    const pdfCanvas = document.getElementById('pdf-canvas');
    const pdfCtx = pdfCanvas.getContext('2d');
    const pdfPageStage = document.getElementById('pdf-page-stage');
    const pdfDrawCanvas = document.getElementById('pdf-draw-canvas');
    const pdfPlaceholder = document.getElementById('pdf-placeholder');
    const pdfLoading = document.getElementById('pdf-loading');
    const pdfDocName = document.getElementById('pdf-doc-name');

    const activeFileId = new URLSearchParams(window.location.search).get('fileId');
    const noteTitleBadge = document.getElementById('note-title-badge');
    const noteTitleText = document.getElementById('note-title-text');

    // ----------------------------------------------------------------------
    // 2. SUPABASE: LOAD & PERSIST WORKSPACE
    // ----------------------------------------------------------------------
    // Hàm nạp dữ liệu PDF từ đường dẫn Supabase Storage
    const loadPdfFromUrl = (url, targetPage = 1) => {
        pdfLoading.classList.remove('hidden');
        pdfPlaceholder.style.display = 'none';

        pdfjsLib.getDocument(url).promise.then((pdf) => {
            pdfDoc = pdf;
            document.getElementById('pdf-page-count').textContent = pdf.numPages;
            pdfLoading.classList.add('hidden');
            pdfPageStage.style.display = 'block';
            pageNum = targetPage;
            renderPage(pageNum);
        }).catch(() => {
            pdfLoading.classList.add('hidden');
            pdfPlaceholder.style.display = 'flex';
        });
    };

    // Tự động tải bài học từ Supabase khi mở trang (?fileId=...)
    const loadWorkspaceFromSupabase = async () => {
        if (!activeFileId) return;

        const { data: file, error } = await supabase
            .from('files')
            .select('*')
            .eq('id', activeFileId)
            .single();

        if (error || !file) return;

        noteTitleBadge.classList.remove('hidden');
        noteTitleText.textContent = file.title;

        // Cột trái: Tải PDF nếu đã có
        if (file.pdf_url) {
            pdfDocName.textContent = "PDF từ Đám mây";
            loadPdfFromUrl(file.pdf_url, file.last_page || 1);
        }

        // Cột phải: Khôi phục Canvas & Text
        if (file.canvas_data) window.canvasEngine.loadCanvasData(file.canvas_data);
        if (file.text_data) window.richTextEditor.setContent(file.text_data);
    };

    // Đẩy PDF + Nét vẽ + Text lên Supabase
    const persistToSupabase = async () => {
        if (!activeFileId) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return showToast("Vui lòng đăng nhập để lưu bài!", "error");

        let pdfPublicUrl = null;

        // 1. Upload file PDF nếu có file mới
        if (currentUploadedPdfFile) {
            const filePath = `${user.id}/${Date.now()}_${currentUploadedPdfFile.name}`;
            const { data: uploadRes, error: uploadErr } = await supabase.storage
                .from('pdf-files')
                .upload(filePath, currentUploadedPdfFile);

            if (!uploadErr) {
                const { data: urlData } = supabase.storage.from('pdf-files').getPublicUrl(filePath);
                pdfPublicUrl = urlData.publicUrl;
            }
        }

        const textContent = window.richTextEditor.getContent();
        const canvasData = window.canvasEngine.getCanvasData();
        const plainLen = window.richTextEditor.getPlainText().length;
        const sizeKB = Math.max(1, Math.round((plainLen / 1024) * 10) / 10);

        const updatePayload = {
            canvas_data: canvasData,
            text_data: textContent,
            last_page: pageNum,
            size_kb: sizeKB,
            updated_at: new Date()
        };

        if (pdfPublicUrl) updatePayload.pdf_url = pdfPublicUrl;

        const { error } = await supabase
            .from('files')
            .update(updatePayload)
            .eq('id', activeFileId);

        if (!error) {
            markSaved();
            showToast('Đã lưu bài học lên đám mây Supabase!', 'info', 'fa-cloud-arrow-up');
        } else {
            showToast('Lỗi lưu bài học.', 'error');
        }
    };

    // ----------------------------------------------------------------------
    // 3. PDF ENGINE & EVENTS
    // ----------------------------------------------------------------------
    const renderPage = (num) => {
        pageRendering = true;
        pdfDoc.getPage(num).then((page) => {
            const viewport = page.getViewport({ scale });
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;
            window.pdfDrawEngine.resizeTo(viewport.width, viewport.height);

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
        document.getElementById('pdf-page-num').textContent = num;
    };

    document.getElementById('pdf-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') return;

        currentUploadedPdfFile = file; // Lưu file để tý đẩy lên Supabase Storage
        pdfLoading.classList.remove('hidden');
        pdfPlaceholder.style.display = 'none';

        const fileReader = new FileReader();
        fileReader.onload = function () {
            const typedarray = new Uint8Array(this.result);
            pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
                pdfDoc = pdf;
                document.getElementById('pdf-page-count').textContent = pdf.numPages;
                pdfLoading.classList.add('hidden');
                pdfPageStage.style.display = 'block';
                pdfDocName.textContent = file.name;
                pageNum = 1;
                renderPage(pageNum);
                showToast(`Đã nạp file PDF thành công. Bấm "Lưu Bài" để đẩy lên mây!`, 'info');
            });
        };
        fileReader.readAsArrayBuffer(file);
    });

    document.getElementById('pdf-prev').onclick = () => { if (pdfDoc && pageNum > 1) { pageNum--; renderPage(pageNum); } };
    document.getElementById('pdf-next').onclick = () => { if (pdfDoc && pageNum < pdfDoc.numPages) { pageNum++; renderPage(pageNum); } };

    // ----------------------------------------------------------------------
    // 4. SAVE & AUTOSAVE CONTROLS
    // ----------------------------------------------------------------------
    const autosaveDot = document.getElementById('autosave-dot');
    const autosaveText = document.getElementById('autosave-text');

    const markUnsaved = () => { autosaveDot.classList.add('unsaved'); autosaveText.textContent = 'Đang chỉnh sửa…'; };
    const markSaved = () => { autosaveDot.classList.remove('unsaved'); autosaveText.textContent = 'Đã lưu'; };

    document.getElementById('text-editor').addEventListener('input', markUnsaved);
    document.getElementById('btn-save').onclick = persistToSupabase;

    // Load dữ liệu khi trang vừa mở
    await loadWorkspaceFromSupabase();
});
