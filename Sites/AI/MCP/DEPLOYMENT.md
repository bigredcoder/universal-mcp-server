# Deployment Guide - Render.com

This guide will help you deploy your Universal MCP Server to Render.com.

## Prerequisites

- GitHub repository with your code
- Render.com account (free tier available)
- Your n8n server URL (if using the n8n tool)

## Step-by-Step Deployment

### 1. Prepare Your Repository

Make sure your GitHub repository contains:
- `main.py` - Your FastAPI application
- `requirements.txt` - Python dependencies
- `render.yaml` - Render configuration (optional but recommended)

### 2. Create a New Web Service on Render

1. **Log in to Render.com**
   - Go to https://render.com and sign in
   - Click "New +" and select "Web Service"

2. **Connect Your Repository**
   - Choose "Build and deploy from a Git repository"
   - Connect your GitHub account if not already connected
   - Select your repository containing the MCP server code

3. **Configure the Service**
   - **Name**: `universal-mcp-server` (or your preferred name)
   - **Environment**: `Python 3`
   - **Region**: Choose the closest to your users
   - **Branch**: `main` (or your default branch)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 3. Set Environment Variables

In the Render dashboard, add these environment variables:

**Required:**
- `PYTHON_VERSION`: `3.11.0`

**Optional (customize as needed):**
- `N8N_BASE_URL`: Your n8n server URL (e.g., `https://your-n8n-server.com`)
- `DEBUG`: `false` (for production)

### 4. Deploy

1. Click "Create Web Service"
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Start your FastAPI server
   - Provide you with a public URL

### 5. Verify Deployment

Once deployed, test your endpoints:

1. **Check the service URL**: `https://your-service-name.onrender.com`
2. **Test the API documentation**: `https://your-service-name.onrender.com/docs`
3. **Test the health endpoint**: `https://your-service-name.onrender.com/health`

## Configuration Options

### Custom Domain (Optional)

1. In your Render service dashboard, go to "Settings"
2. Scroll to "Custom Domains"
3. Add your domain and follow the DNS configuration instructions

### Environment Variables for Production

Add these in the Render dashboard under "Environment":

```
N8N_BASE_URL=https://your-actual-n8n-server.com
DEBUG=false
PYTHON_VERSION=3.11.0
```

### Scaling (Paid Plans)

For production use, consider:
- **Instance Type**: Upgrade from free tier for better performance
- **Auto-scaling**: Enable if you expect variable traffic
- **Health Checks**: Render automatically monitors `/health` endpoint

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that `requirements.txt` is in the root directory
   - Verify Python version compatibility
   - Check build logs in Render dashboard

2. **Service Won't Start**
   - Ensure start command is correct: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Check that `main.py` is in the root directory
   - Review service logs in Render dashboard

3. **CORS Issues**
   - The server includes CORS middleware for all origins
   - For production, consider restricting origins in `main.py`

### Monitoring

- **Logs**: Available in Render dashboard under "Logs"
- **Metrics**: Monitor CPU, memory, and response times
- **Health Checks**: Render automatically monitors `/health` endpoint

## Security Considerations

For production deployment:

1. **Environment Variables**: Store sensitive data (API keys, tokens) as environment variables
2. **CORS**: Restrict allowed origins in production
3. **Rate Limiting**: Consider adding rate limiting middleware
4. **Authentication**: Add authentication for sensitive tools
5. **HTTPS**: Render provides HTTPS by default

## Cost Considerations

- **Free Tier**: 750 hours/month, sleeps after 15 minutes of inactivity
- **Paid Plans**: Start at $7/month for always-on services
- **Bandwidth**: 100GB/month on free tier

## Next Steps

After successful deployment:

1. **Test all endpoints** with real data
2. **Update n8n webhooks** to use your new Render URL
3. **Configure LLM integrations** to use your tool endpoints
4. **Set up monitoring** and alerts
5. **Consider adding authentication** for production use

## Support

- **Render Documentation**: https://render.com/docs
- **Render Community**: https://community.render.com
- **FastAPI Documentation**: https://fastapi.tiangolo.com
