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
        // Allow more connections but with shorter window
        maxConnectionsPerIP: parseInt(process.env.BARE_MAX_CONNECTIONS_PER_IP as string) || 500,
        windowDuration: parseInt(process.env.BARE_WINDOW_DURATION as string) || 10, // Shorter window
        blockDuration: parseInt(process.env.BARE_BLOCK_DURATION as string) || 5  // Shorter block
    }
});

const serverFactory: FastifyServerFactory = (
    handler: FastifyServerFactoryHandler
): RawServerDefault => {
    return createServer()
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
