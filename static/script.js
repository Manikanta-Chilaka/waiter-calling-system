// Frontend common logic

// Customer functions

// --- GPS Geolocation Validation ---
// Calculates distance between two coordinates using the Haversine formula
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radius of the earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

// ⚠️ IMPORTANT: Replace these coordinates with your actual restaurant's GPS coordinates!
// You can get these by right-clicking your restaurant building on Google Maps.
const RESTAURANT_LAT = 17.3850;   // Example Lat
const RESTAURANT_LON = 78.4867;   // Example Lon
const MAX_DISTANCE_METERS = 200;  // 200m is ideal because smartphone GPS can drift indoors!

function callWaiter(tableId) {
    const btn = document.getElementById('callWaiterBtn');
    const statusMsg = document.getElementById('statusMessage');
    const errMsg = document.getElementById('errorMessage');

    btn.disabled = true; // Briefly disable
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Checking Location...';
    errMsg.style.display = 'none';

    if (!navigator.geolocation) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        errMsg.style.display = 'block';
        errMsg.textContent = 'Geolocation is not supported by your browser.';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            
            const distance = getDistanceFromLatLonInM(userLat, userLon, RESTAURANT_LAT, RESTAURANT_LON);
            console.log("Distance from restaurant:", distance, "meters");

            if (distance > MAX_DISTANCE_METERS) {
                btn.disabled = false;
                btn.innerHTML = originalText;
                errMsg.style.display = 'block';
                errMsg.textContent = `You are too far from the restaurant (${Math.round(distance)}m). You must be within ${MAX_DISTANCE_METERS}m to order.`;
                return;
            }

            // Customer is within 200m! Proceed to call the waiter.
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Calling...';
            try {
                const response = await fetch('/api/call-waiter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ table: tableId })
                });

                const result = await response.json();

                if (response.ok) {
                    btn.innerHTML = '<i class="bi bi-bell-fill"></i> CALL WAITER AGAIN';
                    btn.disabled = false;
                    statusMsg.style.display = 'block';
                    statusMsg.textContent = result.message || 'Waiter is coming!';
                } else {
                    throw new Error(result.error || 'Failed to call waiter');
                }
            } catch (err) {
                btn.disabled = false;
                btn.innerHTML = originalText;
                errMsg.style.display = 'block';
                errMsg.textContent = err.message;
            }
        },
        (error) => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            errMsg.style.display = 'block';
            let errorMsg = 'Could not get your location.';
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg = 'Please allow Location Access to prove you are in the restaurant.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMsg = 'Location information is unavailable.';
            } else if (error.code === error.TIMEOUT) {
                errorMsg = 'The request to get your location timed out.';
            }
            errMsg.textContent = errorMsg;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// Waiter functions
const activeRequestsMap = new Map(); // Keep track of rendered requests

// Assign a persistent random Staff ID for this browser session
function getStaffId() {
    let staffId = sessionStorage.getItem('staffId');
    if (!staffId) {
        staffId = 'Staff ' + Math.floor(Math.random() * 900 + 100);
        sessionStorage.setItem('staffId', staffId);
    }
    return staffId;
}

const CURRENT_STAFF_ID = getStaffId();

// Display Staff ID in the top right corner
document.addEventListener('DOMContentLoaded', () => {
    const staffDisplay = document.getElementById('staffIdDisplay');
    if (staffDisplay) {
        staffDisplay.textContent = '👤 ' + CURRENT_STAFF_ID;
    }
});

async function loadRequests() {
    try {
        const response = await fetch('/api/requests');
        const requests = await response.json();
        const container = document.getElementById('requestsContainer');

        if (requests.length === 0) {
            document.getElementById('noRequestsMsg').style.display = 'block';
        } else {
            document.getElementById('noRequestsMsg').style.display = 'none';
            requests.forEach(req => addRequestToDashboard(req));
        }
    } catch (e) {
        console.error("Error loading requests:", e);
    }
}

function addRequestToDashboard(request) {
    // If it already exists and isn't completed, update it
    if (activeRequestsMap.has(request.id)) {
        updateRequestStatusUI(request);
        return;
    }

    if (request.status === 'completed') return;

    document.getElementById('noRequestsMsg').style.display = 'none';

    const template = document.getElementById('requestTemplate');
    const clone = template.content.cloneNode(true);
    const cardWrap = clone.querySelector('.request-card');
    cardWrap.id = `req-${request.id}`;

    // Fill data
    clone.querySelector('.table-number').textContent = request.table_number;
    
    if (request.click_count && request.click_count > 1) {
        // Add a click indicator badge
        const titleElem = clone.querySelector('.card-title');
        titleElem.innerHTML += ` <span class="badge bg-danger rounded-pill ms-2 click-badge" style="font-size: 0.7em;">${request.click_count} Clicks</span>`;
    }

    const timeElem = clone.querySelector('.time-ago');
    timeElem.textContent = new Date(request.created_at).toLocaleTimeString();

    // Map buttons
    const acceptBtn = clone.querySelector('.accept-btn');
    const completeBtn = clone.querySelector('.complete-btn');

    acceptBtn.onclick = () => updateStatus(request.id, 'accepted');
    completeBtn.onclick = () => updateStatus(request.id, 'completed');

    document.getElementById('requestsContainer').prepend(clone);
    activeRequestsMap.set(request.id, request);

    // Set initial UI state based on loaded status
    updateRequestStatusUI(request);

    if (request.status === 'pending') {
        document.getElementById(`req-${request.id}`).classList.add('new-request');
    }
}

function updateRequestStatusUI(request) {
    activeRequestsMap.set(request.id, request);
    const cardElem = document.getElementById(`req-${request.id}`);

    if (!cardElem) return; // Might have just arrived while UI is reloading
    
    // Update click count badge if present
    const titleElem = cardElem.querySelector('.card-title');
    let clickBadge = titleElem.querySelector('.click-badge');
    if (request.click_count && request.click_count > 1) {
        if (!clickBadge) {
            titleElem.innerHTML += ` <span class="badge bg-danger rounded-pill ms-2 click-badge" style="font-size: 0.7em;">${request.click_count} Clicks</span>`;
        } else {
            clickBadge.textContent = `${request.click_count} Clicks`;
        }
    }

    if (request.status === 'completed') {
        cardElem.remove();
        activeRequestsMap.delete(request.id);

        // Check if empty
        if (document.querySelectorAll('.request-card').length === 0) {
            document.getElementById('noRequestsMsg').style.display = 'block';
        }
        return;
    }

    const statusText = cardElem.querySelector('.status-text');
    const acceptBtn = cardElem.querySelector('.accept-btn');
    const completeBtn = cardElem.querySelector('.complete-btn');

    if (request.status === 'pending') {
        statusText.textContent = 'Waiting...';
        statusText.className = 'card-text status-text mb-4 text-warning fw-bold';
        acceptBtn.style.display = 'block';
        completeBtn.style.display = 'none';
        cardElem.classList.add('new-request');
    } else if (request.status === 'accepted') {
        statusText.textContent = `Accepted by ${request.accepted_by || 'Unknown'}`;
        statusText.className = 'card-text status-text mb-4 text-success fw-bold';

        completeBtn.style.display = 'block'; // Always allow overriding/completing it to clear dashboard

        if (request.accepted_by === CURRENT_STAFF_ID) {
            statusText.textContent = 'Accepted by You';
            completeBtn.textContent = 'Mark Completed';
            completeBtn.className = 'btn btn-success w-100 complete-btn fw-bold';
        } else {
            completeBtn.textContent = 'Force Complete'; // Different visual cue for overriding another staff's table
            completeBtn.className = 'btn btn-outline-danger w-100 complete-btn fw-bold';
        }

        acceptBtn.style.display = 'none';
        cardElem.classList.remove('new-request');
        cardElem.classList.add('accepted');
    }
}

async function updateStatus(requestId, newStatus) {
    try {
        const response = await fetch('/api/update-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: requestId,
                status: newStatus,
                accepted_by: CURRENT_STAFF_ID
            })
        });
        if (!response.ok) throw new Error("Update failed");
    } catch (e) {
        console.error("Error updating status:", e);
        alert("Failed to update status. Please try again.");
    }
}

function playNotificationSound() {
    // Simple notification beep
    try {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, context.currentTime); // A5
        gainNode.gain.setValueAtTime(0.1, context.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
    } catch (e) { /* ignore if audio context isn't allowed without user interacton */ }
}

// Waiter stats function
async function showStats() {
    const statsModal = new bootstrap.Modal(document.getElementById('statsModal'));
    statsModal.show();
    
    const body = document.getElementById('statsBody');
    body.innerHTML = '<div class="text-center">Loading stats...</div>';
    
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        if (stats.length === 0) {
            body.innerHTML = '<div class="text-center text-muted">No completed orders yet.</div>';
            return;
        }
        
        // Find current staff
        const myStats = stats.find(s => s.waiter === CURRENT_STAFF_ID);
        
        let html = '<h6 class="text-center text-warning mb-3">Your Stats</h6>';
        if (myStats) {
            html += `
            <div class="row mb-4 text-center">
                <div class="col-6">
                    <div class="fs-2 fw-bold">${myStats.orders_taken}</div>
                    <div class="small text-muted">Orders Taken</div>
                </div>
                <div class="col-6">
                    <div class="fs-2 fw-bold">${myStats.avg_response_time_seconds}s</div>
                    <div class="small text-muted">Avg Response</div>
                </div>
            </div>
            `;
        } else {
            html += '<div class="text-center mb-4">You have not taken any orders yet.</div>';
        }
        
        html += '<hr class="border-secondary"><h6 class="text-center text-muted mb-3">Leaderboard</h6>';
        
        // Sort by most orders taken
        stats.sort((a, b) => b.orders_taken - a.orders_taken);
        
        html += '<ul class="list-group list-group-flush" style="border-radius: 8px; overflow: hidden;">';
        stats.forEach((s, index) => {
            const isMe = s.waiter === CURRENT_STAFF_ID;
            html += `
            <li class="list-group-item bg-secondary text-white d-flex justify-content-between align-items-center ${isMe ? 'border border-warning' : ''}">
                <div>
                    <span class="badge bg-dark me-2">#${index + 1}</span>
                    ${s.waiter} ${isMe ? '(You)' : ''}
                </div>
                <span class="badge bg-primary rounded-pill">${s.orders_taken} calls</span>
            </li>
            `;
        });
        html += '</ul>';
        
        body.innerHTML = html;
        
    } catch (e) {
        body.innerHTML = '<div class="text-center text-danger">Failed to load stats.</div>';
    }
}
