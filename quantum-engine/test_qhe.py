import requests
import json

url = "http://127.0.0.1:8000/score"

payload = {
    "tenant_id": "test-tenant-123",
    "post_id": "post-xyz",
    "features": {
        "brand_alignment_score": 0.9,
        "structural_integrity": 0.8,
        "emotion_intensity": 0.85,
        "clarity_score": 0.95
    }
}

headers = {"Content-Type": "application/json"}

try:
    response = requests.post(url, json=payload, headers=headers)
    print("Status Code:", response.status_code)
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error testing QHE: {e}")
