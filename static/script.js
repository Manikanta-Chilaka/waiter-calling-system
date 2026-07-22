// Frontend common logic

// ============================================================
//  Tab switching (shared by customer + waiter pages)
// ============================================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(p => { p.style.display = 'none'; });
    const pane = document.getElementById(tabId);
    if (pane) pane.style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(btn => {
        const on = btn.dataset.tab === tabId;
        if (btn.classList.contains('btn')) {
            // Waiter page: Bootstrap fill / outline buttons
            btn.classList.toggle('btn-primary', on);
            btn.classList.toggle('btn-outline-primary', !on);
        } else {
            // Customer page: modern segmented nav
            btn.classList.toggle('active', on);
        }
    });

    // Refresh the bill each time it's opened
    if (tabId === 'billTab') loadBill();
}

// ============================================================
//  CUSTOMER — Call waiter
// ============================================================
async function callWaiter(tableId) {
    const btn = document.getElementById('callWaiterBtn');
    const statusMsg = document.getElementById('statusMessage');
    const errMsg = document.getElementById('errorMessage');

    btn.disabled = true; // Briefly disable
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Calling...';
    errMsg.style.display = 'none';

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
}

// ============================================================
//  CUSTOMER — Menu & cart
// ============================================================
let MENU_ITEMS = [];   // full menu list from the server
let MENU_MAP = {};     // id -> item
const cart = {};       // id -> quantity

async function loadMenu() {
    const container = document.getElementById('menuContainer');
    if (!container) return; // not on the customer page
    try {
        const res = await fetch('/api/menu');
        const data = await res.json();
        MENU_ITEMS = data.items || [];
        MENU_MAP = {};
        MENU_ITEMS.forEach(it => { MENU_MAP[it.id] = it; });
        renderMenu(data.categories || []);
    } catch (e) {
        container.innerHTML = '<div class="text-center text-danger py-4">Could not load the menu. Please try again.</div>';
    }
}

function renderMenu(categories) {
    const container = document.getElementById('menuContainer');
    let html = '';
    categories.forEach(cat => {
        const items = MENU_ITEMS.filter(it => it.category === cat);
        if (!items.length) return;
        html += `<h5 class="fw-bold text-dark mt-4 mb-3 border-bottom pb-2">${cat}</h5>`;
        items.forEach(it => {
            const dot = it.veg
                ? '<span class="veg-dot veg" title="Veg"></span>'
                : '<span class="veg-dot nonveg" title="Non-veg"></span>';
            html += `
            <div class="card mb-2 shadow-sm border-0 menu-item" id="menu-item-${it.id}">
              <div class="card-body d-flex justify-content-between align-items-center py-3">
                <div class="pe-3">
                  <div class="fw-semibold text-dark">${dot} ${it.name}</div>
                  <div class="small text-muted">${it.desc || ''}</div>
                  <div class="fw-bold text-dark mt-1">₹${it.price}</div>
                </div>
                <div class="qty-control text-nowrap">
                  <button class="btn btn-sm btn-outline-primary" onclick="changeQty(${it.id}, -1)">−</button>
                  <span class="mx-2 fw-bold qty-value" id="qty-${it.id}">0</span>
                  <button class="btn btn-sm btn-primary" onclick="changeQty(${it.id}, 1)">+</button>
                </div>
              </div>
            </div>`;
        });
    });
    container.innerHTML = html || '<div class="text-center text-muted py-4">Menu is empty.</div>';
}

function changeQty(id, delta) {
    const current = cart[id] || 0;
    const next = Math.max(0, current + delta);
    if (next === 0) delete cart[id];
    else cart[id] = next;
    const qtyEl = document.getElementById('qty-' + id);
    if (qtyEl) qtyEl.textContent = next;
    updateCartBar();
}

function updateCartBar() {
    const bar = document.getElementById('cartBar');
    if (!bar) return;
    let count = 0, total = 0;
    Object.keys(cart).forEach(id => {
        const item = MENU_MAP[id];
        if (!item) return;
        count += cart[id];
        total += item.price * cart[id];
    });
    if (count > 0) {
        bar.style.display = 'block';
        document.getElementById('cartCount').textContent = count + (count === 1 ? ' item' : ' items');
        document.getElementById('cartTotal').textContent = '₹' + total;
    } else {
        bar.style.display = 'none';
    }
}

async function placeOrder(tableId) {
    const items = Object.keys(cart).map(id => ({ id: parseInt(id, 10), qty: cart[id] }));
    if (!items.length) return;

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Placing…';

    try {
        const res = await fetch('/api/place-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: tableId, items })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Order failed');

        // Clear the cart + reset the steppers
        Object.keys(cart).forEach(id => {
            delete cart[id];
            const q = document.getElementById('qty-' + id);
            if (q) q.textContent = '0';
        });
        updateCartBar();

        const banner = document.getElementById('orderStatusBanner');
        banner.classList.remove('d-none');
        banner.className = 'alert alert-success fw-semibold';
        banner.textContent = '✅ Order #' + result.order.id + ' placed (₹' + result.order.total + ') — we’ll start preparing it shortly.';
        loadBill(); // keep the Bill tab up to date
    } catch (e) {
        alert(e.message || 'Could not place order. Please try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-bag-check-fill"></i> Place Order';
    }
}

// Called when the kitchen/waiter updates one of this table's orders
function showOrderStatus(order) {
    const banner = document.getElementById('orderStatusBanner');
    if (banner) {
        banner.classList.remove('d-none');
        if (order.status === 'preparing') {
            banner.className = 'alert alert-warning fw-semibold';
            banner.textContent = '👨‍🍳 Order #' + order.id + ' is being prepared.';
        } else if (order.status === 'served') {
            banner.className = 'alert alert-success fw-semibold';
            banner.textContent = '🍽️ Order #' + order.id + ' has been served. Enjoy!';
        }
    }
    // Keep the bill in sync with status changes
    if (document.getElementById('billTab') && document.getElementById('billTab').style.display !== 'none') {
        loadBill();
    }
}

// ============================================================
//  CUSTOMER — Bill
// ============================================================
async function loadBill() {
    const container = document.getElementById('billContainer');
    if (!container) return;
    const tableId = window.TABLE_ID;

    // Reset any previously generated receipt when re-opening the tab
    const receiptEl = document.getElementById('receipt');
    const printBtn = document.getElementById('printBillBtn');
    if (receiptEl) { receiptEl.classList.add('d-none'); receiptEl.innerHTML = ''; }
    if (printBtn) printBtn.classList.add('d-none');
    container.classList.remove('d-none');

    try {
        const res = await fetch('/api/table-orders/' + tableId);
        const data = await res.json();
        const orders = data.orders || [];

        if (!orders.length) {
            container.innerHTML =
                '<div class="text-center text-muted py-5">' +
                '<i class="bi bi-receipt" style="font-size:2.2rem;"></i>' +
                '<div class="mt-2">No orders yet. Your bill will appear here once you order.</div></div>';
            return;
        }

        let html = '<h5 class="fw-bold mb-3">Your Bill</h5>';
        orders.forEach(o => {
            const label = o.status === 'served' ? 'Served' : (o.status === 'preparing' ? 'Preparing' : 'New');
            const items = (o.items || []).map(li =>
                `<li class="d-flex justify-content-between"><span>${li.qty} × ${li.name}</span><span>₹${li.price * li.qty}</span></li>`
            ).join('');
            html +=
                `<div class="card mb-2 border-0 shadow-sm"><div class="card-body py-3">
                   <div class="d-flex justify-content-between small text-muted mb-2">
                     <span>Order #${o.id}</span><span>${label}</span>
                   </div>
                   <ul class="list-unstyled mb-2">${items}</ul>
                   <div class="d-flex justify-content-between fw-semibold border-top pt-2"><span>Subtotal</span><span>₹${o.total}</span></div>
                 </div></div>`;
        });
        html +=
            `<div class="card border-0 mt-3" style="background:var(--bb-green);color:#fff;">
               <div class="card-body d-flex justify-content-between align-items-center">
                 <span class="fw-bold fs-5">Grand Total</span>
                 <span class="fw-bold fs-4">₹${data.grand_total}</span>
               </div></div>`;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div class="text-center text-danger py-4">Could not load your bill. Please try again.</div>';
    }
}

async function requestBill(tableId) {
    const msg = document.getElementById('billRequestMsg');
    try {
        const res = await fetch('/api/call-waiter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: tableId, reason: 'bill' })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed');
        msg.className = 'alert alert-success fw-semibold mt-3';
        msg.textContent = '✅ Bill requested — a staff member will bring it to Table ' + tableId + '.';
    } catch (e) {
        msg.className = 'alert alert-danger fw-semibold mt-3';
        msg.textContent = 'Could not request the bill. Please try again.';
    }
}

// GST rate applied to the generated bill. 5% = standard Indian restaurant GST
// (2.5% CGST + 2.5% SGST). Set to 0 to show no tax, or change to your rate.
const GST_RATE = 0.05;

// Customer generates their own itemised bill/receipt (with tax + total).
async function generateBill() {
    const tableId = window.TABLE_ID;
    const container = document.getElementById('billContainer');
    const receipt = document.getElementById('receipt');
    const printBtn = document.getElementById('printBillBtn');
    if (!receipt) return;

    try {
        const res = await fetch('/api/table-orders/' + tableId);
        const data = await res.json();
        const orders = data.orders || [];
        if (!orders.length) {
            alert('No orders yet — add items from the Menu tab first.');
            return;
        }

        const subtotal = data.grand_total;
        const cgst = subtotal * GST_RATE / 2;
        const sgst = subtotal * GST_RATE / 2;
        const total = subtotal + cgst + sgst;

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const billNo = 'BB' + tableId + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
        const dateStr = now.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let lines = '';
        orders.forEach(o => {
            (o.items || []).forEach(li => {
                lines += `<tr><td>${li.qty} × ${li.name}</td><td class="text-end">₹${li.price * li.qty}</td></tr>`;
            });
        });

        const taxRows = GST_RATE > 0
            ? `<div><span>CGST (${(GST_RATE * 50).toFixed(2)}%)</span><span>₹${cgst.toFixed(2)}</span></div>
               <div><span>SGST (${(GST_RATE * 50).toFixed(2)}%)</span><span>₹${sgst.toFixed(2)}</span></div>`
            : '';

        receipt.innerHTML = `
          <div class="receipt-card">
            <div class="receipt-head">
              <div class="receipt-logo">🌿 BASIL BITES</div>
              <div class="receipt-sub">Fresh Bites · Taramani, Chennai</div>
            </div>
            <div class="receipt-meta">
              <div><span>Bill No</span><b>${billNo}</b></div>
              <div><span>Table</span><b>${tableId}</b></div>
              <div><span>Date</span><b>${dateStr}</b></div>
            </div>
            <table class="receipt-table">
              <thead><tr><th>Item</th><th class="text-end">Amount</th></tr></thead>
              <tbody>${lines}</tbody>
            </table>
            <div class="receipt-totals">
              <div><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
              ${taxRows}
              <div class="receipt-grand"><span>Grand Total</span><span>₹${total.toFixed(2)}</span></div>
            </div>
            <div class="receipt-foot">Thank you for dining with us! 🌿</div>
          </div>`;

        container.classList.add('d-none');
        receipt.classList.remove('d-none');
        printBtn.classList.remove('d-none');
        receipt.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
        alert('Could not generate the bill. Please try again.');
    }
}

function printBill() {
    window.print();
}

// ============================================================
//  WAITER — identity
// ============================================================
const activeRequestsMap = new Map(); // Keep track of rendered requests

function getStaffId() {
    let staffId = sessionStorage.getItem('staffId');
    if (!staffId) {
        staffId = 'Staff ' + Math.floor(Math.random() * 900 + 100);
        sessionStorage.setItem('staffId', staffId);
    }
    return staffId;
}

const CURRENT_STAFF_ID = getStaffId();

document.addEventListener('DOMContentLoaded', () => {
    const staffDisplay = document.getElementById('staffIdDisplay');
    if (staffDisplay) {
        staffDisplay.textContent = '👤 ' + CURRENT_STAFF_ID;
    }
});

function updateCallsCount() {
    const el = document.getElementById('callsCount');
    if (el) el.textContent = activeRequestsMap.size;
}

// ============================================================
//  WAITER — calls
// ============================================================
async function loadRequests() {
    const container = document.getElementById('requestsContainer');
    if (!container) return;
    try {
        const response = await fetch('/api/requests');
        const requests = await response.json();

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

    // Flag bill requests distinctly so staff know it's a payment, not service
    if (request.reason === 'bill') {
        const titleElem = clone.querySelector('.card-title');
        titleElem.innerHTML += ` <span class="badge text-bg-warning ms-2 bill-badge"><i class="bi bi-cash-coin"></i> BILL</span>`;
    }

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
    updateCallsCount();

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
        updateCallsCount();

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

// ============================================================
//  WAITER — food orders
// ============================================================
const activeOrdersMap = new Map();

function updateOrdersCount() {
    const el = document.getElementById('ordersCount');
    if (el) el.textContent = activeOrdersMap.size;
}

async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    if (!container) return; // not on the waiter page
    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        if (!orders.length) {
            document.getElementById('noOrdersMsg').style.display = 'block';
        } else {
            document.getElementById('noOrdersMsg').style.display = 'none';
            orders.forEach(o => addOrderToDashboard(o));
        }
    } catch (e) {
        console.error("Error loading orders:", e);
    }
}

function orderItemsHtml(order) {
    return (order.items || []).map(li =>
        `<li class="d-flex justify-content-between"><span>${li.qty} × ${li.name}</span><span class="text-muted">₹${li.price * li.qty}</span></li>`
    ).join('');
}

function orderStatusMeta(status) {
    if (status === 'new')       return { label: 'NEW',       badge: 'text-bg-danger' };
    if (status === 'preparing') return { label: 'PREPARING', badge: 'text-bg-warning' };
    return { label: 'SERVED', badge: 'text-bg-success' };
}

function renderOrderCardInner(order) {
    const meta = orderStatusMeta(order.status);
    const time = order.created_at ? new Date(order.created_at).toLocaleTimeString() : '';
    let actionBtn = '';
    if (order.status === 'new') {
        actionBtn = `<button class="btn btn-info w-100 fw-bold" onclick="updateOrderStatus(${order.id}, 'preparing')">Start Preparing</button>`;
    } else if (order.status === 'preparing') {
        actionBtn = `<button class="btn btn-success w-100 fw-bold" onclick="updateOrderStatus(${order.id}, 'served')">Mark Served</button>`;
    }
    return `
      <div class="card rounded-3 h-100">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="card-title fw-bold mb-0">Table ${order.table_number}</h5>
            <span class="badge ${meta.badge}">${meta.label}</span>
          </div>
          <p class="small text-muted mb-2">Order #${order.id} • ${time}</p>
          <ul class="list-unstyled mb-3">${orderItemsHtml(order)}</ul>
          <div class="fw-bold mb-3 border-top pt-2">Total: ₹${order.total}</div>
          <div class="mt-auto">${actionBtn}</div>
        </div>
      </div>`;
}

function addOrderToDashboard(order) {
    const container = document.getElementById('ordersContainer');
    if (!container) return;

    if (order.status === 'served') { updateOrderCard(order); return; }
    if (activeOrdersMap.has(order.id)) { updateOrderCard(order); return; }

    const noMsg = document.getElementById('noOrdersMsg');
    if (noMsg) noMsg.style.display = 'none';

    const col = document.createElement('div');
    col.className = 'col-md-4 mb-4 order-card';
    col.id = 'order-' + order.id;
    if (order.status === 'new') col.classList.add('new-request');
    col.innerHTML = renderOrderCardInner(order);
    container.prepend(col);
    activeOrdersMap.set(order.id, order);
    updateOrdersCount();
}

function updateOrderCard(order) {
    const el = document.getElementById('order-' + order.id);

    if (order.status === 'served') {
        if (el) el.remove();
        activeOrdersMap.delete(order.id);
        updateOrdersCount();
        if (document.querySelectorAll('.order-card').length === 0) {
            const noMsg = document.getElementById('noOrdersMsg');
            if (noMsg) noMsg.style.display = 'block';
        }
        return;
    }

    if (!el) { addOrderToDashboard(order); return; }
    el.classList.remove('new-request'); // stop flashing once it's moving through stages
    el.innerHTML = renderOrderCardInner(order);
    activeOrdersMap.set(order.id, order);
    updateOrdersCount();
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const res = await fetch('/api/update-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: orderId, status: newStatus })
        });
        if (!res.ok) throw new Error("Update failed");
    } catch (e) {
        console.error("Error updating order:", e);
        alert("Failed to update order. Please try again.");
    }
}

// ============================================================
//  Shared — notification sound
// ============================================================
function playNotificationSound() {
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
    } catch (e) { /* ignore if audio context isn't allowed without user interaction */ }
}

// ============================================================
//  WAITER — performance stats
// ============================================================
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
            <li class="list-group-item d-flex justify-content-between align-items-center ${isMe ? 'border border-danger' : ''}">
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
