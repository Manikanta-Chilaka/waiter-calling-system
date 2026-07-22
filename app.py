from flask import Flask, render_template, request, jsonify, redirect, url_for, Response
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import os
import io
import json
import urllib.parse
import qrcode

from menu import MENU, MENU_BY_ID, CATEGORIES

# ----- Payment / tax config -----
# IMPORTANT: set UPI_VPA to the restaurant's REAL UPI ID or customers can't pay.
# Override via environment variables on Cloud Run (recommended) or edit here.
UPI_VPA = os.environ.get('UPI_VPA', 'basilbites@okicici')   # e.g. 9876543210@okhdfcbank
UPI_PAYEE = os.environ.get('UPI_PAYEE', 'Basil Bites')
GST_RATE = float(os.environ.get('GST_RATE', '0.05'))         # 5% GST; set 0 to disable

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_mvp_key!'

# Database URL from environment variable (set in Render dashboard)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
# allow_upgrades=False: the threading/gthread worker can't serve WebSocket,
# so we stay on HTTP long-polling. Advertising a websocket upgrade the server
# can't fulfill causes clients to flap between Connected/Disconnected.
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading", allow_upgrades=False)

class WaiterRequest(db.Model):
    __tablename__ = 'requests'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    table_number = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String, nullable=False, default='pending')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    accepted_by = db.Column(db.String, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    click_count = db.Column(db.Integer, default=1)
    accepted_at = db.Column(db.DateTime, nullable=True)
    reason = db.Column(db.String, nullable=True, default='service')  # 'service' | 'bill'

    def to_dict(self):
        return {
            'id': self.id,
            'table_number': self.table_number,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'accepted_by': self.accepted_by,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'click_count': self.click_count,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None,
            'reason': self.reason or 'service'
        }

class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    table_number = db.Column(db.Integer, nullable=False)
    items = db.Column(db.Text, nullable=False)          # JSON: [{"name","price","qty"}]
    total = db.Column(db.Float, nullable=False, default=0)
    status = db.Column(db.String, nullable=False, default='new')  # new | preparing | served
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'table_number': self.table_number,
            'items': json.loads(self.items) if self.items else [],
            'total': self.total,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

with app.app_context():
    db.create_all()
    print("Tables created successfully")

@app.route('/')
def index():
    return redirect(url_for('waiter_dashboard'))

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/customer')
def customer_redirect():
    # Redirect to table 1 as a default for testing purposes
    return redirect(url_for('customer_page', table_id=1))

@app.route('/table/<int:table_id>')
def customer_page(table_id):
    return render_template('customer.html', table_id=table_id)

@app.route('/waiter')
def waiter_dashboard():
    return render_template('waiter.html')

@app.route('/api/call-waiter', methods=['POST'])
def call_waiter():
    data = request.json
    table_id = data.get('table')
    reason = data.get('reason', 'service')
    if reason not in ('service', 'bill', 'payment'):
        reason = 'service'
    if not table_id:
        return jsonify({'error': 'Table number is required'}), 400

    # Check if there is already a pending request of this kind for this table
    existing_request = WaiterRequest.query.filter_by(table_number=table_id, status='pending', reason=reason).first()

    if existing_request:
        existing_request.click_count += 1
        db.session.commit()
        req_dict = existing_request.to_dict()
        socketio.emit('update_request', req_dict)
        return jsonify({'success': True, 'request': req_dict, 'message': 'Called again!'}), 200
    else:
        new_request = WaiterRequest(table_number=table_id, reason=reason)
        db.session.add(new_request)
        db.session.commit()
        req_dict = new_request.to_dict()
        socketio.emit('new_request', req_dict)
        return jsonify({'success': True, 'request': req_dict}), 201

@app.route('/api/requests', methods=['GET'])
def get_requests():
    requests = WaiterRequest.query.filter(WaiterRequest.status != 'completed').order_by(WaiterRequest.created_at.desc()).all()
    return jsonify([req.to_dict() for req in requests])

@app.route('/api/update-request', methods=['POST'])
def update_request():
    data = request.json
    request_id = data.get('id')
    new_status = data.get('status')
    accepted_by = data.get('accepted_by', 'Waiter 1')

    if not request_id or not new_status:
        return jsonify({'error': 'Missing data'}), 400

    req = WaiterRequest.query.get(request_id)
    if not req:
        return jsonify({'error': 'Request not found'}), 404

    if new_status == 'accepted':
        req.status = new_status
        req.accepted_by = accepted_by
        req.accepted_at = datetime.now(timezone.utc)
    elif new_status == 'completed':
        req.status = new_status
        req.completed_at = datetime.now(timezone.utc)
    
    db.session.commit()
    req_dict = req.to_dict()
    socketio.emit('update_request', req_dict)

    return jsonify({'success': True, 'request': req_dict})

# ----------------------- Food Ordering -----------------------

@app.route('/api/menu', methods=['GET'])
def get_menu():
    return jsonify({'categories': CATEGORIES, 'items': MENU})

@app.route('/api/place-order', methods=['POST'])
def place_order():
    data = request.json or {}
    table_id = data.get('table')
    cart = data.get('items', [])  # [{"id": 1, "qty": 2}, ...]

    if not table_id:
        return jsonify({'error': 'Table number is required'}), 400
    if not cart:
        return jsonify({'error': 'Your cart is empty'}), 400

    # Build the order from the SERVER-SIDE menu so prices can't be tampered with.
    line_items = []
    total = 0
    for entry in cart:
        item = MENU_BY_ID.get(entry.get('id'))
        try:
            qty = int(entry.get('qty', 0))
        except (TypeError, ValueError):
            qty = 0
        if not item or qty <= 0:
            continue
        total += item['price'] * qty
        line_items.append({'name': item['name'], 'price': item['price'], 'qty': qty})

    if not line_items:
        return jsonify({'error': 'No valid items in order'}), 400

    order = Order(
        table_number=int(table_id),
        items=json.dumps(line_items),
        total=total,
        status='new',
    )
    db.session.add(order)
    db.session.commit()
    order_dict = order.to_dict()
    socketio.emit('new_order', order_dict)
    return jsonify({'success': True, 'order': order_dict}), 201

@app.route('/api/orders', methods=['GET'])
def get_orders():
    # Active orders = anything not yet served.
    orders = Order.query.filter(Order.status != 'served').order_by(Order.created_at.desc()).all()
    return jsonify([o.to_dict() for o in orders])

@app.route('/api/table-orders/<int:table_id>', methods=['GET'])
def table_orders(table_id):
    # Everything this table has ordered (any status) — the running bill.
    orders = Order.query.filter_by(table_number=table_id).order_by(Order.created_at.asc()).all()
    data = [o.to_dict() for o in orders]
    grand_total = sum(o.total for o in orders)
    return jsonify({'orders': data, 'grand_total': grand_total})

def _table_totals(table_id):
    orders = Order.query.filter_by(table_number=table_id).all()
    subtotal = round(sum(o.total for o in orders), 2)
    gst = round(subtotal * GST_RATE, 2)
    total = round(subtotal + gst, 2)
    return subtotal, gst, total, len(orders)

def _upi_url(table_id, amount):
    params = {
        'pa': UPI_VPA,
        'pn': UPI_PAYEE,
        'am': f"{amount:.2f}",
        'cu': 'INR',
        'tn': f"{UPI_PAYEE} Table {table_id}",
    }
    return "upi://pay?" + urllib.parse.urlencode(params)

@app.route('/api/pay-info/<int:table_id>', methods=['GET'])
def pay_info(table_id):
    subtotal, gst, total, n = _table_totals(table_id)
    return jsonify({
        'subtotal': subtotal, 'gst': gst, 'total': total, 'gst_rate': GST_RATE,
        'order_count': n, 'vpa': UPI_VPA, 'payee': UPI_PAYEE,
        'upi_url': _upi_url(table_id, total) if total > 0 else ''
    })

@app.route('/api/pay-qr/<int:table_id>')
def pay_qr(table_id):
    _, _, total, _ = _table_totals(table_id)
    img = qrcode.make(_upi_url(table_id, total))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return Response(buf.getvalue(), mimetype='image/png')

@app.route('/api/update-order', methods=['POST'])
def update_order():
    data = request.json or {}
    order_id = data.get('id')
    new_status = data.get('status')

    if not order_id or new_status not in ('new', 'preparing', 'served'):
        return jsonify({'error': 'Invalid data'}), 400

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    order.status = new_status
    db.session.commit()
    order_dict = order.to_dict()
    socketio.emit('order_updated', order_dict)
    return jsonify({'success': True, 'order': order_dict})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    # Only calculate stats for completed or accepted orders where accepted_at is not null
    requests = WaiterRequest.query.filter(WaiterRequest.accepted_at.isnot(None), WaiterRequest.accepted_by.isnot(None)).all()
    
    stats = {}
    for req in requests:
        waiter = req.accepted_by
        if waiter not in stats:
            stats[waiter] = {
                'orders_taken': 0,
                'total_response_time_seconds': 0
            }
            
        stats[waiter]['orders_taken'] += 1
        
        # Calculate response time
        if req.accepted_at and req.created_at:
            time_diff = req.accepted_at - req.created_at
            stats[waiter]['total_response_time_seconds'] += time_diff.total_seconds()
            
    # Calculate averages
    response_data = []
    for waiter, data in stats.items():
        avg_time = data['total_response_time_seconds'] / data['orders_taken'] if data['orders_taken'] > 0 else 0
        response_data.append({
            'waiter': waiter,
            'orders_taken': data['orders_taken'],
            'avg_response_time_seconds': round(avg_time, 2)
        })
        
    return jsonify(response_data)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
