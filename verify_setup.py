import urllib.request
import json
import socket
import time

def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def fetch_json(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        return str(e)

print("Verifying Setup...")
print(f"Backend (8000) listening: {check_port(8000)}")
print(f"Frontend (5173) listening: {check_port(5173)}")

if check_port(8000):
    products = fetch_json("http://127.0.0.1:8000/api/products/")
    if isinstance(products, dict) and "count" in products:
        print(f"Backend API (Products) OK: Found {products['count']} products")
    else:
        print(f"Backend API (Products) Error: {products}")

    search = fetch_json("http://127.0.0.1:8000/api/ai/search/?q=air%20fryer")
    if isinstance(search, list):
        print(f"AI Search OK: Found {len(search)} matches for 'air fryer'")
    else:
        print(f"AI Search Error: {search}")
