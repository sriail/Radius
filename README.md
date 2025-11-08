<p align="center">
    <a href="https://radiusproxy.app">
        <img src="public/favicon.png" alt="Radius logo" width="150">
    </a>
</p>

# [Radius](https://radiusproxy.app)
![Stars](https://shields.io/github/stars/RadiusProxy/Radius?style=flat-square&logo=github)
![Forks](https://shields.io/github/forks/RadiusProxy/Radius?style=flat-square&logo=github)
![Last Commit](https://shields.io/github/last-commit/RadiusProxy/Radius?style=flat-square&logo=github)

Radius is a simple and clean web proxy designed for speed and ease-of-use, made in Astro.

Join the [Discord!](https://discord.gg/cCfytCX6Sv) (Or [TitaniumNetwork's](https://discord.gg/unblock))

## How to support Radius 
You can donate at https://hcb.hackclub.com/donations/start/radius

If you can't donate, tell your friends about Radius!

## Tech Stack
[Astro](https://astro.build) - Server-side rendering and static site generation<br>
[Fastify](https://fastify.dev) - HTTP server <br>
[Vite](https://vite.dev) - Build system <br>
[TailwindCSS](https://tailwindcss.com) - CSS framework <br>
[Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) - Web proxy <br>
[Scramjet](https://github.com/MercuryWorkshop/Scramjet) - Web proxy <br>
[@mercuryworkshop/wisp-js](https://github.com/MercuryWorkshop/wisp-js) - Wisp server and client in JavaScript <br>
[bare-mux](https://github.com/MercuryWorkshop/bare-mux) - Modular implementation of the Bare client interface <br>
[EpoxyTransport](https://github.com/MercuryWorkshop/EpoxyTransport) Bare-mux transport using epoxy-tls <br>
[CurlTransport](https://github.com/MercuryWorkshop/CurlTransport) Bare-mux transport using libcurl.js <br>

# Setup
```bash
git clone https://github.com/RadiusProxy/Radius
cd Radius
pnpm i
pnpm bstart
```
Radius will run on port 8080 by default, or 4321 for a dev environment (`pnpm dev`).

# Deployment

Radius can be easily deployed to various platforms with full backend functionality. 

**📖 For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)**

## Quick Deploy

Choose your preferred platform:

## Deploy to Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RadiusProxy/Radius)

**Note:** Vercel has limitations with WebSocket connections. The proxy functionality may be limited.

1. Click the "Deploy with Vercel" button above
2. Follow the Vercel deployment wizard
3. The `vercel.json` configuration will automatically set up the build

## Deploy to Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/RadiusProxy/Radius)

**Note:** Netlify Functions have limitations with WebSocket connections. Full proxy functionality may be limited.

1. Click the "Deploy to Netlify" button above
2. Follow the Netlify deployment wizard
3. The `netlify.toml` configuration will automatically set up the build

## Deploy to Heroku
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/RadiusProxy/Radius)

Heroku fully supports WebSocket connections and is recommended for production deployments.

1. Click the "Deploy to Heroku" button above
2. Fill in the required information
3. Click "Deploy app"

**Manual deployment:**
```bash
heroku create your-app-name
git push heroku main
```

## Deploy to Replit
[![Run on Replit](https://replit.com/badge/github/RadiusProxy/Radius)](https://replit.com/new/github/RadiusProxy/Radius)

1. Click the "Run on Replit" button above
2. The `.replit` and `replit.nix` configurations will automatically set up the environment
3. Click "Run" to start the server
4. Your app will be available at the Replit URL

## Deploy to CodeSandbox
[![Edit in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/RadiusProxy/Radius)

1. Click the "Edit in CodeSandbox" button above
2. The `.codesandbox/tasks.json` configuration will automatically set up the tasks
3. Run the "Start Production Server" task to launch the app

## Deploy to Render
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Render fully supports WebSocket connections and is recommended for production deployments.

1. Click the "Deploy to Render" button above or go to [Render Dashboard](https://dashboard.render.com)
2. Connect your GitHub repository
3. The `render.yaml` configuration will automatically set up the service

## Deploy to Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/RadiusProxy/Radius)

Railway fully supports WebSocket connections and is an excellent choice for deployments.

1. Click the "Deploy on Railway" button above
2. Connect your GitHub account
3. The `railway.json` configuration will automatically set up the build

## Deploy with Docker

Radius includes a Dockerfile for containerized deployments:

```bash
# Build the Docker image
docker build -t radius .

# Run the container
docker run -p 8080:8080 radius
```

Or using Docker Compose:

```yaml
version: '3.8'
services:
  radius:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    restart: unless-stopped
```

## Environment Variables
All platforms support the following environment variable:
- `PORT` - The port number to run the server on (default: 8080)

## Platform Compatibility Notes
- **Heroku, Replit, CodeSandbox, Render, Railway**: Full support for WebSocket connections and all proxy features
- **Vercel, Netlify**: Limited WebSocket support; some proxy features may not work as expected. These platforms work best for static content and serverless functions but may have limitations with the proxy backend.

# Credits
[Owski](https://github.com/unretain) - Owner <br>
[proudparrot2](https://github.com/proudparrot2) - Founder and original dev <br>
[MotorTruck1221](https://github.com/motortruck1221) - Astro rewrite and lead dev <br>
[All of the contributors!](https://github.com/RadiusProxy/Radius/graphs/contributors)
