import qrcode
import os
import sys
import socket

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def get_base_url():
    # Priority: CLI arg > BASE_URL env var > local network IP (dev fallback)
    # In production, pass your Cloud Run URL, e.g.:
    #   python generate_qr.py https://wcs-xxxxx.europe-west1.run.app
    if len(sys.argv) > 1:
        root = sys.argv[1]
    elif os.environ.get("BASE_URL"):
        root = os.environ["BASE_URL"]
    else:
        root = f"http://{get_local_ip()}:5000"
    return root.rstrip("/") + "/table/"

def generate_codes():
    base_url = get_base_url()
    output_dir = "qr_codes"
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Generating QR Codes using base URL: {base_url}")
    print(f"Saving to {output_dir}/...")
    for table_num in range(1, 21):
        url = f"{base_url}{table_num}"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)

        # Create an image from the QR Code instance
        img = qr.make_image(fill_color="black", back_color="white")
        
        filepath = os.path.join(output_dir, f"table_{table_num}.png")
        img.save(filepath)
        print(f"Saved: {filepath}")

    print("Success! QR codes generated.")

if __name__ == '__main__':
    generate_codes()
