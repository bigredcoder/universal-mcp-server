#!/bin/bash

# Deploy YouTube Search AI Agent to AWS Lambda

echo "🤖 Deploying Smart YouTube Search AI Agent..."

# Create deployment package
echo "📦 Creating deployment package..."
zip -r youtube-search-agent.zip youtube-search-agent.js

# Deploy to AWS Lambda (you'll need to create the function first)
echo "🚀 Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name youtube-search-agent \
  --zip-file fileb://youtube-search-agent.zip \
  --profile editorr

# Update environment variables
echo "🔧 Setting environment variables..."
aws lambda update-function-configuration \
  --function-name youtube-search-agent \
  --environment Variables="{OPENAI_API_KEY=$OPENAI_API_KEY,YOUTUBE_API_KEY=$YOUTUBE_API_KEY}" \
  --profile editorr

# Create API Gateway endpoint (if not exists)
echo "🌐 Setting up API Gateway..."
# This would need to be done manually or with additional AWS CLI commands

echo "✅ YouTube Search AI Agent deployed!"
echo "📋 Next steps:"
echo "   1. Set up API Gateway endpoint: /api/youtube-search"
echo "   2. Add CORS configuration"
echo "   3. Set environment variables in Lambda console:"
echo "      - OPENAI_API_KEY: Your OpenAI API key"
echo "      - YOUTUBE_API_KEY: Your YouTube Data API key"
echo "   4. Test the endpoint"

# Clean up
rm youtube-search-agent.zip
