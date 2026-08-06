/**
 * OMNILAB - HOMEPAGE (TRANG CHỦ)
 * Demo authentication (register/login) and a folder/file dashboard for
 * notes saved from the workspace. Everything here is persisted to
 * localStorage as a stand-in — swap the storage helpers below for real
 * API calls once a backend/database is wired up.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ------------------------------------------------------------------
    // 0. TOAST / DIALOG HELPERS
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

    // ------------------------------------------------------------------
    // 1. LOCAL STORAGE — DEMO PERSISTENCE LAYER
    //    (Replace these with real API calls once a database exists.)
    // ------------------------------------------------------------------
    const STORE = {
        accounts: 'omnilab_accounts',
        session: 'omnilab_session',
        folders: 'omnilab_folders',
        files: 'omnilab_files'
    };

    const readJSON = (key, fallback) => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    };
    const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

    const getAccounts = () => readJSON(STORE.accounts, []);
    const setAccounts = (v) => writeJSON(STORE.accounts, v);
    const getSession = () => readJSON(STORE.session, null);
    const setSession = (v) => { v ? writeJSON(STORE.session, v) : localStorage.removeItem(STORE.session); };
    const getFolders = () => readJSON(STORE.folders, []);
    const setFolders = (v) => writeJSON(STORE.folders, v);
    const getFiles = () => readJSON(STORE.files, []);
    const setFiles = (v) => writeJSON(STORE.files, v);

    const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    // Seed a demo login + a couple of demo folders/files on first visit
    (function seedDemoData() {
        if (getAccounts().length === 0) {
            setAccounts([{
                username: 'demo',
                password: 'demo123',
                phone: '0900000000',
                dob: '2000-01-01',
                createdAt: Date.now()
            }]);
        }
        if (getFolders().length === 0) {
            const now = Date.now();
            const folders = [
                { id: uid('fold'), name: 'Vật Lý 10', createdAt: now - 6 * 86400000 },
                { id: uid('fold'), name: 'Hóa Học 11', createdAt: now - 3 * 86400000 },
                { id: uid('fold'), name: 'Ôn thi THPT', createdAt: now - 1 * 86400000 }
            ];
            setFolders(folders);
            setFiles([
                { id: uid('file'), folderId: folders[0].id, title: 'Chương 1 — Động học chất điểm', updatedAt: now - 5 * 86400000, sizeKB: 42 },
                { id: uid('file'), folderId: folders[0].id, title: 'Bài tập dao động điều hòa', updatedAt: now - 2 * 86400000, sizeKB: 68 },
                { id: uid('file'), folderId: folders[1].id, title: 'Bảng tuần hoàn — ghi chú nhanh', updatedAt: now - 3 * 86400000, sizeKB: 30 },
                { id: uid('file'), folderId: folders[2].id, title: 'Đề cương ôn tập giữa kỳ', updatedAt: now - 1 * 86400000, sizeKB: 95 }
            ]);
        }
    })();

    // ------------------------------------------------------------------
    // 2. VIEW SWITCHING (Auth <-> Dashboard)
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

    const showDashboardView = (username) => {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        headerUser.classList.remove('hidden');
        userAvatar.textContent = username.charAt(0).toUpperCase();
        userNameLabel.textContent = username;
        renderDashboard();
    };

    // ------------------------------------------------------------------
    // 3. AUTH TABS
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

    // Show/hide password fields
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
    // 4. LOGIN
    // ------------------------------------------------------------------
    const loginError = document.getElementById('login-error');
    const setLoginError = (msg) => {
        loginError.textContent = msg || '';
        loginError.classList.toggle('show', !!msg);
    };

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            setLoginError('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu.');
            return;
        }

        const account = getAccounts().find(
            (a) => a.username.toLowerCase() === username.toLowerCase() && a.password === password
        );

        if (!account) {
            setLoginError('Sai tên tài khoản hoặc mật khẩu (demo).');
            return;
        }

        setLoginError('');
        setSession({ username: account.username, loginAt: Date.now() });
        showToast(`Chào mừng trở lại, ${account.username}!`, 'info', 'fa-user-check');
        showDashboardView(account.username);
    });

    // ------------------------------------------------------------------
    // 5. REGISTER
    // ------------------------------------------------------------------
    const registerError = document.getElementById('register-error');
    const setRegisterError = (msg) => {
        registerError.textContent = msg || '';
        registerError.classList.toggle('show', !!msg);
    };

    const validatePhone = (phone) => /^(0\d{9}|\+84\d{9})$/.test(phone.replace(/\s+/g, ''));

    const validateAge = (dobStr) => {
        const dob = new Date(dobStr);
        if (Number.isNaN(dob.getTime())) return false;
        const now = new Date();
        if (dob > now) return false;
        const age = (now - dob) / (365.25 * 86400000);
        return age >= 5 && age <= 120;
    };

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        const phone = document.getElementById('reg-phone').value.trim();
        const dob = document.getElementById('reg-dob').value;

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            setRegisterError('Tên tài khoản phải dài 3–20 ký tự, chỉ gồm chữ, số và dấu gạch dưới.');
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
        if (!validatePhone(phone)) {
            setRegisterError('Số điện thoại không hợp lệ (VD: 0912345678).');
            return;
        }
        if (!dob || !validateAge(dob)) {
            setRegisterError('Ngày sinh không hợp lệ.');
            return;
        }

        const accounts = getAccounts();
        if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
            setRegisterError('Tên tài khoản này đã được sử dụng.');
            return;
        }

        setRegisterError('');
        accounts.push({ username, password, phone, dob, createdAt: Date.now() });
        setAccounts(accounts);

        showToast('Tạo tài khoản thành công! Hãy đăng nhập.', 'info', 'fa-user-plus');
        registerForm.reset();
        setActiveTab('login');
        document.getElementById('login-username').value = username;
        document.getElementById('login-password').focus();
    });

    // ------------------------------------------------------------------
    // 6. LOGOUT
    // ------------------------------------------------------------------
    document.getElementById('btn-logout').addEventListener('click', () => {
        setSession(null);
        showToast('Đã đăng xuất.', 'info', 'fa-right-from-bracket');
        showAuthView();
    });

    // ------------------------------------------------------------------
    // 7. DASHBOARD — folders & files
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

    let currentFolderId = null; // null = root (folder grid)
    let searchTerm = '';

    const formatRelativeTime = (ts) => {
        const diffMs = Date.now() - ts;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} giờ trước`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days} ngày trước`;
        return new Date(ts).toLocaleDateString('vi-VN');
    };

    const renderStats = () => {
        const folders = getFolders();
        const files = getFiles();
        statFolders.textContent = folders.length;
        statFiles.textContent = files.length;
        statRecent.textContent = files.length
            ? formatRelativeTime(Math.max(...files.map((f) => f.updatedAt)))
            : '—';
        const totalKB = files.reduce((sum, f) => sum + (f.sizeKB || 0), 0);
        statStorage.textContent = totalKB > 1024 ? `${(totalKB / 1024).toFixed(1)} MB` : `${totalKB} KB`;
    };

    const closeAllItemMenus = () => document.querySelectorAll('.item-menu.open').forEach((m) => m.classList.remove('open'));

    const renderBreadcrumb = () => {
        breadcrumb.innerHTML = '';
        const rootBtn = document.createElement('button');
        rootBtn.type = 'button';
        rootBtn.className = `crumb ${currentFolderId === null ? 'current' : ''}`;
        rootBtn.innerHTML = '<i class="fa-solid fa-house"></i> Trang chủ';
        rootBtn.addEventListener('click', () => { currentFolderId = null; searchInput.value = ''; searchTerm = ''; renderDashboard(); });
        breadcrumb.appendChild(rootBtn);

        if (currentFolderId !== null) {
            const folder = getFolders().find((f) => f.id === currentFolderId);
            const sep = document.createElement('span');
            sep.className = 'crumb-sep';
            sep.textContent = '/';
            breadcrumb.appendChild(sep);

            const folderBtn = document.createElement('button');
            folderBtn.type = 'button';
            folderBtn.className = 'crumb current';
            folderBtn.innerHTML = `<i class="fa-solid fa-folder"></i> ${folder ? escapeHtml(folder.name) : 'Thư mục'}`;
            breadcrumb.appendChild(folderBtn);
        }
    };

    const escapeHtml = (str) => str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const buildFolderCard = (folder) => {
        const files = getFiles().filter((f) => f.folderId === folder.id);
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-card-top">
                <span class="item-icon folder"><i class="fa-solid fa-folder"></i></span>
                <button type="button" class="item-menu-btn" title="Tùy chọn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
            <span class="item-name">${escapeHtml(folder.name)}</span>
            <span class="item-meta"><i class="fa-solid fa-file-lines"></i> ${files.length} ghi chú <span class="dot"></span> ${formatRelativeTime(folder.createdAt)}</span>
            <div class="item-menu">
                <button type="button" data-action="rename"><i class="fa-solid fa-pen"></i> Đổi tên</button>
                <button type="button" data-action="delete" class="danger"><i class="fa-solid fa-trash-can"></i> Xóa thư mục</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.item-menu-btn') || e.target.closest('.item-menu')) return;
            currentFolderId = folder.id;
            searchInput.value = '';
            searchTerm = '';
            renderDashboard();
        });

        const menuBtn = card.querySelector('.item-menu-btn');
        const menu = card.querySelector('.item-menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = menu.classList.contains('open');
            closeAllItemMenus();
            menu.classList.toggle('open', !wasOpen);
        });

        menu.querySelector('[data-action="rename"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            closeAllItemMenus();
            const name = await showPrompt('Đổi tên thư mục', folder.name, 'fa-pen');
            if (!name) return;
            const folders = getFolders();
            const idx = folders.findIndex((f) => f.id === folder.id);
            if (idx > -1) { folders[idx].name = name; setFolders(folders); renderDashboard(); showToast('Đã đổi tên thư mục.', 'info', 'fa-pen'); }
        });

        menu.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            closeAllItemMenus();
            const ok = await showConfirm(`Xóa thư mục "${folder.name}" và toàn bộ ${files.length} ghi chú bên trong?`, 'Xóa thư mục');
            if (!ok) return;
            setFolders(getFolders().filter((f) => f.id !== folder.id));
            setFiles(getFiles().filter((f) => f.folderId !== folder.id));
            showToast('Đã xóa thư mục.', 'info', 'fa-trash-can');
            renderDashboard();
        });

        return card;
    };

    const buildFileCard = (file) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <div class="item-card-top">
                <span class="item-icon file"><i class="fa-solid fa-file-lines"></i></span>
                <button type="button" class="item-menu-btn" title="Tùy chọn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
            <span class="item-name">${escapeHtml(file.title)}</span>
            <span class="item-meta"><i class="fa-solid fa-clock"></i> ${formatRelativeTime(file.updatedAt)} <span class="dot"></span> ${file.sizeKB || 0} KB</span>
            <div class="item-menu">
                <button type="button" data-action="open"><i class="fa-solid fa-arrow-up-right-from-square"></i> Mở ghi chú</button>
                <button type="button" data-action="rename"><i class="fa-solid fa-pen"></i> Đổi tên</button>
                <button type="button" data-action="delete" class="danger"><i class="fa-solid fa-trash-can"></i> Xóa</button>
            </div>
        `;

        const openFile = () => { window.location.href = `index.html?fileId=${encodeURIComponent(file.id)}`; };

        card.addEventListener('click', (e) => {
            if (e.target.closest('.item-menu-btn') || e.target.closest('.item-menu')) return;
            openFile();
        });

        const menuBtn = card.querySelector('.item-menu-btn');
        const menu = card.querySelector('.item-menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOpen = menu.classList.contains('open');
            closeAllItemMenus();
            menu.classList.toggle('open', !wasOpen);
        });

        menu.querySelector('[data-action="open"]').addEventListener('click', (e) => { e.stopPropagation(); openFile(); });

        menu.querySelector('[data-action="rename"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            closeAllItemMenus();
            const title = await showPrompt('Đổi tên ghi chú', file.title, 'fa-pen');
            if (!title) return;
            const files = getFiles();
            const idx = files.findIndex((f) => f.id === file.id);
            if (idx > -1) { files[idx].title = title; setFiles(files); renderDashboard(); showToast('Đã đổi tên ghi chú.', 'info', 'fa-pen'); }
        });

        menu.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            closeAllItemMenus();
            const ok = await showConfirm(`Xóa ghi chú "${file.title}"? Thao tác này không thể hoàn tác.`, 'Xóa ghi chú');
            if (!ok) return;
            setFiles(getFiles().filter((f) => f.id !== file.id));
            showToast('Đã xóa ghi chú.', 'info', 'fa-trash-can');
            renderDashboard();
        });

        return card;
    };

    const renderDashboard = () => {
        renderStats();
        renderBreadcrumb();
        closeAllItemMenus();

        const term = searchTerm.trim().toLowerCase();

        if (currentFolderId === null) {
            // Root: show folders
            fileGrid.classList.add('hidden');
            folderGrid.classList.remove('hidden');
            folderGrid.innerHTML = '';

            const folders = getFolders().filter((f) => f.name.toLowerCase().includes(term));
            folders
                .sort((a, b) => b.createdAt - a.createdAt)
                .forEach((f) => folderGrid.appendChild(buildFolderCard(f)));

            emptyState.classList.toggle('hidden', folders.length > 0);
        } else {
            // Inside a folder: show files
            folderGrid.classList.add('hidden');
            fileGrid.classList.remove('hidden');
            fileGrid.innerHTML = '';

            const files = getFiles()
                .filter((f) => f.folderId === currentFolderId)
                .filter((f) => f.title.toLowerCase().includes(term))
                .sort((a, b) => b.updatedAt - a.updatedAt);

            files.forEach((f) => fileGrid.appendChild(buildFileCard(f)));
            emptyState.classList.toggle('hidden', files.length > 0);
        }
    };

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.item-menu-btn')) closeAllItemMenus();
    });

    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderDashboard();
    });

    // --- New folder ------------------------------------------------------
    document.getElementById('btn-new-folder').addEventListener('click', async () => {
        const name = await showPrompt('Thư mục mới', '', 'fa-folder-plus');
        if (!name) return;
        const folders = getFolders();
        folders.push({ id: uid('fold'), name, createdAt: Date.now() });
        setFolders(folders);
        showToast(`Đã tạo thư mục "${name}".`, 'info', 'fa-folder-plus');
        currentFolderId = null;
        renderDashboard();
    });

    // --- New note (demo: creates a file entry, then opens the workspace) -
    document.getElementById('btn-new-note').addEventListener('click', async () => {
        let folderId = currentFolderId;

        if (!folderId) {
            const folders = getFolders();
            if (folders.length === 0) {
                // No folder exists yet — create a default one first
                folderId = uid('fold');
                setFolders([{ id: folderId, name: 'Chưa phân loại', createdAt: Date.now() }]);
            } else {
                showToast('Hãy mở một thư mục trước khi tạo ghi chú mới.', 'error', 'fa-circle-exclamation');
                return;
            }
        }

        const file = { id: uid('file'), folderId, title: 'Ghi chú mới', updatedAt: Date.now(), sizeKB: 0 };
        const files = getFiles();
        files.push(file);
        setFiles(files);

        window.location.href = `index.html?fileId=${encodeURIComponent(file.id)}`;
    });

    // ------------------------------------------------------------------
    // 8. INITIAL LOAD
    // ------------------------------------------------------------------
    const session = getSession();
    if (session && session.username) {
        showDashboardView(session.username);
    } else {
        showAuthView();
    }
});
