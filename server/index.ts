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

//@ts-ignore this is created at runtime. No types associated w/it
import { handler as astroHandler } from "../dist/server/entry.mjs";
import { createServer } from "node:http";
import { Socket } from "node:net";

const bareServer = createBareServer("/bare/", {
    connectionLimiter: {
        // Optimized connection limits for better compatibility
        maxConnectionsPerIP: parseInt(process.env.BARE_MAX_CONNECTIONS_PER_IP as string) || 1000,
        windowDuration: parseInt(process.env.BARE_WINDOW_DURATION as string) || 30, // Extended window for stability
        blockDuration: parseInt(process.env.BARE_BLOCK_DURATION as string) || 10, // Moderate block duration
        // Add custom validation function (if supported by bare-server-node)
        validateConnection: (req) => {
            // Whitelist keepalive requests
            if (req.headers["connection"]?.toLowerCase().includes("keep-alive")) {
                return true; // Allow keepalive
            }
            return false; // Apply rate limit to others
        }
    },
    // Add error logging for debugging
    logErrors: process.env.NODE_ENV !== "production"
});

const serverFactory: FastifyServerFactory = (
    handler: FastifyServerFactoryHandler
): RawServerDefault => {
    return createServer()
        .on("request", (req, res) => {
            try {
                if (bareServer.shouldRoute(req)) {
                    bareServer.routeRequest(req, res);
                } else {
                    handler(req, res);
                }
            } catch (error) {
                console.error("Request handling error:", error);
                if (!res.headersSent) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("Internal Server Error");
                }
            }
        })
        .on("upgrade", (req, socket, head) => {
            try {
                if (bareServer.shouldRoute(req)) {
                    bareServer.routeUpgrade(req, socket as Socket, head);
                } else if (req.url?.endsWith("/wisp/") || req.url?.endsWith("/adblock/")) {
                    wisp.routeRequest(req, socket as Socket, head);
                }
            } catch (error) {
                console.error("WebSocket upgrade error:", error);
                socket.destroy();
            }
        })
        .on("error", (error) => {
            console.error("Server error:", error);
        });
};

const app = Fastify({
    logger:
        process.env.NODE_ENV === "production"
            ? false
            : {
                  level: "error"
              },
    ignoreDuplicateSlashes: true,
    ignoreTrailingSlash: true,
    serverFactory: serverFactory,
    // Optimize for proxy performance
    requestTimeout: 0, // No timeout for long-running proxy connections
    keepAliveTimeout: 72000, // 72 seconds to maintain connections
    connectionTimeout: 0, // No connection timeout
    bodyLimit: 1048576 * 50 // 50MB body limit for large requests
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
