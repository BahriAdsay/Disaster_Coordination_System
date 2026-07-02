    const API = 'http://127.0.0.1:8000';
    let currentAuth = 'login';

    function switchAuth(mode) {
        currentAuth = mode;

        document.getElementById('loginTab').classList.toggle('active', mode === 'login');
        document.getElementById('registerTab').classList.toggle('active', mode === 'register');

        document.getElementById('roleField').style.display = mode === 'register' ? 'block' : 'none';
        document.getElementById('submitBtn').textContent = mode === 'login' ? 'Giris Yap' : 'Kayit Ol';

        if (mode === 'login') {
            document.getElementById('operatorCodeField').style.display = 'none';
        } else {
            handleRoleChange();
        }

        clearMsg();
    }

    function handleRoleChange() {
        const role = document.getElementById('role').value;
        const opField = document.getElementById('operatorCodeField');
        const opInput = document.getElementById('operatorCode');

        if (role === 'operator' && currentAuth === 'register') {
            opField.style.display = 'block';
            opInput.required = true;
        } else {
            opField.style.display = 'none';
            opInput.required = false;
            opInput.value = '';
        }
    }

    document.getElementById('authForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (currentAuth === 'login') {
            try {
                const res = await fetch(`${API}/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
                    method: 'POST'
                });
                const data = await res.json();

                if (!res.ok) {
                    showMsg(data.detail || 'Login failed.', 'error');
                    return;
                }

                showMsg('Login successful! Redirecting...', 'success');

                // Kullanici bilgilerini kaydet
                localStorage.setItem('user_id', data.user_id);
                localStorage.setItem('user_name', data.name);
                localStorage.setItem('user_role', data.role);

                // Role gore yonlendir
                setTimeout(() => {
                    if (data.role === 'victim') {
                        window.location.href = 'victim.html';
                    } else if (data.role === 'volunteer') {
                        window.location.href = 'volunteer.html';
                    } else if (data.role === 'operator') {
                        window.location.href = 'operator.html';
                    }
                }, 1200);

            } catch (err) {
                showMsg('Could not connect to server.', 'error');
            }

        } else {
            const role = document.getElementById('role').value;
            const operatorCode = document.getElementById('operatorCode').value.trim();

            const body = { name: username, password: password, role: role };
            if (role === 'operator') {
                body.operator_key = operatorCode;
            }

            try {
                const res = await fetch(`${API}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();

                if (!res.ok) {
                    showMsg(data.detail || 'Registration failed.', 'error');
                    return;
                }

                showMsg('Registration successful! You can now log in.', 'success');
                setTimeout(() => { switchAuth('login'); }, 1500);

            } catch (err) {
                showMsg('Could not connect to server.', 'error');
            }
        }
    });

    function showMsg(text, type) {
        const el = document.getElementById('msg');
        el.textContent = text;
        el.className = type;
    }

    function clearMsg() {
        const el = document.getElementById('msg');
        el.textContent = '';
        el.className = '';
    }
