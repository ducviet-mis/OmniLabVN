/**
 * OMNILAB — HOMEPAGE (FIXED SYNTAX ERROR & FULL SUPABASE AUTH)
 */

const SUPABASE_URL = 'https://vnwqhacajbrlmtoixuzy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZud3FoYWNhamJybG10b2l4dXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTU2OTEsImV4cCI6MjEwMTU3MTY5MX0.OQZVSpBBYRqcpD-cf7FkOv2iDX20zU5_zZaz1KJuXTA';

// Khai báo duy nhất 1 lần biến supabaseClient để tránh trùng lặp
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

document.addEventListener('DOMContentLoaded', async () => {

    // ------------------------------------------------------------------
    // 0. TOAST & DIALOG HELPERS
    // ------------------------------------------------------------------
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

    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');

    const showConfirm = (message, title = 'Xác nhận thao tác') => new Promise((resolve) => {
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

    const promptModal = document.getElementById('prompt-modal');
    const promptTitle = document.getElementById('prompt-title');
    const promptInput = document.getElementById('prompt-input');
    const promptOk = document.getElementById('prompt-ok');
    const promptCancel = document.getElementById('prompt-cancel');

    const showPrompt = (title, initialValue = '', iconClass = 'fa-folder-plus') => new Promise((resolve) => {
        if (!promptModal) return resolve(null);
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
    // 1. TAB SWITCHING (ĐĂNG NHẬP <-> ĐĂNG KÝ)
    // ------------------------------------------------------------------
    const authTabs = document.querySelectorAll('.auth-tab');
    const authTabsWrap = document.querySelector('.auth-tabs');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    authTabs.forEach((tabBtn) => {
        tabBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = tabBtn.getAttribute('data-tab');

            authTabs.forEach((b) => {
                const isActive = b.getAttribute('data-tab') === targetTab;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', String(isActive));
            });

            if (authTabsWrap) authTabsWrap.setAttribute('data-active', targetTab);

            if (targetTab === 'login') {
                if (loginForm) loginForm.classList.add('active');
                if (registerForm) registerForm.classList.remove('active');
            } else {
                if (loginForm) loginForm.classList.remove('active');
                if (registerForm) registerForm.classList.add('active');
            }
        });
    });

    // Ẩn / Hiện Mật khẩu
    document.querySelectorAll('.field-eye').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = document.getElementById(btn.dataset.toggleFor);
            if (!input) return;
            const icon = btn.querySelector('i');
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            if (icon) icon.className = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        });
    });

    // ------------------------------------------------------------------
    // 2. VIEW SWITCHING
    // ------------------------------------------------------------------
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    const headerUser = document.getElementById('header-user');
    const userAvatar = document.getElementById('user-avatar');
    const userNameLabel = document.getElementById('user-name-label');

    const showAuthView = () => {
        if (authView) authView.classList.remove('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
        if (headerUser) headerUser.classList.add('hidden');
    };

    const showDashboardView = (email) => {
        if (authView) authView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.remove('hidden');
        if (headerUser) headerUser.classList.remove('hidden');
        const displayName = email ? email.split('@')[0] : 'User';
        if (userAvatar) userAvatar.textContent = displayName.charAt(0).toUpperCase();
        if (userNameLabel) userNameLabel.textContent = displayName;
        renderDashboard();
    };

    // ------------------------------------------------------------------
    // 3. SUPABASE AUTH
    // ------------------------------------------------------------------
    const loginError = document.getElementById('login-error');
    const setLoginError = (msg) => {
        if (!loginError) return;
        loginError.textContent = msg || '';
        loginError.classList.toggle('show', !!msg);
    };

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabaseClient) return alert('Chưa tải được thư viện Supabase!');

            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            if (!username || !password) {
                setLoginError('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu.');
                return;
            }

            const email = username.includes('@') ? username : `${username}@omnilab.com`;

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                setLoginError('Sai tên tài khoản hoặc mật khẩu.');
                return;
            }

            setLoginError('');
            showToast('Chào mừng trở lại!', 'info', 'fa-user-check');
            showDashboardView(data.user.email);
        });
    }

    const registerError = document.getElementById('register-error');
    const setRegisterError = (msg) => {
        if (!registerError) return;
        registerError.textContent = msg || '';
        registerError.classList.toggle('show', !!msg);
    };

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabaseClient) return alert('Chưa tải được thư viện Supabase!');

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

            const email = `${username}@omnilab.com`;

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { username } }
            });

            if (error) {
                setRegisterError(error.message.includes('already registered') ? 'Tài khoản này đã tồn tại.' : error.message);
                return;
            }

            setRegisterError('');
            showToast('Tạo tài khoản thành công! Hãy đăng nhập.', 'info', 'fa-user-plus');
            if (registerForm) registerForm.reset();

            const loginTabBtn = document.querySelector('.auth-tab[data-tab="login"]');
            if (loginTabBtn) loginTabBtn.click();
            const loginUserInput = document.getElementById('login-username');
            if (loginUserInput) loginUserInput.value = username;
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (supabaseClient) await supabaseClient.auth.signOut();
            showToast('Đã đăng xuất.', 'info', 'fa-right-from-bracket');
            showAuthView();
        });
    }

    // ------------------------------------------------------------------
    // 4. DASHBOARD RENDER
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

    const escapeHtml = (str) => str ? str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '';
    const closeAllItemMenus = () => document.querySelectorAll('.item-menu.open').forEach((m) => m.classList.remove('open'));

    const renderDashboard = async () => {
        if (!supabaseClient) return;
        closeAllItemMenus();

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return showAuthView();

        const { data: folders } = await supabaseClient.from('folders').select('*').eq('user_id', user.id);
        const { data: files } = await supabaseClient.from('files').select('*').eq('user_id', user.id);

        const allFolders = folders || [];
        const allFiles = files || [];

        if (statFolders) statFolders.textContent = allFolders.length;
        if (statFiles) statFiles.textContent = allFiles.length;
        if (statRecent) {
            statRecent.textContent = allFiles.length 
                ? formatRelativeTime(Math.max(...allFiles.map(f => new Date(f.updated_at).getTime())))
                : '—';
        }
        if (statStorage) {
            const totalKB = allFiles.reduce((sum, f) => sum + (f.size_kb || 0), 0);
            statStorage.textContent = totalKB > 1024 ? `${(totalKB / 1024).toFixed(1)} MB` : `${totalKB} KB`;
        }

        if (breadcrumb) {
            breadcrumb.innerHTML = '';
            const rootBtn = document.createElement('button');
            rootBtn.className = `crumb ${currentFolderId === null ? 'current' : ''}`;
            rootBtn.innerHTML = '<i class="fa-solid fa-house"></i> Trang chủ';
            rootBtn.onclick = () => { currentFolderId = null; searchTerm = ''; if (searchInput) searchInput.value = ''; renderDashboard(); };
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
        }

        const term = searchTerm.trim().toLowerCase();

        if (currentFolderId === null) {
            if (fileGrid) fileGrid.classList.add('hidden');
            if (folderGrid) {
                folderGrid.classList.remove('hidden');
                folderGrid.innerHTML = '';
            }

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
                        await supabaseClient.from('folders').update({ name: newName }).eq('id', folder.id);
                        showToast('Đã đổi tên thư mục.', 'info', 'fa-pen');
                        renderDashboard();
                    }
                };

                menu.querySelector('[data-action="delete"]').onclick = async (e) => {
                    e.stopPropagation();
                    if (await showConfirm(`Xóa thư mục "${folder.name}"?`, 'Xóa thư mục')) {
                        await supabaseClient.from('folders').delete().eq('id', folder.id);
                        showToast('Đã xóa thư mục.', 'info', 'fa-trash-can');
                        renderDashboard();
                    }
                };

                if (folderGrid) folderGrid.appendChild(card);
            });
            if (emptyState) emptyState.classList.toggle('hidden', displayFolders.length > 0);
        } else {
            if (folderGrid) folderGrid.classList.add('hidden');
            if (fileGrid) {
                fileGrid.classList.remove('hidden');
                fileGrid.innerHTML = '';
            }

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
                        await supabaseClient.from('files').update({ title: newTitle }).eq('id', file.id);
                        showToast('Đã đổi tên ghi chú.', 'info', 'fa-pen');
                        renderDashboard();
                    }
                };

                menu.querySelector('[data-action="delete"]').onclick = async (e) => {
                    e.stopPropagation();
                    if (await showConfirm(`Xóa ghi chú "${file.title}"?`, 'Xóa ghi chú'));
                    await supabaseClient.from('files').delete().eq('id', file.id);
                    showToast('Đã xóa ghi chú.', 'info', 'fa-trash-can');
                    renderDashboard();
                };

                if (fileGrid) fileGrid.appendChild(card);
            });
            if (emptyState) emptyState.classList.toggle('hidden', displayFiles.length > 0);
        }
    };

    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) {
        btnNewFolder.onclick = async () => {
            const name = await showPrompt('Thư mục mới', '', 'fa-folder-plus');
            if (!name) return;
            const { data: { user } } = await supabaseClient.auth.getUser();
            await supabaseClient.from('folders').insert([{ id: uid('fold'), user_id: user.id, name }]);
            showToast(`Đã tạo thư mục "${name}".`, 'info', 'fa-folder-plus');
            currentFolderId = null;
            renderDashboard();
        };
    }

    const btnNewNote = document.getElementById('btn-new-note');
    if (btnNewNote) {
        btnNewNote.onclick = async () => {
            const { data: { user } } = await supabaseClient.auth.getUser();
            let folderId = currentFolderId;

            if (!folderId) {
                const { data: folders } = await supabaseClient.from('folders').select('*').eq('user_id', user.id);
                if (!folders || folders.length === 0) {
                    folderId = uid('fold');
                    await supabaseClient.from('folders').insert([{ id: folderId, user_id: user.id, name: 'Chưa phân loại' }]);
                } else {
                    showToast('Hãy mở một thư mục trước khi tạo ghi chú mới.', 'error', 'fa-circle-exclamation');
                    return;
                }
            }

            const newFileId = uid('file');
            await supabaseClient.from('files').insert([{
                id: newFileId,
                user_id: user.id,
                folder_id: folderId,
                title: 'Ghi chú mới',
                size_kb: 0
            }]);

            window.location.href = `index.html?fileId=${encodeURIComponent(newFileId)}`;
        };
    }

    if (searchInput) searchInput.oninput = (e) => { searchTerm = e.target.value; renderDashboard(); };
    document.onclick = (e) => { if (!e.target.closest('.item-menu-btn')) closeAllItemMenus(); };

    // Kiểm tra Đăng nhập
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            showDashboardView(session.user.email);
        } else {
            showAuthView();
        }
    }
});
