#!/bin/bash

# LyricLeak AWS Deployment Script
# This script deploys the LyricLeak app to AWS using the editorr profile

set -e

PROFILE="editorr"
DOMAIN="lyricleak.com"
REGION="us-east-1"  # Required for CloudFront SSL certificates
BUCKET_NAME="lyricleak-frontend"
API_STACK_NAME="lyricleak-api"
FRONTEND_STACK_NAME="lyricleak-frontend"

echo "🚀 Starting LyricLeak deployment to AWS..."
echo "Domain: $DOMAIN"
echo "Profile: $PROFILE"
echo "Region: $REGION"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --profile $PROFILE > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured for profile $PROFILE"
    exit 1
fi

echo "✅ AWS CLI configured"

# Create S3 bucket for frontend if it doesn't exist
echo "📦 Setting up S3 bucket for frontend..."
if ! aws s3 ls "s3://$BUCKET_NAME" --profile $PROFILE > /dev/null 2>&1; then
    aws s3 mb "s3://$BUCKET_NAME" --region $REGION --profile $PROFILE
    echo "✅ Created S3 bucket: $BUCKET_NAME"
else
    echo "✅ S3 bucket already exists: $BUCKET_NAME"
fi

# Enable static website hosting
aws s3 website "s3://$BUCKET_NAME" \
    --index-document index.html \
    --error-document index.html \
    --profile $PROFILE

echo "✅ Enabled static website hosting"

# Upload frontend files
echo "📤 Uploading frontend files..."
aws s3 sync . "s3://$BUCKET_NAME" \
    --exclude "node_modules/*" \
    --exclude "server.js" \
    --exclude "package*.json" \
    --exclude ".git/*" \
    --exclude "deploy.sh" \
    --exclude "*.md" \
    --cache-control "max-age=86400" \
    --profile $PROFILE

echo "✅ Frontend files uploaded"

# Deploy API using CloudFormation
echo "🔧 Deploying API infrastructure..."

# Package Lambda function
echo "📦 Packaging Lambda function..."
zip -r lambda-function.zip server.js node_modules/ package.json

# Upload Lambda package to S3
LAMBDA_BUCKET="lyricleak-lambda-$RANDOM"
aws s3 mb "s3://$LAMBDA_BUCKET" --region $REGION --profile $PROFILE
aws s3 cp lambda-function.zip "s3://$LAMBDA_BUCKET/" --profile $PROFILE

echo "✅ Lambda function packaged and uploaded"

# Deploy API Stack
echo "🚀 Deploying API stack..."
aws cloudformation deploy \
    --template-file api-template.yaml \
    --stack-name $API_STACK_NAME \
    --parameter-overrides \
        LambdaBucket=$LAMBDA_BUCKET \
        OpenAIApiKey="${OPENAI_API_KEY:-}" \
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

# Update frontend to use production API URL
echo "🔧 Updating frontend to use production API..."
sed -i.bak "s|http://localhost:3000|$API_URL|g" index.html
echo "✅ Frontend updated with production API URL"

# Re-upload updated frontend
echo "📤 Re-uploading updated frontend..."
aws s3 cp index.html "s3://$BUCKET_NAME/" --profile $PROFILE

# Deploy Frontend Stack
echo "🚀 Deploying frontend stack..."
aws cloudformation deploy \
    --template-file frontend-template.yaml \
    --stack-name $FRONTEND_STACK_NAME \
    --parameter-overrides \
        DomainName=$DOMAIN \
        BucketName=$BUCKET_NAME \
        ApiUrl=$API_URL \
    --region $REGION \
    --profile $PROFILE

if [ $? -eq 0 ]; then
    echo "✅ Frontend stack deployed successfully"
else
    echo "❌ Frontend stack deployment failed"
    exit 1
fi

# Get name servers for domain configuration
NAME_SERVERS=$(aws cloudformation describe-stacks \
    --stack-name $FRONTEND_STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`NameServers`].OutputValue' \
    --output text \
    --region $REGION \
    --profile $PROFILE)

# Clean up
rm -f lambda-function.zip
rm -f index.html.bak

echo ""
echo "🎉 LyricLeak deployment complete!"
echo ""
echo "📋 Summary:"
echo "  • Domain: https://$DOMAIN"
echo "  • API URL: $API_URL"
echo "  • Frontend bucket: $BUCKET_NAME"
echo ""
echo "🔧 Next steps:"
echo "1. Configure Namecheap DNS:"
echo "   Go to Namecheap → Domain List → Manage → Nameservers"
echo "   Select 'Custom DNS' and add these nameservers:"
echo "   $NAME_SERVERS"
echo ""
echo "2. Wait for DNS propagation (5-10 minutes)"
echo "3. SSL certificate will be automatically validated"
echo "4. Your site will be live at https://$DOMAIN"
echo ""
echo "🔑 Don't forget to set your OPENAI_API_KEY environment variable!"
