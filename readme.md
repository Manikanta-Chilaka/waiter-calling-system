QR Waiter Calling System – MVP
Overview

This project allows restaurant customers to scan a QR code at their table and request a waiter.
The request appears instantly on a waiter dashboard and sends a push notification to waiter phones.

Workflow
Customer scans QR → Press "Call Waiter"
        ↓
Backend API stores request
        ↓
Waiter dashboard updates in real time
        ↓
Waiter accepts request
        ↓
Customer sees "Waiter is coming"
🎯 MVP Goals

The first version will support:

Customer:

Scan QR code

Call waiter

Waiter:

Receive notification

Accept request

Mark request completed

Admin:

See all table requests

🧰 Technologies Used
Backend

Python

Flask

Flask-SocketIO (real-time updates)

Frontend

HTML

CSS

JavaScript

Bootstrap

Database

SQLite (simple for MVP)

Real-Time Communication

WebSockets using Flask-SocketIO

Notifications

Firebase Cloud Messaging (optional later)

QR Code Generation

Python qrcode library

Deployment

Render / Railway / VPS

📁 Project Structure
qr-waiter-system/
│
├── app.py
├── database.db
├── requirements.txt
│
├── templates/
│   ├── customer.html
│   ├── waiter.html
│
├── static/
│   ├── style.css
│   ├── script.js
│
└── qr_codes/
    ├── table1.png
    ├── table2.png
⚙️ Step 1 – Setup Environment

Create project folder:

mkdir qr-waiter-system
cd qr-waiter-system

Create virtual environment:

python -m venv venv

Activate it:

Linux / Mac

source venv/bin/activate

Windows

venv\Scripts\activate
📦 Step 2 – Install Dependencies
pip install flask flask-socketio qrcode

Create requirements.txt

flask
flask-socketio
qrcode
🗄️ Step 3 – Database Design

For the MVP we only need one table.

Table: requests

Fields:

id
table_number
status
created_at
accepted_by
completed_at

Status values:

pending
accepted
completed
🧑‍💻 Step 4 – Backend (Flask API)

Create app.py.

Main routes:

1️⃣ Customer Page
GET /table/<table_id>

Example:

restaurant.com/table/5

Customer sees:

Call Waiter Button
2️⃣ Call Waiter API
POST /call-waiter

Example request:

{
  "table": 5
}

Backend will:

Create request in database

Notify waiters

3️⃣ Waiter Dashboard
GET /waiter

Displays all requests.

Example:

Table 3 - Waiting
Table 6 - Accepted
Table 8 - Waiting
🔔 Step 5 – Real-Time Notifications

Use Flask-SocketIO.

When a request is created:

socket.emit("new_request", request_data)

Waiter dashboard receives:

New Table Request
📱 Step 6 – Customer Page

templates/customer.html

Simple UI:

-------------------
Table 5

Need assistance?

[ CALL WAITER ]
-------------------

After clicking:

Waiter is coming!
👨‍🍳 Step 7 – Waiter Dashboard

templates/waiter.html

Example layout:

--------------------------------
Table 4 | Waiting | Accept
Table 6 | Waiting | Accept
Table 2 | Accepted by Ravi
--------------------------------

Buttons:

Accept
Complete
🔳 Step 8 – Generate QR Codes

Create a Python script:

import qrcode

base_url = "http://localhost:5000/table/"

for table in range(1, 21):
    url = base_url + str(table)
    img = qrcode.make(url)
    img.save(f"qr_codes/table_{table}.png")

Print and place the QR codes on tables.

🧪 Step 9 – Run Project Locally

Start server:

python app.py

Open:

Customer page

http://localhost:5000/table/1

Waiter dashboard

http://localhost:5000/waiter

Test flow:

Scan QR

Press call waiter

Waiter dashboard updates

Accept request

Mark complete

🚀 Step 10 – Deployment

Deploy backend using:

Render

Railway

DigitalOcean

AWS

Example production URL:

https://restaurantservice.app/table/5

Regenerate QR codes with the new URL.

📊 Data You Will Collect

Your system will capture:

table requests
response time
waiter performance
peak hours
customer ratings

This data can later power:

restaurant analytics

waiter performance tracking

service optimization

🔮 Future Features

Phase 2:

Waiter login
Push notifications
Customer rating

Phase 3:

Restaurant analytics dashboard
Average response time
Top performing waiters