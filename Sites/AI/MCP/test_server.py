#!/usr/bin/env python3
"""
Test script for the Universal MCP Server
Run this to test the server endpoints locally
"""

import asyncio
import httpx
import json

BASE_URL = "http://localhost:8000"

async def test_server():
    """Test all server endpoints"""
    async with httpx.AsyncClient() as client:
        print("🚀 Testing Universal MCP Server")
        print("=" * 50)
        
        # Test root endpoint
        print("\n1. Testing root endpoint...")
        try:
            response = await client.get(f"{BASE_URL}/")
            print(f"✅ Status: {response.status_code}")
            print(f"📄 Response: {json.dumps(response.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test health check
        print("\n2. Testing health check...")
        try:
            response = await client.get(f"{BASE_URL}/health")
            print(f"✅ Status: {response.status_code}")
            print(f"📄 Response: {json.dumps(response.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test tools list
        print("\n3. Testing tools list...")
        try:
            response = await client.get(f"{BASE_URL}/tools")
            print(f"✅ Status: {response.status_code}")
            print(f"📄 Available tools: {list(response.json()['tools'].keys())}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test tool schemas
        print("\n4. Testing tool schemas...")
        try:
            response = await client.get(f"{BASE_URL}/tools/schemas")
            print(f"✅ Status: {response.status_code}")
            schemas = response.json()['schemas']
            print(f"📄 Found {len(schemas)} tool schemas")
            for schema in schemas:
                print(f"   - {schema['function']['name']}: {schema['function']['description']}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test hello tool
        print("\n5. Testing hello tool...")
        try:
            response = await client.post(
                f"{BASE_URL}/tools/hello",
                json={"name": "Brian"}
            )
            print(f"✅ Status: {response.status_code}")
            print(f"📄 Response: {json.dumps(response.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Test n8n tool (will fail without real n8n server, but tests the endpoint)
        print("\n6. Testing n8n tool (expected to fail without real n8n server)...")
        try:
            response = await client.post(
                f"{BASE_URL}/tools/run_n8n",
                json={"workflow": "test_workflow", "data": {"test": "data"}}
            )
            print(f"✅ Status: {response.status_code}")
            print(f"📄 Response: {json.dumps(response.json(), indent=2)}")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        print("\n" + "=" * 50)
        print("🎉 Testing complete!")
        print("\n💡 Next steps:")
        print("   - Visit http://localhost:8000/docs for interactive API documentation")
        print("   - Update N8N_BASE_URL in your environment for real n8n integration")
        print("   - Add more tools by extending the main.py file")

if __name__ == "__main__":
    print("Make sure the server is running with: uvicorn main:app --reload")
    print("Then run this test script...")
    input("Press Enter to continue...")
    asyncio.run(test_server())
