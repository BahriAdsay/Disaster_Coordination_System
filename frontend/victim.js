    const API = 'http://127.0.0.1:8000';


    const userId   = localStorage.getItem('user_id');
    const userName = localStorage.getItem('user_name');
    const userRole = localStorage.getItem('user_role');


    if (!userId || userRole !== 'victim') {
        window.location.href = 'login.html';
    }

    document.getElementById('welcomeMsg').textContent = 'Welcome, ' + userName;


    function renderLocationBox(html) {
        document.getElementById('locationBox').innerHTML = html;
    }

    function resetLocationBox() {
        renderLocationBox('Location not detected yet. <button type="button" onclick="getLocation()" style="margin-left:10px; padding:4px 12px; background:#2c6fad; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">Get My Location</button>');
    }

    function getLocation() {
        const box = document.getElementById('locationBox');

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
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`,
                        { headers: { 'User-Agent': 'PNo2-DisasterApp/1.0' } }
                    );
                    const data = await res.json();
                    const addr = data.address;

                    const ilce = (addr.city_district || addr.district || addr.town || addr.county || '').trim();
const sehir = (addr.city || addr.province || addr.state || '').trim();

const zone = ilce && sehir
    ? `${ilce}/${sehir}`
    : (sehir || ilce);

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
                renderLocationBox('<span style="color:red">Location unavailable. Check browser permissions.</span> <button type="button" onclick="getLocation()" style="margin-left:10px; padding:3px 10px; background:#eee; border:1px solid #ccc; border-radius:4px; cursor:pointer; font-size:11px;">Retry</button>');
            },
            { timeout: 30000, enableHighAccuracy: false, maximumAge: 60000 }
        );
    }

   
    document.getElementById('requestForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!document.getElementById('lat').value || !document.getElementById('lng').value) {
            showFormMsg('Please get your location first.', 'error');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const body = {
            user_id:     parseInt(userId),
            category:    document.getElementById('category').value,
            urgency:     document.getElementById('urgency').value,
            quantity:    parseInt(document.getElementById('quantity').value),
            zone:        document.getElementById('zone').value,
            lat:         parseFloat(document.getElementById('lat').value),
            lng:         parseFloat(document.getElementById('lng').value),
            description: document.getElementById('description').value
        };

        try {
            const res = await fetch(`${API}/requests/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (!res.ok) {
                showFormMsg(data.detail || 'An error occurred.', 'error');
            } else {
                showFormMsg('Your request has been submitted!', 'success');
                document.getElementById('requestForm').reset();
                // Konum kutusunu sifirla
                resetLocationBox();
                loadMyRequests();
            }
        } catch (err) {
            showFormMsg('Could not connect to server.', 'error');
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    });

    
    async function loadMyRequests() {
        const list = document.getElementById('requestList');
        list.innerHTML = '<p class="loading">Loading...</p>';

        try {
            
            const [reqRes, assignRes, resRes] = await Promise.all([
                fetch(`${API}/requests/`),
                fetch(`${API}/assignments/`),
                fetch(`${API}/resources/`)
            ]);
            const allRequests   = await reqRes.json();
            const allAssignments = await assignRes.json();
            const allResources   = await resRes.json();

            const myRequests = allRequests.filter(r => r.user_id == userId);

            if (myRequests.length === 0) {
                list.innerHTML = '<p class="no-requests">You have not submitted any requests yet.</p>';
                return;
            }

            myRequests.reverse();

            list.innerHTML = myRequests.map(r => {
                const myAssignments = allAssignments.filter(a => a.request_id === r.request_id);

                const assignmentBlock = myAssignments.length > 0 ? `
                    <div class="assignment-row">
                        <div class="assignment-row-title">Assignments</div>
                        ${myAssignments.map(a => {
                            const res = allResources.find(r => r.resource_id === a.resource_id);
                            const catText = res ? categoryLabel(res.category) + ' ' : '';
                            return `
                            <div class="assignment-item">
                                <span>${catText}Resource #${a.resource_id} &mdash; Qty: ${a.quantity}</span>
                                <span class="status-badge status-${a.status}">${statusLabel(a.status)}</span>
                            </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div class="assignment-row">
                        <div class="assignment-row-title" style="color:#ccc">No assignments yet</div>
                    </div>
                `;

                return `
                    <div class="request-card">
                        <div class="request-card-header">
                            <span class="request-category">${categoryLabel(r.category)}</span>
                            <span class="badge badge-${r.urgency}">${urgencyLabel(r.urgency)}</span>
                        </div>
                        <div class="request-detail">Zone: ${r.zone}</div>
                        ${r.description ? `<div class="request-desc">"${r.description}"</div>` : ''}
                        ${assignmentBlock}
                    </div>
                `;
            }).join('');

        } catch (err) {
            list.innerHTML = '<p class="no-requests">Failed to load data.</p>';
        }
    }

    function categoryLabel(c) {
        const map = { food: 'Food', water: 'Water', medicine: 'Medicine', shelter: 'Shelter', clothing: 'Clothing', other: 'Other' };
        return map[c] || c;
    }
    function urgencyLabel(u) {
        const map = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
        return map[u] || u;
    }
    function statusLabel(s) {
        const map = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };
        return map[s] || s;
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

    
    loadMyRequests();
