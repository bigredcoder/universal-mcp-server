# LyricLeak AWS Deployment Guide

This guide will help you deploy LyricLeak to AWS using your existing `editorr` profile.

## Prerequisites

✅ AWS CLI configured with `editorr` profile  
✅ Domain `lyricleak.com` purchased on Namecheap  
✅ OpenAI API key (for the smart agent)  

## Quick Deployment

1. **Set your OpenAI API key** (required for the smart agent):
   ```bash
   export OPENAI_API_KEY="your-openai-api-key-here"
   ```

2. **Run the deployment script**:
   ```bash
   ./deploy.sh
   ```

3. **Configure Namecheap DNS**:
   - Go to Namecheap → Domain List → Manage → Nameservers
   - Select "Custom DNS" 
   - Add the nameservers provided by the script

4. **Wait for DNS propagation** (5-10 minutes)

5. **Your site will be live** at https://lyricleak.com

## What Gets Deployed

### Backend (API)
- **AWS Lambda**: Runs the Node.js server with smart agent
- **API Gateway**: Provides REST API endpoints
- **CloudFormation**: Infrastructure as code

### Frontend
- **S3 Bucket**: Hosts static files (HTML, CSS, JS)
- **CloudFront**: CDN for fast global delivery
- **Route 53**: DNS management
- **SSL Certificate**: Automatic HTTPS via ACM

## Architecture

```
Internet → Route 53 → CloudFront → S3 (Frontend)
                                 ↓
                              API Gateway → Lambda (Backend)
```

## Manual Steps (if needed)

### Deploy API Only
```bash
aws cloudformation deploy \
  --template-file api-template.yaml \
  --stack-name lyricleak-api \
  --parameter-overrides OpenAIApiKey="your-key" \
  --capabilities CAPABILITY_IAM \
  --region us-east-1 \
  --profile editorr
```

### Deploy Frontend Only
```bash
aws cloudformation deploy \
  --template-file frontend-template.yaml \
  --stack-name lyricleak-frontend \
  --parameter-overrides DomainName=lyricleak.com \
  --region us-east-1 \
  --profile editorr
```

### Update Frontend Files
```bash
aws s3 sync . s3://lyricleak-frontend \
  --exclude "node_modules/*" \
  --exclude "server.js" \
  --profile editorr
```

## Environment Variables

The Lambda function uses these environment variables:
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `NODE_ENV`: Set to "production" automatically

## Troubleshooting

### DNS Issues
- Check nameservers are correctly set in Namecheap
- DNS propagation can take up to 24 hours
- Use `dig lyricleak.com` to check DNS resolution

### SSL Certificate Issues
- Certificate validation requires DNS to be working
- Check Route 53 hosted zone has correct records
- Certificate is in us-east-1 region (required for CloudFront)

### API Issues
- Check Lambda logs in CloudWatch
- Verify OpenAI API key is set correctly
- Test API directly: `curl https://api-url/api/meaning?song=test&artist=test`

## Costs

Estimated monthly costs for moderate usage:
- Route 53: ~$0.50
- CloudFront: ~$1-5
- Lambda: ~$0-1 (first 1M requests free)
- S3: ~$0.10
- **Total: ~$2-7/month**

## Updates

To update the site:
1. Make changes to your code
2. Run `./deploy.sh` again
3. Changes will be deployed automatically

## Cleanup

To remove all resources:
```bash
aws cloudformation delete-stack --stack-name lyricleak-frontend --profile editorr
aws cloudformation delete-stack --stack-name lyricleak-api --profile editorr
aws s3 rm s3://lyricleak-frontend --recursive --profile editorr
aws s3 rb s3://lyricleak-frontend --profile editorr
```
