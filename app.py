from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_socketio import SocketIO, emit
import sqlite3
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_mvp_key!'
socketio = SocketIO(app, cors_allowed_origins="*")

DATABASE = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

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

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO requests (table_number, status)
        VALUES (?, 'pending')
    ''', (table_id,))
    conn.commit()
    request_id = cursor.lastrowid
    
    # Fetch the newly created request to send it back
    cursor.execute('SELECT * FROM requests WHERE id = ?', (request_id,))
    new_request = dict(cursor.fetchone())
    conn.close()

    # Emit event to all connected waiter dashboards
    socketio.emit('new_request', new_request)

    return jsonify({'success': True, 'request': new_request}), 201

@app.route('/api/requests', methods=['GET'])
def get_requests():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM requests WHERE status != 'completed' ORDER BY created_at DESC")
    requests = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(requests)

@app.route('/api/update-request', methods=['POST'])
def update_request():
    data = request.json
    request_id = data.get('id')
    new_status = data.get('status')
    accepted_by = data.get('accepted_by', 'Waiter 1') # Defaulting for MVP

    if not request_id or not new_status:
        return jsonify({'error': 'Missing data'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if new_status == 'accepted':
        cursor.execute('''
            UPDATE requests SET status = ?, accepted_by = ? WHERE id = ?
        ''', (new_status, accepted_by, request_id))
    elif new_status == 'completed':
        cursor.execute('''
            UPDATE requests SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?
        ''', (new_status, request_id))
    
    conn.commit()
    
    # Fetch updated request
    cursor.execute('SELECT * FROM requests WHERE id = ?', (request_id,))
    updated_request = dict(cursor.fetchone())
    conn.close()

    # Broadcast update
    socketio.emit('update_request', updated_request)

    return jsonify({'success': True, 'request': updated_request})

if __name__ == '__main__':
    # Initialize DB if it doesn't exist
    if not os.path.exists(DATABASE):
        try:
            import init_db
            init_db.init_db()
        except Exception as e:
            print(f"Could not auto-initialize DB: {e}")
            
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
