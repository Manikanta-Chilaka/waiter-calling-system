from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_mvp_key!'

# Neon Cloud PostgreSQL
NEON_DB_URL = 'postgresql://neondb_owner:npg_bV9weU7SMCjZ@ep-twilight-snow-a816ghyg-pooler.eastus2.azure.neon.tech/waiter_db?sslmode=require'
app.config['SQLALCHEMY_DATABASE_URI'] = NEON_DB_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

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

    def to_dict(self):
        return {
            'id': self.id,
            'table_number': self.table_number,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'accepted_by': self.accepted_by,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'click_count': self.click_count,
            'accepted_at': self.accepted_at.isoformat() if self.accepted_at else None
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
    if not table_id:
        return jsonify({'error': 'Table number is required'}), 400

    # Check if there is already a pending request for this table
    existing_request = WaiterRequest.query.filter_by(table_number=table_id, status='pending').first()
    
    if existing_request:
        existing_request.click_count += 1
        db.session.commit()
        req_dict = existing_request.to_dict()
        socketio.emit('update_request', req_dict)
        return jsonify({'success': True, 'request': req_dict, 'message': 'Called again!'}), 200
    else:
        new_request = WaiterRequest(table_number=table_id)
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
