import qrcode
import os
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

def generate_codes():
    ip_addr = get_local_ip()
    base_url = f"http://{ip_addr}:5000/table/" # Dynamic local network URL
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
