from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from typing import Dict, Any, List
import json

app = FastAPI(
    title="Universal MCP Server",
    description="A universal tool/function handler for LLMs like Claude, ChatGPT, and platforms like n8n",
    version="1.0.0"
)

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
async def hello_tool(request: HelloRequest):
    """Hello tool - greets a person by name"""
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

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Universal MCP Server"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
