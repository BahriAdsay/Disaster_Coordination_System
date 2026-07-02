    const API = 'http://127.0.0.1:8000';

    const userId   = localStorage.getItem('user_id');
    const userName = localStorage.getItem('user_name');
    const userRole = localStorage.getItem('user_role');

    if (!userId || userRole !== 'volunteer') {
        window.location.href = 'login.html';
    }

    document.getElementById('welcomeMsg').textContent = 'Welcome, ' + userName;

    
    function renderLocationBox(html) {
        document.getElementById('locationBox').innerHTML = html;
    }

    function resetLocationBox() {
        renderLocationBox('Location not detected yet. <button type="button" onclick="getLocation()" style="margin-left:10px; padding:4px 12px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Get My Location</button>');
    }

    function getLocation() {
        if (!navigator.geolocation) {
            renderLocationBox('<span style="color:red">Your browser does not support geolocation.</span>');
            return;
        }

        renderLocationBox('Detecting location... <small style="color:#888">Please allow access.</small>');

        navigator.geolocation.getCurrentPosition(
            async function(pos) {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                document.getElementById('lat').value = lat;
                document.getElementById('lng').value = lng;

                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
                        { headers: { 'User-Agent': 'PNo2-DisasterApp/1.0' } }
                    );
                    const data = await res.json();
                    const addr = data.address;

                    const district = addr.suburb || addr.town || addr.city_district || addr.district || addr.county || '';
                    const city = addr.city || addr.province || addr.state || '';
                    const zone = district ? (district + (city ? ', ' + city : '')) : city;

                    document.getElementById('zone').value = zone;
                    renderLocationBox(`<span style="color:green">&#10003; Location detected:</span> <b>${zone}</b><br>
                        <small style="color:#888">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</small>
                        <button type="button" onclick="getLocation()" style="margin-left:10px; padding:3px 10px; background:#eee; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:11px;">Refresh</button>`);
                } catch(e) {
                    document.getElementById('zone').value = lat.toFixed(4) + ', ' + lng.toFixed(4);
                    renderLocationBox(`<span style="color:green">&#10003; Location detected:</span> Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}
                        <button type="button" onclick="getLocation()" style="margin-left:10px; padding:3px 10px; background:#eee; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:11px;">Refresh</button>`);
                }
            },
            function(err) {
                console.log('Location error code:', err.code, err.message);
                renderLocationBox('<span style="color:red">Location unavailable. Check browser permissions.</span> <button type="button" onclick="getLocation()" style="margin-left:10px; padding:3px 10px; background:#eee; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:11px;">Retry</button>');
            },
            { timeout: 30000, enableHighAccuracy: false, maximumAge: 60000 }
        );
    }

    
    document.getElementById('resourceForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!document.getElementById('lat').value || !document.getElementById('lng').value) {
            showFormMsg('Please get your location first.', 'error');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const body = {
            user_id:      parseInt(userId),
            category:     document.getElementById('category').value,
            description:  document.getElementById('description').value,
            quantity:     parseInt(document.getElementById('quantity').value),
            zone:         document.getElementById('zone').value,
            lat:          parseFloat(document.getElementById('lat').value),
            lng:          parseFloat(document.getElementById('lng').value),
            availability: true
        };

        try {
            const res = await fetch(`${API}/resources/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (!res.ok) {
                showFormMsg(data.detail || 'An error occurred.', 'error');
            } else {
                showFormMsg('Resource submitted successfully!', 'success');
                document.getElementById('resourceForm').reset();
                resetLocationBox();
                loadMyResources();
            }
        } catch (err) {
            showFormMsg('Could not connect to server.', 'error');
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Resource';
    });

    
    let currentTab = 'resources';
    function switchTab(tab) {
        currentTab = tab;
        document.getElementById('tabResources').classList.toggle('active', tab === 'resources');
        document.getElementById('tabAssignments').classList.toggle('active', tab === 'assignments');
        if (tab === 'resources') loadMyResources();
        else loadMyAssignments();
    }

   
    async function loadMyResources() {
        const content = document.getElementById('panelContent');
        content.innerHTML = '<p class="loading">Loading...</p>';

        try {
            const res = await fetch(`${API}/resources/`);
            const data = await res.json();
            const myResources = data.filter(r => r.user_id == userId);

            if (myResources.length === 0) {
                content.innerHTML = '<p class="no-items">You have not submitted any resources yet.</p>';
                return;
            }

            myResources.reverse();
            content.innerHTML = `
                <div class="section-title">Resources (${myResources.length})</div>
                ${myResources.map(r => `
                    <div class="resource-card">
                        <div class="resource-card-header">
                            <span class="resource-category">${categoryLabel(r.category)} #${r.resource_id}</span>
                            <span class="avail-badge avail-${r.availability}">${r.availability ? 'Available' : 'Unavailable'}</span>
                        </div>
                        <div class="resource-detail">Zone: ${r.zone}</div>
                        <div class="resource-detail">Quantity: ${r.quantity}</div>
                        ${r.description ? `<div class="resource-detail" style="margin-top:3px">${r.description}</div>` : ''}
                    </div>
                `).join('')}
            `;
        } catch (err) {
            content.innerHTML = '<p class="no-items">Failed to load data.</p>';
        }
    }

    
    async function loadMyAssignments() {
        const content = document.getElementById('panelContent');
        content.innerHTML = '<p class="loading">Loading...</p>';

        try {
            
            const resRes = await fetch(`${API}/resources/`);
            const allResources = await resRes.json();
            const myResourceIds = allResources.filter(r => r.user_id == userId).map(r => r.resource_id);

            if (myResourceIds.length === 0) {
                content.innerHTML = '<p class="no-items">No assignments found.</p>';
                return;
            }

          
            const assignRes = await fetch(`${API}/assignments/`);
            const allAssignments = await assignRes.json();
            const myAssignments = allAssignments.filter(a => myResourceIds.includes(a.resource_id));

            
            const reqRes = await fetch(`${API}/requests/`);
            const allRequests = await reqRes.json();

            if (myAssignments.length === 0) {
                content.innerHTML = '<p class="no-items">No assignments for your resources yet.</p>';
                return;
            }

            content.innerHTML = `
                <div class="section-title">
                    Assignments (${myAssignments.length})
                    <button class="btn-refresh-small" onclick="loadMyAssignments()">Refresh</button>
                </div>
                ${myAssignments.map(a => {
                    const res = allResources.find(r => r.resource_id === a.resource_id);
                    const req = allRequests.find(r => r.request_id === a.request_id);
                    const resCat = res ? categoryLabel(res.category) : '';
                    const reqCat = req ? categoryLabel(req.category) : '';
                    return `
                    <div class="assignment-card" id="acard-${a.resource_id}-${a.request_id}">
                        <div class="assignment-card-header">
                            <span class="assignment-title">${reqCat} Request #${a.request_id} &larr; ${resCat} Resource #${a.resource_id}</span>
                            <span class="status-badge status-${a.status}">${a.status.replace('_',' ')}</span>
                        </div>
                        <div class="assignment-detail">Quantity: ${a.quantity}</div>
                        ${a.status !== 'completed' && a.status !== 'cancelled' ? `
                            <button class="btn-complete" onclick="markCompleted(${a.assignment_id}, this)">
                                Mark as Completed
                            </button>
                        ` : ''}
                    </div>
                    `;
                }).join('')}
            `;
        } catch (err) {
            content.innerHTML = '<p class="no-items">Failed to load data.</p>';
        }
    }

    
    async function markCompleted(assignmentId, btn) {
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
        const res = await fetch(`${API}/assignments/${assignmentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        const data = await res.json();

        if (!res.ok) {
            btn.disabled = false;
            btn.textContent = 'Mark as Completed';
            alert(data.detail || 'An error occurred.');
        } else {
            loadMyAssignments();
        }
    } catch(err) {
        btn.disabled = false;
        btn.textContent = 'Mark as Completed';
        alert('Could not connect to server.');
    }
}

    function categoryLabel(c) {
        const map = { food: 'Water', medicine: 'Medicine', shelter: 'Shelter' };
        return map[c] || c;
    }

    function showFormMsg(text, type) {
        const el = document.getElementById('formMsg');
        el.textContent = text;
        el.className = type;
        setTimeout(() => { el.textContent = ''; el.className = ''; }, 4000);
    }

    function logout() {
        localStorage.clear();
        window.location.href = 'login.html';
    }

    switchTab('resources');
