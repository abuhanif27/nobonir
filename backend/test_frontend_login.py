#!/usr/bin/env python
"""
Simulate the frontend login request using the axios configuration
"""
import requests
import json

# Simulate the frontend API configuration
API_BASE_URL = "http://127.0.0.1:8000/api"
LOGIN_ENDPOINT = "/auth/token/"

print("\n=== SIMULATING FRONTEND LOGIN REQUEST ===\n")

try:
    # Make the same request the frontend would make
    response = requests.post(
        f"{API_BASE_URL}{LOGIN_ENDPOINT}",
        json={
            "email": "admin@nobonir.com",
            "password": "admin@1234"
        },
        headers={
            "Content-Type": "application/json",
        }
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    print(f"\nResponse Body:")
    print(json.dumps(response.json(), indent=2))
    
    if response.status_code == 200:
        data = response.json()
        if all(k in data for k in ["access", "refresh", "user"]):
            print("\n✓ Response format matches frontend expectations")
            print("  - access token present")
            print("  - refresh token present")
            print("  - user object present")
        else:
            print("\n✗ Response format does NOT match frontend expectations")
            print(f"  Missing fields. Expected: access, refresh, user")
            print(f"  Got: {list(data.keys())}")
    
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
