import Fastify, {
    FastifyReply,
    FastifyRequest,
    FastifyServerFactory,
    FastifyServerFactoryHandler,
    RawServerDefault
} from "fastify";
import fastifyMiddie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { createBareServer } from "@tomphttp/bare-server-node";
import http from "node:http";
import https from "node:https";

//@ts-ignore this is created at runtime. No types associated w/it
import { handler as astroHandler } from "../dist/server/entry.mjs";
import { createServer } from "node:http";
import { Socket } from "node:net";

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

const bareServer = createBareServer("/bare/", {
    connectionLimiter: {
        maxConnectionsPerIP: 50,
        windowDuration: 60,
        blockDuration: 30,
    },
    httpAgent: httpAgent,
    httpsAgent: httpsAgent,
});

const serverFactory: FastifyServerFactory = (
    handler: FastifyServerFactoryHandler
): RawServerDefault => {
    const server = createServer()
        .on("request", (req, res) => {
            if (bareServer.shouldRoute(req)) {
                bareServer.routeRequest(req, res);
            } else {
                handler(req, res);
            }
        })
        .on("upgrade", (req, socket, head) => {
            if (bareServer.shouldRoute(req)) {
                bareServer.routeUpgrade(req, socket as Socket, head);
            } else if (req.url?.endsWith("/wisp/") || req.url?.endsWith("/adblock/")) {
                console.log(req.url);
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

const app = Fastify({
    logger: false,
    ignoreDuplicateSlashes: true,
    ignoreTrailingSlash: true,
    serverFactory: serverFactory
});

await app.register(fastifyStatic, {
    root: fileURLToPath(new URL("../dist/client", import.meta.url))
});

await app.register(fastifyMiddie);

await app.use(astroHandler);

app.setNotFoundHandler((req, res) => {
    res.redirect("/404"); // This is hacky as hell
});

const port = parseInt(process.env.PORT as string) || parseInt("8080");

app.listen({ port: port, host: "0.0.0.0" }).then(async () => {
    console.log(`Server listening on http://localhost:${port}/`);
    console.log(`Server also listening on http://0.0.0.0:${port}/`);
});
