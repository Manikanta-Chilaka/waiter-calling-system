// Frontend common logic

// Customer functions
async function callWaiter(tableId) {
    const btn = document.getElementById('callWaiterBtn');
    const statusMsg = document.getElementById('statusMessage');
    const errMsg = document.getElementById('errorMessage');

    btn.disabled = true;
    btn.innerHTML = 'Calling...';
    errMsg.style.display = 'none';

    try {
        const response = await fetch('/api/call-waiter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: tableId })
        });

        const result = await response.json();

        if (response.ok) {
            btn.innerHTML = 'Waitlist Joined';
            statusMsg.style.display = 'block';
            statusMsg.textContent = 'Waiter is coming!';
        } else {
            throw new Error(result.error || 'Failed to call waiter');
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = 'CALL WAITER';
        errMsg.style.display = 'block';
        errMsg.textContent = err.message;
    }
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
