import type { Handler } from '@netlify/functions';
import Fastify from 'fastify';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { createBareServer } from '@tomphttp/bare-server-node';
import { handler as astroHandler } from '../../dist/server/entry.mjs';
import { createServer } from 'node:http';
import { Socket } from 'node:net';
import http from 'node:http';
import https from 'node:https';

// Configure HTTP agents with proper keep-alive limits
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 25,
    maxFreeSockets: 5,
    timeout: 30000,
    maxTotalSockets: 50
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 25,
    maxFreeSockets: 5,
    timeout: 30000,
    maxTotalSockets: 50
});

const bareServer = createBareServer('/bare/', {
    connectionLimiter: {
        maxConnectionsPerIP: 50,
        windowDuration: 60,
        blockDuration: 30,
    },
    httpAgent: httpAgent,
    httpsAgent: httpsAgent,
});

let app: any = null;

async function getApp() {
  if (app) return app;

  const serverFactory = (handler: any) => {
    const server = createServer()
      .on('request', (req, res) => {
        if (bareServer.shouldRoute(req)) {
          bareServer.routeRequest(req, res);
        } else {
          handler(req, res);
        }
      })
      .on('upgrade', (req, socket, head) => {
        if (bareServer.shouldRoute(req)) {
          bareServer.routeUpgrade(req, socket as Socket, head);
        } else if (req.url?.endsWith('/wisp/') || req.url?.endsWith('/adblock/')) {
          wisp.routeRequest(req, socket as Socket, head);
        }
      });
    
    // Configure server keep-alive settings
    server.keepAliveTimeout = 3000;
    server.headersTimeout = 4000;
    server.requestTimeout = 30000;
    // @ts-ignore - maxRequestsPerSocket exists but may not be in types
    server.maxRequestsPerSocket = 100;
    
    return server;
  };

  app = Fastify({
    logger: false,
    ignoreDuplicateSlashes: true,
    ignoreTrailingSlash: true,
    serverFactory: serverFactory,
  });

  await app.register(fastifyStatic, {
    root: fileURLToPath(new URL('../../dist/client', import.meta.url)),
  });

  await app.register(fastifyMiddie);
  await app.use(astroHandler);

  app.setNotFoundHandler((req: any, res: any) => {
    res.redirect('/404');
  });

  return app;
}

export const handler: Handler = async (event, context) => {
  const app = await getApp();
  
  // Handle the request through Fastify
  return new Promise((resolve, reject) => {
    const req = {
      method: event.httpMethod,
      url: event.path + (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : ''),
      headers: event.headers,
      body: event.body,
    };

    app.inject(req, (err: any, res: any) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: res.payload,
        });
      }
    });
  });
};
