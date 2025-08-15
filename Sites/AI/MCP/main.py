from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Dict, Any

app = FastAPI(
    title="Universal MCP Server",
    description="A universal tool/function handler for LLMs like Claude and ChatGPT",
    version="1.0.0"
)

# Security setup
security = HTTPBearer()
API_KEYS = {
    # Master key for all tools
    "mcp_systemprompt_8k2j9x4m7n1q5w8e3r6t9y2u5i8o1p4s": {"name": "Master", "permissions": ["*"]},
}

def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify API key and return permissions"""
    api_key = credentials.credentials
    if api_key not in API_KEYS:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return API_KEYS[api_key]

def check_permission(tool_name: str, user_info: dict) -> bool:
    """Check if user has permission for specific tool"""
    permissions = user_info.get("permissions", [])
    return "*" in permissions or tool_name in permissions

# Add CORS middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class HelloRequest(BaseModel):
    name: str

class HelloResponse(BaseModel):
    message: str

# Tool schemas for OpenAI/Claude compatibility
TOOL_SCHEMAS = {
    "hello": {
        "type": "function",
        "function": {
            "name": "hello",
            "description": "Greets a person by name",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "The name of the person to greet"
                    }
                },
                "required": ["name"]
            }
        }
    }
}

@app.get("/")
async def root():
    """Root endpoint with server information"""
    return {
        "name": "Universal MCP Server",
        "version": "1.0.0",
        "description": "A universal tool/function handler for LLMs",
        "available_tools": list(TOOL_SCHEMAS.keys())
    }

@app.get("/tools")
async def list_tools():
    """List all available tools with their schemas"""
    return {
        "tools": TOOL_SCHEMAS
    }

@app.get("/tools/schemas")
async def get_tool_schemas():
    """Get OpenAI/Claude compatible function schemas"""
    return {
        "schemas": list(TOOL_SCHEMAS.values())
    }

@app.post("/tools/hello", response_model=HelloResponse)
async def hello_tool(request: HelloRequest, user_info: dict = Depends(verify_api_key)):
    """Hello tool - greets a person by name"""
    if not check_permission("hello", user_info):
        raise HTTPException(status_code=403, detail="Insufficient permissions for hello tool")

    try:
        message = f"Hello, {request.name}!"
        return HelloResponse(message=message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing hello request: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Universal MCP Server"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
