#!/bin/bash

# Deploy LyricLeak API to Lambda
set -e

PROFILE="editorr"
REGION="us-east-1"
API_STACK_NAME="lyricleak-api"

echo "🚀 Deploying LyricLeak API to Lambda..."

# Check API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Please set OPENAI_API_KEY environment variable"
    exit 1
fi

echo "✅ OpenAI API key is set"

# Package Lambda function
echo "📦 Packaging Lambda function..."
zip -r lambda-function.zip server.js node_modules/ package.json

# Create Lambda bucket if it doesn't exist
LAMBDA_BUCKET="lyricleak-lambda-$(date +%s)"
aws s3 mb "s3://$LAMBDA_BUCKET" --region $REGION --profile $PROFILE
echo "✅ Created Lambda bucket: $LAMBDA_BUCKET"

# Upload Lambda package
aws s3 cp lambda-function.zip "s3://$LAMBDA_BUCKET/" --profile $PROFILE
echo "✅ Lambda function uploaded"

# Deploy API Stack
echo "🚀 Deploying API stack..."
aws cloudformation deploy \
    --template-file simple-api-template.yaml \
    --stack-name $API_STACK_NAME \
    --parameter-overrides \
        LambdaBucket=$LAMBDA_BUCKET \
        OpenAIApiKey="$OPENAI_API_KEY" \
    --capabilities CAPABILITY_IAM \
    --region $REGION \
    --profile $PROFILE

if [ $? -eq 0 ]; then
    echo "✅ API stack deployed successfully"
else
    echo "❌ API stack deployment failed"
    exit 1
fi

# Get API URL from stack outputs
API_URL=$(aws cloudformation describe-stacks \
    --stack-name $API_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text \
    --region $REGION \
    --profile $PROFILE)

echo "✅ API URL: $API_URL"

# Test the API
echo "🧪 Testing API..."
curl -s "$API_URL/api/meaning?song=test&artist=test" | head -100

# Clean up
rm -f lambda-function.zip

echo ""
echo "🎉 API deployment complete!"
echo ""
echo "📋 Summary:"
echo "  • API URL: $API_URL"
echo "  • Lambda bucket: $LAMBDA_BUCKET"
echo ""
echo "🔧 Next steps:"
echo "1. Update your frontend to use the production API URL"
echo "2. Set up CloudFront and Route 53 for your domain"
echo "3. Configure SSL certificate"
