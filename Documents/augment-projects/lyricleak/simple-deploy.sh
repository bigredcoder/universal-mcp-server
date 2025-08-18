#!/bin/bash

# Simple LyricLeak Deployment - API First
set -e

PROFILE="editorr"
REGION="us-east-1"
BUCKET_NAME="lyricleak-frontend"

echo "🚀 Simple LyricLeak deployment..."

# Check API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ Please set OPENAI_API_KEY environment variable"
    exit 1
fi

echo "✅ OpenAI API key is set"

# Create and upload frontend to S3
echo "📦 Setting up S3 bucket for frontend..."
if ! aws s3 ls "s3://$BUCKET_NAME" --profile $PROFILE > /dev/null 2>&1; then
    aws s3 mb "s3://$BUCKET_NAME" --region $REGION --profile $PROFILE
    echo "✅ Created S3 bucket: $BUCKET_NAME"
else
    echo "✅ S3 bucket already exists: $BUCKET_NAME"
fi

# Configure bucket for static website hosting
aws s3 website "s3://$BUCKET_NAME" \
    --index-document index.html \
    --error-document index.html \
    --profile $PROFILE

# Remove public access block
echo "🔓 Configuring bucket for public access..."
aws s3api put-public-access-block \
    --bucket $BUCKET_NAME \
    --public-access-block-configuration \
        BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false \
    --profile $PROFILE

# Set bucket policy for public read
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy \
    --bucket $BUCKET_NAME \
    --policy file://bucket-policy.json \
    --profile $PROFILE

rm bucket-policy.json

# Upload frontend files
echo "📤 Uploading frontend files..."
aws s3 sync . "s3://$BUCKET_NAME" \
    --exclude "node_modules/*" \
    --exclude "server.js" \
    --exclude "package*.json" \
    --exclude ".git/*" \
    --exclude "*.sh" \
    --exclude "*.md" \
    --exclude "*.yaml" \
    --exclude "*.json" \
    --cache-control "max-age=86400" \
    --profile $PROFILE

echo "✅ Frontend uploaded to S3"

# Get the S3 website URL
WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo "🌐 Website URL: $WEBSITE_URL"

echo ""
echo "🎉 Basic deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Your frontend is live at: $WEBSITE_URL"
echo "2. The API is still running locally - keep your server running"
echo "3. To deploy the API to Lambda, we'll need to fix the CloudFormation template"
echo "4. For now, you can test the site locally with the API running on localhost:3000"
echo ""
echo "🔧 To set up the domain and SSL:"
echo "1. We'll need to create a CloudFront distribution"
echo "2. Set up Route 53 hosted zone"
echo "3. Configure SSL certificate"
echo ""
echo "Would you like me to continue with the full AWS setup?"
