        const API = 'http://127.0.0.1:8000';

        const userId = localStorage.getItem('user_id');
        const userName = localStorage.getItem('user_name');
        const userRole = localStorage.getItem('user_role');

        if (!userId || userRole !== 'operator') {
            window.location.href = 'login.html';
        }

        document.getElementById('welcomeMsg').textContent = 'Welcome, ' + userName;

        
        const map = L.map('map', {
            maxBounds: [[-90, -180], [90, 180]],
            maxBoundsViscosity: 1.0
        }).setView([39.0, 35.0], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            noWrap: true
        }).addTo(map);

        
        let allRequests = [];
        let allResources = [];
        let allAssignments = [];
        let allRankings = [];
        let selectedRequest = null;
        let selectedResource = null;
        let currentTab = 'requests';
        let requestMarkers = [];
        let resourceMarkers = [];
        let filterCriticalActive = false;

        const redIcon = L.divIcon({
            className: '',
            html: '<div style="width:14px;height:14px;background:#e74c3c;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        const blueIcon = L.divIcon({
            className: '',
            html: '<div style="width:14px;height:14px;background:#2980b9;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
        const greyIcon = L.divIcon({
            className: '',
            html: '<div style="width:14px;height:14px;background:#aaa;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });

        // ── Load all data ──
        async function loadAll() {
            await Promise.all([loadRequests(), loadResources(), loadAssignments(), loadRankings()]);
            renderTab();
            renderGaps();
            checkCriticalZones();
        }

        async function loadRequests() {
            try {
                const res = await fetch(`${API}/requests/`);
                allRequests = await res.json();
            } catch (e) { allRequests = []; }
            renderRequestMarkers();
        }

        async function loadResources() {
            try {
                const res = await fetch(`${API}/resources/`);
                allResources = await res.json();
            } catch (e) { allResources = []; }
            renderResourceMarkers();
            renderCoverage();
        }

        async function loadAssignments() {
            try {
                const res = await fetch(`${API}/assignments/`);
                allAssignments = await res.json();
            } catch (e) { allAssignments = []; }
        }

        async function loadRankings() {
            try {
                const res = await fetch(`${API}/volunteers/ranking`);
                allRankings = await res.json();
            } catch (e) { allRankings = []; }
            renderRankings();
        }

        function renderRankings() {
            const container = document.getElementById('rankingList');
            if (allRankings.length === 0) {
                container.innerHTML = '<p class="no-items">No volunteers found.</p>';
                return;
            }
            container.innerHTML = allRankings.map((r, i) => `
                <div class="ranking-item">
                    <span class="ranking-rank">#${i + 1}</span>
                    <span class="ranking-name" title="${r.name}">${r.name}</span>
                    <span class="ranking-score" title="Completed assignments">${r.completed_count}</span>
                </div>
            `).join('');
        }

        function switchLeftTab(tab) {
            const tabs = document.querySelectorAll('.left-tab');
            tabs[0].classList.toggle('active', tab === 'ranking');
            tabs[1].classList.toggle('active', tab === 'coverage');
            tabs[2].classList.toggle('active', tab === 'gaps');

            document.getElementById('rankingView').style.display = tab === 'ranking' ? 'block' : 'none';
            document.getElementById('coverageView').style.display = tab === 'coverage' ? 'block' : 'none';
            document.getElementById('gapsView').style.display = tab === 'gaps' ? 'block' : 'none';
        }

        function renderCoverage() {
            const container = document.getElementById('coverageList');
            if (allResources.length === 0) {
                container.innerHTML = '<p class="no-items">No resources found.</p>';
                return;
            }

            let total = 0;
            const counts = {};
            allResources.forEach(r => {
                total += r.quantity;
                counts[r.category] = (counts[r.category] || 0) + r.quantity;
            });

            if (total === 0) {
                container.innerHTML = '<p class="no-items">No resources available.</p>';
                return;
            }

            const sortedCategories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

            container.innerHTML = sortedCategories.map(cat => {
                const amount = counts[cat];
                const percent = Math.round((amount / total) * 100);
                return `
                    <div class="coverage-item">
                        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                            <span class="coverage-label">${categoryLabel(cat)}</span>
                            <span class="coverage-percent">${percent}% (${amount})</span>
                        </div>
                        <div class="coverage-bar-bg">
                            <div class="coverage-bar-fill" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderGaps() {
            const container = document.getElementById('gapsList');
            if (allRequests.length === 0 && allResources.length === 0) {
                container.innerHTML = '<p class="no-items">No data available.</p>';
                return;
            }

            const data = {};
            allRequests.forEach(req => {
                if (!data[req.zone]) data[req.zone] = {};
                if (!data[req.zone][req.category]) data[req.zone][req.category] = { req: 0, res: 0 };
                data[req.zone][req.category].req += req.quantity;
            });
            allResources.forEach(res => {
                if (!data[res.zone]) data[res.zone] = {};
                if (!data[res.zone][res.category]) data[res.zone][res.category] = { req: 0, res: 0 };
                data[res.zone][res.category].res += res.quantity;
            });

            const zones = Object.keys(data).sort();
            if (zones.length === 0) {
                container.innerHTML = '<p class="no-items">No zones found.</p>';
                return;
            }

            let html = '';
            zones.forEach(zone => {
                html += `<div style="margin-bottom: 12px;">
                    <h4 style="font-size: 13px; color: #333; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Zone: ${zone}</h4>`;

                const cats = Object.keys(data[zone]).sort();
                cats.forEach(cat => {
                    const req = data[zone][cat].req;
                    const res = data[zone][cat].res;
                    const gap = req - res;
                    const hasGap = gap > 0;

                    html += `
                        <div class="coverage-item" style="padding: 6px 10px; margin-bottom: 4px; ${hasGap ? 'border-left: 3px solid #e74c3c;' : 'border-left: 3px solid #2ecc71;'}">
                            <div style="flex: 1;">
                                <span class="coverage-label" style="font-size: 11px;">${categoryLabel(cat)}</span>
                                <div style="font-size: 10px; color: #888; margin-top: 2px;">Req: ${req} | Avail: ${res}</div>
                            </div>
                            <div style="font-weight: bold; font-size: 12px; color: ${hasGap ? '#e74c3c' : '#2ecc71'};">
                                ${hasGap ? `Gap: ${gap}` : 'OK'}
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            });

            container.innerHTML = html;
        }

        function renderRequestMarkers() {
            requestMarkers.forEach(m => map.removeLayer(m));
            requestMarkers = [];

            let filteredRequests = allRequests.filter(req => req.quantity > 0);
            if (filterCriticalActive) {
                filteredRequests = filteredRequests.filter(req => req.urgency === 'critical');
            }

            filteredRequests.forEach(req => {
                const m = L.marker([req.lat, req.lng], { icon: redIcon }).addTo(map);
                m.bindPopup(`<b>${categoryLabel(req.category)}</b><br>Urgency: ${req.urgency}<br>Zone: ${req.zone}<br>Qty: ${req.quantity}`);
                m.on('click', () => selectRequest(req));
                requestMarkers.push(m);
            });
        }

        function checkCriticalZones() {
            const data = {};
            allRequests.forEach(req => {
                if (!data[req.zone]) data[req.zone] = {};
                if (!data[req.zone][req.category]) data[req.zone][req.category] = { req: 0, res: 0 };
                data[req.zone][req.category].req += req.quantity;
            });
            allResources.forEach(res => {
                if (!data[res.zone]) data[res.zone] = {};
                if (!data[res.zone][res.category]) data[res.zone][res.category] = { req: 0, res: 0 };
                data[res.zone][res.category].res += res.quantity;
            });

            const criticalZones = [];

            Object.keys(data).forEach(zone => {
                const cats = Object.keys(data[zone]);
                let isCritical = false;
                const criticalCats = [];
                cats.forEach(cat => {
                    const req = data[zone][cat].req;
                    const res = data[zone][cat].res;
                    if (req > 0 && res < (req * 0.1)) {
                        criticalCats.push({ cat, req, res });
                        isCritical = true;
                    }
                });

                if (isCritical) {
                    criticalZones.push({ zone, criticalCats });
                }
            });

            const btn = document.getElementById('criticalZonesBtn');
            const content = document.getElementById('criticalZonesContent');

            if (criticalZones.length > 0) {
                btn.style.display = 'flex';
                btn.innerHTML = `⚠️ ${criticalZones.length} Zone(s) Critical!`;

                let html = '';
                criticalZones.forEach(z => {
                    html += `<div style="margin-bottom: 10px;">
                        <div style="font-weight: bold; color: #c0392b; margin-bottom: 4px;">📍 ${z.zone}</div>`;
                    z.criticalCats.forEach(c => {
                        html += `<div style="color: #333; margin-left: 10px;">- ${categoryLabel(c.cat)}: <span style="color: #888;">Avail ${c.res} / Req ${c.req}</span></div>`;
                    });
                    html += `</div>`;
                });
                content.innerHTML = html;
            } else {
                btn.style.display = 'none';
                document.getElementById('criticalZonesPopup').style.display = 'none';
            }
        }

        function toggleCriticalZonesPopup() {
            const popup = document.getElementById('criticalZonesPopup');
            popup.style.display = popup.style.display === 'flex' ? 'none' : 'flex';
        }

        function toggleLeftPanel() {
            const panel = document.getElementById('leftPanel');
            panel.classList.toggle('collapsed');
            setTimeout(() => { map.invalidateSize(); }, 300);
        }

        function toggleCriticalFilter() {
            filterCriticalActive = !filterCriticalActive;
            const btn = document.getElementById('filterCriticalBtn');
            btn.classList.toggle('active', filterCriticalActive);
            btn.textContent = filterCriticalActive ? 'Show Everything' : 'Filter Most Critical';
            renderRequestMarkers();
            renderResourceMarkers();
        }

        function renderResourceMarkers() {
            resourceMarkers.forEach(m => map.removeLayer(m));
            resourceMarkers = [];

            if (filterCriticalActive) {
                return;
            }

            allResources.forEach(res => {
                const icon = res.availability ? blueIcon : greyIcon;
                const m = L.marker([res.lat, res.lng], { icon }).addTo(map);
                m.bindPopup(`<b>${categoryLabel(res.category)}</b><br>Zone: ${res.zone}<br>Qty: ${res.quantity}<br>Available: ${res.availability ? 'Yes' : 'No'}${res.description ? '<br>Desc: ' + res.description : ''}`);
                m.on('click', () => selectResource(res));
                resourceMarkers.push(m);
            });
        }

        
        function selectRequest(req) {
            selectedRequest = req;
            const box = document.getElementById('selectedRequestBox');
            box.classList.add('selected-request');
            document.getElementById('selectedRequestText').textContent = `#${req.request_id} ${categoryLabel(req.category)} (${req.urgency})`;
            document.getElementById('selectedRequestText').classList.remove('empty');
            if (currentTab !== 'requests') switchTab('requests');
            highlightListItem('req', req.request_id);
        }

        function selectResource(res) {
            selectedResource = res;
            const box = document.getElementById('selectedResourceBox');
            box.classList.add('selected-resource');
            document.getElementById('selectedResourceText').textContent = `#${res.resource_id} ${categoryLabel(res.category)} (qty: ${res.quantity})`;
            document.getElementById('selectedResourceText').classList.remove('empty');
            if (currentTab !== 'resources') switchTab('resources');
            highlightListItem('res', res.resource_id);
        }

        function highlightListItem(type, id) {
            if (type === 'req') {
                document.querySelectorAll('.list-item[data-type="req"]').forEach(el => el.classList.remove('selected-request'));
                const el = document.querySelector(`.list-item[data-type="req"][data-id="${id}"]`);
                if (el) el.classList.add('selected-request');
            } else {
                document.querySelectorAll('.list-item[data-type="res"]').forEach(el => el.classList.remove('selected-resource'));
                const el = document.querySelector(`.list-item[data-type="res"][data-id="${id}"]`);
                if (el) el.classList.add('selected-resource');
            }
        }

        function clearSelection() {
            selectedRequest = null;
            selectedResource = null;
            document.getElementById('selectedRequestBox').classList.remove('selected-request');
            document.getElementById('selectedResourceBox').classList.remove('selected-resource');
            document.getElementById('selectedRequestText').textContent = 'None selected';
            document.getElementById('selectedRequestText').classList.add('empty');
            document.getElementById('selectedResourceText').textContent = 'None selected';
            document.getElementById('selectedResourceText').classList.add('empty');
            document.querySelectorAll('.list-item').forEach(el => {
                el.classList.remove('selected-request', 'selected-resource');
            });
            clearAssignMsg();
        }

        
        async function createAssignment() {
            if (!selectedRequest) { showAssignMsg('Please select an aid request.', 'error'); return; }
            if (!selectedResource) { showAssignMsg('Please select a resource.', 'error'); return; }

            const qty = parseInt(document.getElementById('assignQty').value);
            if (!qty || qty < 1) { showAssignMsg('Quantity must be at least 1.', 'error'); return; }

            const btn = document.getElementById('assignBtn');
            btn.disabled = true;
            btn.textContent = 'Assigning...';

            const body = {
                resource_id: selectedResource.resource_id,
                request_id: selectedRequest.request_id,
                quantity: qty,
                status: 'pending'
            };

            try {
                const res = await fetch(`${API}/assignments/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await res.json();

                if (!res.ok) {
                    showAssignMsg(data.detail || 'An error occurred.', 'error');
                } else {
                    showAssignMsg('Assignment created successfully!', 'success');
                    clearSelection();
                    await loadAll();
                }
            } catch (e) {
                showAssignMsg('Could not connect to server.', 'error');
            }

            btn.disabled = false;
            btn.textContent = 'Assign';
        }

      
        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.panel-tab').forEach((btn, i) => {
                btn.classList.toggle('active', ['requests', 'resources', 'assignments'][i] === tab);
            });
            renderTab();
        }

        function renderTab() {
            const content = document.getElementById('panelContent');
            if (currentTab === 'requests') renderRequestsTab(content);
            else if (currentTab === 'resources') renderResourcesTab(content);
            else renderAssignmentsTab(content);
        }

        function renderRequestsTab(content) {
            const visibleRequests = allRequests.filter(r => r.quantity > 0);

            if (visibleRequests.length === 0) {
                content.innerHTML = '<p class="no-items">No aid requests found.</p>';
                return;
            }

            content.innerHTML = `
        <div class="section-title">
            Aid Requests (${visibleRequests.length})
            <button class="btn-refresh-small" onclick="loadAll()">Refresh</button>
        </div>
        ${visibleRequests.map(r => `
            <div class="list-item ${selectedRequest && selectedRequest.request_id === r.request_id ? 'selected-request' : ''}"
                 data-type="req" data-id="${r.request_id}"
                 onclick="selectRequest(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                <div class="item-header">
                    <span class="item-category">#${r.request_id} ${categoryLabel(r.category)}</span>
                    <span class="badge badge-${r.urgency}">${r.urgency}</span>
                </div>
                <div class="item-detail">Zone: ${r.zone} &nbsp;|&nbsp; Qty: ${r.quantity}</div>
                ${r.description ? `<div class="item-detail" style="margin-top:3px">${r.description}</div>` : ''}
            </div>
        `).join('')}
    `;
        }

        function renderResourcesTab(content) {
            if (allResources.length === 0) {
                content.innerHTML = '<p class="no-items">No resources found.</p>';
                return;
            }
            content.innerHTML = `
            <div class="section-title">
                Resources (${allResources.length})
                <button class="btn-refresh-small" onclick="loadAll()">Refresh</button>
            </div>
            ${allResources.map(r => `
                <div class="list-item ${selectedResource && selectedResource.resource_id === r.resource_id ? 'selected-resource' : ''}"
                     data-type="res" data-id="${r.resource_id}"
                     onclick="selectResource(${JSON.stringify(r).replace(/"/g, '&quot;')})">
                    <div class="item-header">
                        <span class="item-category">#${r.resource_id} ${categoryLabel(r.category)}</span>
                        <span class="badge ${r.availability ? 'badge-avail' : 'badge-unavail'}">${r.availability ? 'available' : 'unavailable'}</span>
                    </div>
                    <div class="item-detail">Zone: ${r.zone} &nbsp;|&nbsp; Qty: ${r.quantity}</div>
                    ${r.description ? `<div class="item-detail" style="margin-top:3px">${r.description}</div>` : ''}
                </div>
            `).join('')}
        `;
        }

        function renderAssignmentsTab(content) {
            if (allAssignments.length === 0) {
                content.innerHTML = '<p class="no-items">No assignments yet.</p>';
                return;
            }
            content.innerHTML = `
            <div class="section-title">
                Assignments (${allAssignments.length})
                <button class="btn-refresh-small" onclick="loadAll()">Refresh</button>
            </div>
            ${allAssignments.map(a => {
                const req = allRequests.find(r => r.request_id === a.request_id);
                const res = allResources.find(r => r.resource_id === a.resource_id);
                const reqLabel = req ? `${categoryLabel(req.category)} Request #${a.request_id}` : `Request #${a.request_id}`;
                const resLabel = res ? `${categoryLabel(res.category)} Resource #${a.resource_id}` : `Resource #${a.resource_id}`;
                return `
                <div class="list-item">
                    <div class="item-header">
                        <span class="item-category">${reqLabel} ← ${resLabel}</span>
                        <span class="status-badge status-${a.status}">${a.status.replace('_', ' ')}</span>
                    </div>
                    <div class="item-detail">Quantity: ${a.quantity}</div>
                    ${a.status !== 'completed' && a.status !== 'cancelled' ? `
                        <div style="margin-top:6px;">
                            <button onclick="cancelAssignment(${a.assignment_id}, this)" style="padding:4px 8px; background:#e74c3c; color:white; border:none; border-radius:4px; font-size:11px; cursor:pointer;">
                                Cancel Assignment
                            </button>
                        </div>
                    ` : ''}
                </div>
            `}).join('')}
        `;
        }

        function categoryLabel(c) {
            const map = { food: 'Food', water: 'Water', medicine: 'Medicine', shelter: 'Shelter' };
            return map[c] || c;
        }

        function showAssignMsg(text, type) {
            const el = document.getElementById('assignMsg');
            el.textContent = text;
            el.className = type;
            setTimeout(clearAssignMsg, 4000);
        }
        function clearAssignMsg() {
            const el = document.getElementById('assignMsg');
            el.textContent = '';
            el.className = '';
        }

       let pendingCancelAssignmentId = null;
       let pendingCancelBtn = null;
        function cancelAssignment(assignmentId, btn) {
    pendingCancelAssignmentId = assignmentId;
    pendingCancelBtn = btn;
    document.getElementById('cancelModal').style.display = 'flex';
}

       function closeCancelModal() {
    document.getElementById('cancelModal').style.display = 'none';
    pendingCancelAssignmentId = null;
    pendingCancelBtn = null;
}

        document.getElementById('confirmCancelBtn').addEventListener('click', async function () {
    const assignmentId = pendingCancelAssignmentId;
    const btn = pendingCancelBtn;

    if (!assignmentId) return;

    closeCancelModal();

    btn.disabled = true;
    btn.textContent = 'Canceling...';

    try {
        const res = await fetch(`${API}/assignments/${assignmentId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.detail || 'An error occurred.');
            btn.disabled = false;
            btn.textContent = 'Cancel Assignment';
        } else {
            await loadAll();
        }
    } catch (e) {
        alert('Could not connect to server.');
        btn.disabled = false;
        btn.textContent = 'Cancel Assignment';
    }
});
        function logout() {
            localStorage.clear();
            window.location.href = 'login.html';
        }

        loadAll();
