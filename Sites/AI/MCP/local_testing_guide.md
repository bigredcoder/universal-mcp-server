# Local Testing Guide

## Quick Testing with ngrok (Recommended for initial testing)

### 1. Install ngrok
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 2. Start your MCP server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Expose it publicly (in another terminal)
```bash
ngrok http 8000
```

You'll get a public URL like: `https://abc123.ngrok.io`

### 4. Test with external services

**ChatGPT (with Custom GPT or API):**
- Use the ngrok URL: `https://abc123.ngrok.io/tools/hello`
- Function schema available at: `https://abc123.ngrok.io/tools/schemas`

**n8n:**
- Create HTTP Request node
- URL: `https://abc123.ngrok.io/tools/hello`
- Method: POST
- Body: `{"name": "Brian"}`

**Claude (via API):**
```python
import anthropic

client = anthropic.Anthropic(api_key="your-api-key")

# Use the function schema from your server
tools = [
    {
        "name": "hello",
        "description": "Greets a person by name",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Name to greet"}
            },
            "required": ["name"]
        }
    }
]

response = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1000,
    tools=tools,
    messages=[{"role": "user", "content": "Say hello to Brian"}]
)
```

## Testing with Different Platforms

### 1. n8n Testing

**If you have n8n Cloud or self-hosted:**

1. Create a new workflow
2. Add "HTTP Request" node
3. Configure:
   - Method: POST
   - URL: `https://your-ngrok-url.ngrok.io/tools/hello`
   - Headers: `Content-Type: application/json`
   - Body: `{"name": "{{ $json.name }}"}`

**Test the n8n tool endpoint:**
1. Update your n8n webhook URL in the code
2. Create a webhook in n8n
3. Test calling your MCP server's `/tools/run_n8n` endpoint

### 2. ChatGPT Testing

**Option A: Custom GPT (ChatGPT Plus required)**
1. Create a Custom GPT
2. In "Actions", add your OpenAPI schema
3. Use your ngrok URL as the base URL

**Option B: OpenAI API with Function Calling**
```python
import openai

client = openai.OpenAI(api_key="your-api-key")

# Get function schemas from your server
import requests
schemas = requests.get("https://your-ngrok-url.ngrok.io/tools/schemas").json()

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Say hello to Brian"}],
    tools=schemas["schemas"]
)
```

### 3. Claude Desktop Integration

Create a `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "universal-mcp": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "https://your-ngrok-url.ngrok.io/tools/hello",
        "-H", "Content-Type: application/json",
        "-d", "{\"name\": \"Brian\"}"
      ]
    }
  }
}
```

## Production Deployment

For **permanent testing and production use**, deploy to:

### Render.com (Recommended - Free tier)
- Follow the `DEPLOYMENT.md` guide
- Get a permanent URL like `https://your-app.onrender.com`
- No need for ngrok

### Other Options
- **Railway**: Similar to Render, easy deployment
- **Fly.io**: Good for global deployment
- **AWS Lambda**: Serverless option
- **Google Cloud Run**: Pay-per-use

## Security Notes

⚠️ **ngrok exposes your local server publicly**
- Only use for testing
- Don't expose sensitive data
- Consider ngrok's auth features for protection

For production:
- Use proper hosting (Render, AWS, etc.)
- Add authentication
- Use environment variables for secrets
- Enable HTTPS (automatic with most hosts)

## Quick Test Commands

```bash
# Test hello endpoint
curl -X POST "https://your-url/tools/hello" \
     -H "Content-Type: application/json" \
     -d '{"name": "Brian"}'

# Test n8n endpoint (will fail without real n8n server)
curl -X POST "https://your-url/tools/run_n8n" \
     -H "Content-Type: application/json" \
     -d '{"workflow": "test", "data": {"key": "value"}}'

# Get function schemas
curl "https://your-url/tools/schemas"
```
