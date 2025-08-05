from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import httpx
from typing import Dict, Any, List, Optional
import json
import os
import secrets

app = FastAPI(
    title="Universal MCP Server",
    description="A universal tool/function handler for LLMs like Claude, ChatGPT, and platforms like n8n",
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

class N8nRequest(BaseModel):
    workflow: str
    data: Dict[str, Any] = {}

class N8nResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: str = ""

class NotionRequest(BaseModel):
    database_id: str
    properties: Dict[str, Any] = {}

class NotionResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: str = ""

class ToolSchema(BaseModel):
    type: str = "function"
    function: Dict[str, Any]

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
    },
    "run_n8n": {
        "type": "function",
        "function": {
            "name": "run_n8n",
            "description": "Triggers an n8n workflow via webhook",
            "parameters": {
                "type": "object",
                "properties": {
                    "workflow": {
                        "type": "string",
                        "description": "The name/identifier of the n8n workflow to trigger"
                    },
                    "data": {
                        "type": "object",
                        "description": "Optional data to send to the workflow",
                        "additionalProperties": True
                    }
                },
                "required": ["workflow"]
            }
        }
    },
    "notion": {
        "type": "function",
        "function": {
            "name": "notion",
            "description": "Creates a new page in a Notion database (requires authentication)",
            "parameters": {
                "type": "object",
                "properties": {
                    "database_id": {
                        "type": "string",
                        "description": "The ID of the Notion database to create a page in"
                    },
                    "properties": {
                        "type": "object",
                        "description": "The properties/content for the new Notion page",
                        "additionalProperties": True
                    }
                },
                "required": ["database_id", "properties"]
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

@app.post("/tools/run_n8n", response_model=N8nResponse)
async def run_n8n_tool(request: N8nRequest):
    """N8n tool - triggers an n8n workflow via webhook"""
    try:
        # Construct the webhook URL
        webhook_url = f"https://my-n8n-server/webhook/{request.workflow}"
        
        # Prepare the payload
        payload = request.data if request.data else {}
        
        # Make the HTTP request to n8n webhook
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(webhook_url, json=payload)
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                except json.JSONDecodeError:
                    response_data = {"raw_response": response.text}
                
                return N8nResponse(
                    success=True,
                    data=response_data,
                    message=f"Successfully triggered workflow: {request.workflow}"
                )
            else:
                return N8nResponse(
                    success=False,
                    data={"status_code": response.status_code, "response": response.text},
                    message=f"Failed to trigger workflow: {request.workflow}"
                )
                
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=408, 
            detail=f"Timeout while calling n8n webhook for workflow: {request.workflow}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error calling n8n webhook: {str(e)}"
        )

@app.post("/tools/notion", response_model=NotionResponse)
async def notion_tool(request: NotionRequest, user_info: dict = Depends(verify_api_key)):
    """Notion tool - creates pages in Notion database (PROTECTED)"""
    if not check_permission("notion", user_info):
        raise HTTPException(status_code=403, detail="Insufficient permissions for Notion tool")

    try:
        # Get Notion API key from environment (secure)
        notion_token = os.getenv("NOTION_API_KEY")
        if not notion_token:
            raise HTTPException(status_code=500, detail="Notion API key not configured")

        # Call Notion API
        headers = {
            "Authorization": f"Bearer {notion_token}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
        }

        payload = {
            "parent": {"database_id": request.database_id},
            "properties": request.properties
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.notion.com/v1/pages",
                headers=headers,
                json=payload
            )

            if response.status_code == 200:
                return NotionResponse(
                    success=True,
                    data=response.json(),
                    message="Successfully created Notion page"
                )
            else:
                return NotionResponse(
                    success=False,
                    data={"status_code": response.status_code, "response": response.text},
                    message="Failed to create Notion page"
                )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calling Notion API: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Universal MCP Server"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
