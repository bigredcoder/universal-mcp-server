# Universal MCP Server

A FastAPI-based universal tool/function handler for LLMs like Claude, ChatGPT, and platforms like n8n and Augment.

## Features

- **FastAPI-based**: High-performance async web framework
- **Universal compatibility**: Works with OpenAI, Claude, and other LLM platforms
- **Tool endpoints**: Extensible tool system with JSON schema support
- **CORS enabled**: Cross-origin requests supported
- **Health checks**: Built-in health monitoring
- **Easy deployment**: Ready for Render.com deployment

## Available Tools

### 1. Hello Tool (`/tools/hello`)
Greets a person by name.

**Request:**
```json
{
  "name": "Brian"
}
```

**Response:**
```json
{
  "message": "Hello, Brian!"
}
```

### 2. N8n Webhook Tool (`/tools/run_n8n`)
Triggers an n8n workflow via webhook.

**Request:**
```json
{
  "workflow": "send_email",
  "data": {
    "recipient": "user@example.com",
    "subject": "Test Email"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "Successfully triggered workflow: send_email"
}
```

## Local Development

### Prerequisites
- Python 3.8+
- pip

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd MCP
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`

### Testing the API

1. **View API documentation**: Visit `http://localhost:8000/docs` for interactive Swagger UI
2. **List available tools**: `GET http://localhost:8000/tools`
3. **Get tool schemas**: `GET http://localhost:8000/tools/schemas`
4. **Test hello tool**: `POST http://localhost:8000/tools/hello` with `{"name": "Brian"}`
5. **Test n8n tool**: `POST http://localhost:8000/tools/run_n8n` with `{"workflow": "test"}`

## API Endpoints

- `GET /` - Server information
- `GET /tools` - List all available tools with schemas
- `GET /tools/schemas` - Get OpenAI/Claude compatible function schemas
- `POST /tools/hello` - Hello tool endpoint
- `POST /tools/run_n8n` - N8n webhook tool endpoint
- `GET /health` - Health check endpoint

## OpenAI/Claude Integration

The server provides OpenAI and Claude-compatible function schemas at `/tools/schemas`. These can be used directly with:

- **OpenAI API**: Use the schemas in the `tools` parameter
- **Claude API**: Use the schemas in the `tools` parameter
- **Augment**: Configure as tool endpoints
- **n8n**: Use HTTP Request nodes to call the endpoints

## Deployment to Render.com

See the deployment section below for detailed instructions.

## Future Enhancements

- Memory support (Redis/Pinecone integration)
- Claude Desktop integration
- Additional tool endpoints
- Authentication and rate limiting
- Logging and monitoring
