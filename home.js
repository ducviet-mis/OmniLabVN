/**
 * OMNILAB — HOMEPAGE (SUPABASE FULL INTEGRATION)
 * Quản lý Đăng nhập, Đăng ký, Thư mục và Bài học trực tiếp trên Supabase.
 */

// ⚠️ ĐIỀN THÔNG TIN SUPABASE CỦA BẠN VÀO ĐÂY:
const SUPABASE_URL = 'https://vnwqhacajbrlmtoixuzy.supabase.co';
const SUPABASE_ANON_KEY = 'DÁN_CHUỖI_ANON_PUBLIC_CỦA_BẠN_VÀO_ĐÂY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {

    // ------------------------------------------------------------------
    // 0. TOAST & DIALOG HELPERS
    // ------------------------------------------------------------------
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

    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');

    const showConfirm = (message, title = 'Xác nhận thao tác') => new Promise((resolve) => {
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

    const promptModal = document.getElementById('prompt-modal');
    const promptTitle = document.getElementById('prompt-title');
    const promptInput = document.getElementById('prompt-input');
    const promptOk = document.getElementById('prompt-ok');
    const promptCancel = document.getElementById('prompt-cancel');

    const showPrompt = (title, initialValue = '', iconClass = 'fa-folder-plus') => new Promise((resolve) => {
        promptTitle.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${title}`;
        promptInput.value = initialValue;
        promptModal.classList.remove('hidden');
        setTimeout(() => { promptInput.focus(); promptInput.select(); }, 50);

        const cleanup = (result) => {
            promptModal.classList.add('hidden');
            promptOk.removeEventListener('click', onOk);
            promptCancel.removeEventListener('click', onCancel);
            promptInput.removeEventListener('keydown', onKey);
            resolve(result);
        };
        const onOk = () => cleanup(promptInput.value.trim() || null);
        const onCancel = () => cleanup(null);
        const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };

        promptOk.addEventListener('click', onOk);
        promptCancel.addEventListener('click', onCancel);
        promptInput.addEventListener('keydown', onKey);
    });

    const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    // ------------------------------------------------------------------
    // 1. VIEW SWITCHING
    // ------------------------------------------------------------------
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    const headerUser = document.getElementById('header-user');
    const userAvatar = document.getElementById('user-avatar');
    const userNameLabel = document.getElementById('user-name-label');

    const showAuthView = () => {
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        headerUser.classList.add('hidden');
    };

    const showDashboardView = (email) => {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        headerUser.classList.remove('hidden');
        const displayName = email.split('@')[0];
        userAvatar.textContent = displayName.charAt(0).toUpperCase();
        userNameLabel.textContent = displayName;
        renderDashboard();
    };

    // ------------------------------------------------------------------
    // 2. AUTH TABS & TOGGLES
    // ------------------------------------------------------------------
    const authTabs = document.querySelectorAll('.auth-tab');
    const authTabsWrap = document.querySelector('.auth-tabs');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const setActiveTab = (tab) => {
        authTabs.forEach((btn) => {
            const active = btn.dataset.tab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', String(active));
        });
        authTabsWrap.dataset.active = tab;
        loginForm.classList.toggle('active', tab === 'login');
        registerForm.classList.toggle('active', tab === 'register');
    };

    authTabs.forEach((btn) => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

    document.querySelectorAll('.field-eye').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.toggleFor);
            const icon = btn.querySelector('i');
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        });
    });

    // ------------------------------------------------------------------
    // 3. SUPABASE AUTH: LOGIN & REGISTER
    // ------------------------------------------------------------------
    const loginError = document.getElementById('login-error');
    const setLoginError = (msg) => {
        loginError.textContent = msg || '';
        loginError.classList.toggle('show', !!msg);
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            setLoginError('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu.');
            return;
        }

        const email = username.includes('@') ? username : `${username}@omnilab.local`;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setLoginError('Sai tên tài khoản hoặc mật khẩu.');
            return;
        }

        setLoginError('');
        showToast(`Chào mừng trở lại!`, 'info', 'fa-user-check');
        showDashboardView(data.user.email);
    });

    const registerError = document.getElementById('register-error');
    const setRegisterError = (msg) => {
        registerError.textContent = msg || '';
        registerError.classList.toggle('show', !!msg);
    };

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            setRegisterError('Tên tài khoản từ 3–20 ký tự, không chứa ký tự đặc biệt.');
            return;
        }
        if (password.length < 6) {
            setRegisterError('Mật khẩu cần tối thiểu 6 ký tự.');
            return;
        }
        if (password !== confirm) {
            setRegisterError('Mật khẩu xác nhận không khớp.');
            return;
        }

        const email = `${username}@omnilab.local`;

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });

        if (error) {
            setRegisterError(error.message.includes('already registered') ? 'Tài khoản này đã tồn tại.' : error.message);
            return;
        }

        setRegisterError('');
        showToast('Tạo tài khoản thành công! Đang đăng nhập...', 'info', 'fa-user-plus');
        registerForm.reset();
        setActiveTab('login');
        document.getElementById('login-username').value = username;
        document.getElementById('login-password').value = password;
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        showToast('Đã đăng xuất.', 'info', 'fa-right-from-bracket');
        showAuthView();
    });

    // ------------------------------------------------------------------
    // 4. SUPABASE DATABASE (FOLDERS & FILES)
    // ------------------------------------------------------------------
    const folderGrid = document.getElementById('folder-grid');
    const fileGrid = document.getElementById('file-grid');
    const emptyState = document.getElementById('empty-state');
    const breadcrumb = document.getElementById('breadcrumb');
    const searchInput = document.getElementById('search-input');

    const statFolders = document.getElementById('stat-folders');
    const statFiles = document.getElementById('stat-files');
    const statRecent = document.getElementById('stat-recent');
    const statStorage = document.getElementById('stat-storage');

    let currentFolderId = null;
    let searchTerm = '';

    const formatRelativeTime = (ts) => {
        const diffMs = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} giờ trước`;
        return new Date(ts).toLocaleDateString('vi-VN');
    };

    const escapeHtml = (str) => str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const closeAllItemMenus = () => document.querySelectorAll('.item-menu.open').forEach((m) => m.classList.remove('open'));

    const renderDashboard = async () => {
        closeAllItemMenus();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: folders } = await supabase.from('folders').select('*').eq('user_id', user.id);
        const { data: files } = await supabase.from('files').select('*').eq('user_id', user.id);

        const allFolders = folders || [];
        const allFiles = files || [];

        statFolders.textContent = allFolders.length;
        statFiles.textContent = allFiles.length;
        statRecent.textContent = allFiles.length 
            ? formatRelativeTime(Math.max(...allFiles.map(f => new Date(f.updated_at).getTime())))
            : '—';
        const totalKB = allFiles.reduce((sum, f) => sum + (f.size_kb || 0), 0);
        statStorage.textContent = totalKB > 1024 ? `${(totalKB / 1024).toFixed(1)} MB` : `${totalKB} KB`;

        breadcrumb.innerHTML = '';
        const rootBtn = document.createElement('button');
        rootBtn.className = `crumb ${currentFolderId === null ? 'current' : ''}`;
        rootBtn.innerHTML = '<i class="fa-solid fa-house"></i> Trang chủ';
        rootBtn.onclick = () => { currentFolderId = null; searchTerm = ''; searchInput.value = ''; renderDashboard(); };
        breadcrumb.appendChild(rootBtn);

        if (currentFolderId !== null) {
            const currentFolder = allFolders.find(f => f.id === currentFolderId);
            const sep = document.createElement('span');
            sep.className = 'crumb-sep';
            sep.textContent = '/';
            breadcrumb.appendChild(sep);

            const folderBtn = document.createElement('button');
            folderBtn.className = 'crumb current';
            folderBtn.innerHTML = `<i class="fa-solid fa-folder"></i> ${currentFolder ? escapeHtml(currentFolder.name) : 'Thư mục'}`;
            breadcrumb.appendChild(folderBtn);
        }

        const term = searchTerm.trim().toLowerCase();

        if (currentFolderId === null) {
            fileGrid.classList.add('hidden');
            folderGrid.classList.remove('hidden');
            folderGrid.innerHTML = '';

            const displayFolders = allFolders.filter(f => f.name.toLowerCase().includes(term));
            displayFolders.forEach(folder => {
                const folderFiles = allFiles.filter(f => f.folder_id === folder.id);
                const card = document.createElement('div');
                card.className = 'item-card';
                card.innerHTML = `
                    <div class="item-card-top">
                        <span class="item-icon folder"><i class="fa-solid fa-folder"></i></span>
                        <button type="button" class="item-menu-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                    <span class="item-name">${escapeHtml(folder.name)}</span>
                    <span class="item-meta"><i class="fa-solid fa-file-lines"></i> ${folderFiles.length} ghi chú <span class="dot"></span> ${formatRelativeTime(folder.created_at)}</span>
                    <div class="item-menu">
                        <button type="button" data-action="rename"><i class="fa-solid fa-pen"></i> Đổi tên</button>
                        <button type="button" data-action="delete" class="danger"><i class="fa-solid fa-trash-can"></i> Xóa thư mục</button>
                    </div>
                `;

                card.onclick = (e) => {
                    if (e.target.closest('.item-menu-btn') || e.target.closest('.item-menu')) return;
                    currentFolderId = folder.id;
                    renderDashboard();
                };

                const menuBtn = card.querySelector('.item-menu-btn');
                const menu = card.querySelector('.item-menu');
                menuBtn.onclick = (e) => { e.stopPropagation(); closeAllItemMenus(); menu.classList.toggle('open'); };

                menu.querySelector('[data-action="rename"]').onclick = async (e) => {
                    e.stopPropagation();
                    const newName = await showPrompt('Đổi tên thư mục', folder.name, 'fa-pen');
                    if (newName) {
                        await supabase.from('folders').update({ name: newName }).eq('id', folder.id);
                        showToast('Đã đổi tên thư mục.', 'info', 'fa-pen');
                        renderDashboard();
                    }
                };

                menu.querySelector('[data-action="delete"]').onclick = async (e) => {
                    e.stopPropagation();
                    if (await showConfirm(`Xóa thư mục "${folder.name}"?`, 'Xóa thư mục')) {
                        await supabase.from('folders').delete().eq('id', folder.id);
                        showToast('Đã xóa thư mục.', 'info', 'fa-trash-can');
                        renderDashboard();
                    }
                };

                folderGrid.appendChild(card);
            });
            emptyState.classList.toggle('hidden', displayFolders.length > 0);
        } else {
            folderGrid.classList.add('hidden');
            fileGrid.classList.remove('hidden');
            fileGrid.innerHTML = '';

            const displayFiles = allFiles
                .filter(f => f.folder_id === currentFolderId)
                .filter(f => f.title.toLowerCase().includes(term));

            displayFiles.forEach(file => {
                const card = document.createElement('div');
                card.className = 'item-card';
                card.innerHTML = `
                    <div class="item-card-top">
                        <span class="item-icon file"><i class="fa-solid fa-file-lines"></i></span>
                        <button type="button" class="item-menu-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                    <span class="item-name">${escapeHtml(file.title)}</span>
                    <span class="item-meta"><i class="fa-solid fa-clock"></i> ${formatRelativeTime(file.updated_at)} <span class="dot"></span> ${file.size_kb || 0} KB</span>
                    <div class="item-menu">
                        <button type="button" data-action="open"><i class="fa-solid fa-arrow-up-right-from-square"></i> Mở ghi chú</button>
                        <button type="button" data-action="rename"><i class="fa-solid fa-pen"></i> Đổi tên</button>
                        <button type="button" data-action="delete" class="danger"><i class="fa-solid fa-trash-can"></i> Xóa</button>
                    </div>
                `;

                const openFile = () => { window.location.href = `index.html?fileId=${encodeURIComponent(file.id)}`; };
                card.onclick = (e) => {
                    if (e.target.closest('.item-menu-btn') || e.target.closest('.item-menu')) return;
                    openFile();
                };

                const menuBtn = card.querySelector('.item-menu-btn');
                const menu = card.querySelector('.item-menu');
                menuBtn.onclick = (e) => { e.stopPropagation(); closeAllItemMenus(); menu.classList.toggle('open'); };

                menu.querySelector('[data-action="open"]').onclick = openFile;
                menu.querySelector('[data-action="rename"]').onclick = async (e) => {
                    e.stopPropagation();
                    const newTitle = await showPrompt('Đổi tên ghi chú', file.title, 'fa-pen');
                    if (newTitle) {
                        await supabase.from('files').update({ title: newTitle }).eq('id', file.id);
                        showToast('Đã đổi tên ghi chú.', 'info', 'fa-pen');
                        renderDashboard();
                    }
                };

                menu.querySelector('[data-action="delete"]').onclick = async (e) => {
                    e.stopPropagation();
                    if (await showConfirm(`Xóa ghi chú "${file.title}"?`, 'Xóa ghi chú')) {
                        await supabase.from('files').delete().eq('id', file.id);
                        showToast('Đã xóa ghi chú.', 'info', 'fa-trash-can');
                        renderDashboard();
                    }
                };

                fileGrid.appendChild(card);
            });
            emptyState.classList.toggle('hidden', displayFiles.length > 0);
        }
    };

    document.getElementById('btn-new-folder').onclick = async () => {
        const name = await showPrompt('Thư mục mới', '', 'fa-folder-plus');
        if (!name) return;
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('folders').insert([{ id: uid('fold'), user_id: user.id, name }]);
        showToast(`Đã tạo thư mục "${name}".`, 'info', 'fa-folder-plus');
        currentFolderId = null;
        renderDashboard();
    };

    document.getElementById('btn-new-note').onclick = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        let folderId = currentFolderId;

        if (!folderId) {
            const { data: folders } = await supabase.from('folders').select('*').eq('user_id', user.id);
            if (!folders || folders.length === 0) {
                folderId = uid('fold');
                await supabase.from('folders').insert([{ id: folderId, user_id: user.id, name: 'Chưa phân loại' }]);
            } else {
                showToast('Hãy mở một thư mục trước khi tạo ghi chú mới.', 'error', 'fa-circle-exclamation');
                return;
            }
        }

        const newFileId = uid('file');
        await supabase.from('files').insert([{
            id: newFileId,
            user_id: user.id,
            folder_id: folderId,
            title: 'Ghi chú mới',
            size_kb: 0
        }]);

        window.location.href = `index.html?fileId=${encodeURIComponent(newFileId)}`;
    };

    searchInput.oninput = (e) => { searchTerm = e.target.value; renderDashboard(); };
    document.onclick = (e) => { if (!e.target.closest('.item-menu-btn')) closeAllItemMenus(); };

    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
        showDashboardView(session.user.email);
    } else {
        showAuthView();
    }
});
