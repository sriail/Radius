# Radius Deployment Guide

This guide provides detailed instructions for deploying Radius to various hosting platforms.

## Table of Contents
- [Platform Compatibility](#platform-compatibility)
- [Quick Deploy Options](#quick-deploy-options)
- [Detailed Deployment Instructions](#detailed-deployment-instructions)
  - [Heroku](#heroku)
  - [Render](#render)
  - [Railway](#railway)
  - [Replit](#replit)
  - [CodeSandbox](#codesandbox)
  - [Vercel](#vercel)
  - [Netlify](#netlify)
  - [Docker](#docker)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Platform Compatibility

Radius requires WebSocket support for full proxy functionality. Here's how different platforms support it:

### ✅ Full Support (Recommended)
These platforms fully support WebSocket connections and all proxy features:
- **Heroku** - Classic PaaS with excellent WebSocket support
- **Render** - Modern cloud platform with native WebSocket support
- **Railway** - Developer-friendly platform with full WebSocket support
- **Replit** - Interactive development environment with WebSocket support
- **CodeSandbox** - Cloud development environment
- **Docker** - Self-hosted solution with complete control

### ⚠️ Limited Support
These platforms have limitations with WebSocket connections:
- **Vercel** - Serverless functions have WebSocket limitations
- **Netlify** - Functions don't support long-lived WebSocket connections

## Quick Deploy Options

### One-Click Deployments

#### Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/RadiusProxy/Radius)

#### Render
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

#### Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/RadiusProxy/Radius)

#### Replit
[![Run on Replit](https://replit.com/badge/github/RadiusProxy/Radius)](https://replit.com/new/github/RadiusProxy/Radius)

## Detailed Deployment Instructions

### Heroku

**Prerequisites:**
- Heroku account
- Heroku CLI (for manual deployment)

**One-Click Deployment:**
1. Click the "Deploy to Heroku" button above
2. Choose an app name
3. Click "Deploy app"
4. Wait for the build to complete
5. Click "View" to open your deployed app

**Manual Deployment:**
```bash
# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-app-name

# Push to Heroku
git push heroku main

# Open your app
heroku open
```

**Configuration:**
- Uses `Procfile` for process definition
- Uses `app.json` for app configuration
- Automatically installs dependencies and builds the app

### Render

**Prerequisites:**
- Render account
- GitHub repository

**Deployment Steps:**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` configuration
5. Click "Create Web Service"
6. Wait for the deployment to complete

**Configuration:**
- Uses `render.yaml` for service definition
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

### Railway

**Prerequisites:**
- Railway account
- GitHub repository

**Deployment Steps:**
1. Click the "Deploy on Railway" button above, or
2. Go to [Railway Dashboard](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will automatically detect the `railway.json` configuration
6. The app will deploy automatically

**Configuration:**
- Uses `railway.json` for build configuration
- Automatically detects Node.js environment
- WebSocket support is built-in

### Replit

**Prerequisites:**
- Replit account

**Deployment Steps:**
1. Click the "Run on Replit" button above, or
2. Go to [Replit](https://replit.com)
3. Click "Create Repl" → "Import from GitHub"
4. Enter the repository URL
5. Replit will use `.replit` and `replit.nix` configurations
6. Click "Run" to start the server

**Configuration:**
- Uses `.replit` for run configuration
- Uses `replit.nix` for Nix package dependencies
- Server runs on port 8080

### CodeSandbox

**Prerequisites:**
- CodeSandbox account

**Deployment Steps:**
1. Click the "Edit in CodeSandbox" button above, or
2. Go to [CodeSandbox](https://codesandbox.io)
3. Click "Import" → "Import from GitHub"
4. Enter the repository URL
5. CodeSandbox will use `.codesandbox/tasks.json` configuration
6. Run the "Start Production Server" task

**Configuration:**
- Uses `.codesandbox/tasks.json` for task definitions
- Supports both development and production modes
- Ports 4321 (dev) and 8080 (prod) are configured

### Vercel

**Prerequisites:**
- Vercel account
- GitHub repository

**Deployment Steps:**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel will automatically detect the `vercel.json` configuration
5. Click "Deploy"

**Important Notes:**
- ⚠️ Vercel has limited WebSocket support in serverless functions
- Some proxy features may not work as expected
- Best suited for the static frontend, backend may have limitations

**Configuration:**
- Uses `vercel.json` for deployment settings
- Serverless function timeout limitations apply

### Netlify

**Prerequisites:**
- Netlify account
- GitHub repository

**Deployment Steps:**
1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select your repository
4. Netlify will automatically detect `netlify.toml`
5. Click "Deploy site"

**Important Notes:**
- ⚠️ Netlify Functions don't support long-lived WebSocket connections
- Some proxy features may not work as expected
- Best suited for static content

**Configuration:**
- Uses `netlify.toml` for build settings
- Uses `netlify/functions/server.ts` for serverless function

### Docker

**Prerequisites:**
- Docker installed locally or on a server
- Docker Compose (optional)

**Using Docker:**
```bash
# Build the image
docker build -t radius .

# Run the container
docker run -p 8080:8080 radius

# Access your app at http://localhost:8080
```

**Using Docker Compose:**
```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

**Configuration:**
- Uses `Dockerfile` for container definition
- Uses `docker-compose.yml` for orchestration
- Uses `.dockerignore` to exclude unnecessary files

## Environment Variables

All platforms support the following environment variables:

- `PORT` - The port number to run the server on (default: 8080)
- `NODE_ENV` - Node environment (default: production)

**Setting Environment Variables:**

**Heroku:**
```bash
heroku config:set PORT=8080
```

**Render / Railway / Replit:**
Set in the platform's dashboard or settings

**Docker:**
```bash
docker run -e PORT=8080 -e NODE_ENV=production -p 8080:8080 radius
```

## Troubleshooting

### Build Failures

**Issue:** Build fails with "Cannot find module" errors
**Solution:** Ensure all dependencies are installed:
```bash
npm install
```

**Issue:** TypeScript compilation errors
**Solution:** Check Node.js version (requires >=18.0.0):
```bash
node --version
```

### Runtime Issues

**Issue:** Server starts but proxy doesn't work
**Solution:** Check if the platform supports WebSocket connections. Heroku, Render, Railway, Replit, and Docker fully support WebSockets.

**Issue:** Port binding errors
**Solution:** Ensure the `PORT` environment variable is set correctly and the application is listening on `0.0.0.0`:
```javascript
app.listen({ port: port, host: "0.0.0.0" })
```

### Platform-Specific Issues

**Vercel/Netlify:**
- WebSocket limitations are inherent to the serverless architecture
- Consider using Heroku, Render, or Railway for full functionality

**Heroku:**
- Free tier dynos sleep after 30 minutes of inactivity
- Use paid dynos for production deployments

**Docker:**
- Ensure Docker daemon is running
- Check container logs: `docker logs <container-id>`

## Additional Resources

- [Radius GitHub Repository](https://github.com/RadiusProxy/Radius)
- [Discord Community](https://discord.gg/cCfytCX6Sv)
- [Report Issues](https://github.com/RadiusProxy/Radius/issues)

## Support

If you encounter any issues during deployment:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Review platform-specific documentation
3. Join our [Discord](https://discord.gg/cCfytCX6Sv) for community support
4. Open an issue on [GitHub](https://github.com/RadiusProxy/Radius/issues)
