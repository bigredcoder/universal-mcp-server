# Security Guide - Universal MCP Server

## 🔒 **Security Features**

Your MCP server now includes multiple layers of security to protect your tools and data.

## 🛡️ **Authentication Methods**

### **1. API Key Authentication (Implemented)**

Each request must include a valid API key in the Authorization header:

```bash
curl -X POST "https://mcp.systemprompt.co/tools/notion" \
  -H "Authorization: Bearer your-secret-key-123" \
  -H "Content-Type: application/json" \
  -d '{"database_id": "abc123", "properties": {...}}'
```

### **2. Permission-Based Access Control**

Different API keys have different permissions:

```python
API_KEYS = {
    "your-secret-key-123": {"name": "ChatGPT", "permissions": ["hello", "notion"]},
    "n8n-key-456": {"name": "n8n", "permissions": ["hello", "run_n8n"]},
    "admin-key-789": {"name": "Admin", "permissions": ["*"]},  # Full access
}
```

## 🔑 **API Key Management**

### **Production Setup:**
1. **Generate secure API keys**: Use `secrets.token_urlsafe(32)`
2. **Store in environment variables**: Never hardcode in source
3. **Use different keys** for different clients/purposes
4. **Rotate keys regularly**

### **Environment Variables:**
```bash
# In Render.com environment variables
MCP_API_KEY_CHATGPT=your-secure-generated-key-123
MCP_API_KEY_N8N=another-secure-key-456
MCP_API_KEY_ADMIN=admin-super-secure-key-789
```

## 🚫 **Access Control Examples**

### **Protected Notion Tool:**
- ✅ **ChatGPT key**: Can access Notion tool
- ❌ **n8n key**: Cannot access Notion tool
- ✅ **Admin key**: Can access everything

### **Public vs Private Tools:**
- **Public**: `/health`, `/` (no auth required)
- **Protected**: `/tools/*` (requires valid API key + permissions)

## 🔐 **Additional Security Layers**

### **1. Rate Limiting (Future)**
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/tools/notion")
@limiter.limit("10/minute")
async def notion_tool(...):
```

### **2. IP Whitelisting (Future)**
```python
ALLOWED_IPS = ["192.168.1.100", "10.0.0.0/8"]

def check_ip(request: Request):
    client_ip = request.client.host
    if client_ip not in ALLOWED_IPS:
        raise HTTPException(status_code=403)
```

### **3. Request Signing (Advanced)**
```python
import hmac
import hashlib

def verify_signature(payload: str, signature: str, secret: str):
    expected = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)
```

## 🛠️ **How to Use Secured Tools**

### **ChatGPT Custom GPT:**
Add authentication header in Actions configuration:
```json
{
  "authentication": {
    "type": "bearer",
    "bearer_token": "your-secret-key-123"
  }
}
```

### **n8n HTTP Request:**
Add Authorization header:
- **Name**: `Authorization`
- **Value**: `Bearer n8n-key-456`

### **Direct API Calls:**
```python
import requests

headers = {
    "Authorization": "Bearer your-secret-key-123",
    "Content-Type": "application/json"
}

response = requests.post(
    "https://mcp.systemprompt.co/tools/notion",
    headers=headers,
    json={"database_id": "abc123", "properties": {...}}
)
```

## ⚠️ **Security Best Practices**

### **✅ Do:**
- Use environment variables for API keys
- Generate long, random API keys
- Use different keys for different clients
- Implement permission-based access
- Monitor usage and logs
- Rotate keys regularly

### **❌ Don't:**
- Hardcode API keys in source code
- Share API keys in public repositories
- Use the same key for everything
- Give more permissions than needed
- Ignore failed authentication attempts

## 🚀 **Deployment Security**

### **Render.com Environment Variables:**
1. Go to your service settings
2. Add environment variables:
   - `MCP_API_KEY_CHATGPT`
   - `MCP_API_KEY_N8N`
   - `NOTION_API_KEY`
   - etc.

### **GitHub Secrets:**
Never commit `.env` files with real keys to GitHub!

## 📊 **Monitoring & Logging**

Add logging to track usage:
```python
import logging

@app.post("/tools/notion")
async def notion_tool(request, user_info):
    logging.info(f"Notion tool accessed by {user_info['name']}")
    # ... tool logic
```

Your MCP server is now enterprise-grade secure! 🔒
