# Radius Deployment Guide

This guide provides detailed instructions for deploying Radius to various hosting platforms.

## Table of Contents
- [Platform Compatibility](#platform-compatibility)
- [Quick Deploy Options](#quick-deploy-options)
- [Detailed Deployment Instructions](#detailed-deployment-instructions)
  - [Heroku](#heroku)
  - [Replit](#replit)
  - [CodeSandbox](#codesandbox)
  - [Yandex Cloud](#yandex-cloud)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)



## Quick Deploy Options

### One-Click Deployments

#### Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/RadiusProxy/Radius)

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

### Yandex Cloud

**Prerequisites:**
- Yandex Cloud account
- Yandex Cloud CLI (optional for advanced deployment)

**Deployment via Compute Cloud (Virtual Machine):**

1. **Create a Virtual Machine:**
   - Go to [Yandex Cloud Console](https://console.cloud.yandex.com/)
   - Navigate to Compute Cloud → Virtual Machines
   - Click "Create VM"
   - Choose Ubuntu 22.04 LTS or later
   - Select appropriate VM configuration (minimum 2 vCPU, 2 GB RAM recommended)
   - Configure network settings and assign a public IP

2. **Connect to your VM:**
   ```bash
   ssh <your-username>@<vm-public-ip>
   ```

3. **Install Node.js and npm:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Clone and deploy Radius:**
   ```bash
   git clone https://github.com/RadiusProxy/Radius
   cd Radius
   npm install
   npm run bstart
   ```

5. **Set up as a system service (optional):**
   ```bash
   sudo nano /etc/systemd/system/radius.service
   ```
   
   Add the following content:
   ```ini
   [Unit]
   Description=Radius Proxy Server
   After=network.target

   [Service]
   Type=simple
   User=<your-username>
   WorkingDirectory=/home/<your-username>/Radius
   ExecStart=/usr/bin/npm start
   Restart=on-failure
   Environment="PORT=8080"
   Environment="NODE_ENV=production"

   [Install]
   WantedBy=multi-user.target
   ```

   Enable and start the service:
   ```bash
   sudo systemctl enable radius
   sudo systemctl start radius
   sudo systemctl status radius
   ```

**Deployment via Docker on Yandex Cloud:**

1. Install Docker on your Yandex Cloud VM:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -aG docker $USER
   ```

2. Clone and build:
   ```bash
   git clone https://github.com/RadiusProxy/Radius
   cd Radius
   docker-compose up -d
   ```

**Using Yandex Object Storage for Static Assets (Optional):**

Radius can leverage Yandex Object Storage (S3-compatible) for serving static assets at scale:

1. Create an Object Storage bucket in Yandex Cloud Console
2. Configure bucket for public read access if needed
3. Set up environment variables for S3-compatible storage access

**Configuration for Yandex Cloud:**
- Ensure firewall rules allow traffic on port 8080 (or your configured port)
- Configure security groups to allow HTTP/HTTPS traffic
- Consider using Yandex Application Load Balancer for SSL termination
- Set up Yandex Cloud Monitoring for application health checks

## Environment Variables

All platforms support the following environment variables:

- `PORT` - The port number to run the server on (default: 8080)
- `NODE_ENV` - Node environment (default: production)

**Setting Environment Variables:**

**Heroku:**
```bash
heroku config:set PORT=8080
```

Replit:**
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

**Heroku:**
- Free tier dynos sleep after 30 minutes of inactivity
- Use paid dynos for production deployments

**Docker:**
- Ensure Docker daemon is running
- Check container logs: `docker logs <container-id>`

**Yandex Cloud:**
- Check VM firewall rules allow traffic on configured port
- Verify security group settings
- Check Node.js version compatibility: `node --version`
- Review application logs: `sudo journalctl -u radius -f`

### CAPTCHA Issues

**Issue:** reCAPTCHA, hCaptcha, or Yandex SmartCaptcha not loading
**Solution:** 
- Radius now includes enhanced support for reCAPTCHA v2/v3, hCaptcha, Cloudflare Turnstile, and Yandex SmartCaptcha
- Ensure the proxy is properly configured and service workers are active
- Check browser console for any CORS or loading errors
- Verify that third-party cookies are not blocked in browser settings
- For Yandex SmartCaptcha, ensure proper API keys are configured in the parent application

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
