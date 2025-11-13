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

const bareServer = createBareServer("/bare/");

// Simple semaphore for throttling /~/scramjet/ requests
class Semaphore {
    private max: number;
    private current = 0;
    private queue: Array<() => void> = [];

    constructor(max: number) {
        this.max = Math.max(1, max);
    }

    async acquire(): Promise<void> {
        if (this.current < this.max) {
            this.current++;
            return;
        }
        await new Promise<void>((resolve) => this.queue.push(resolve));
        // we were resumed, current already incremented by release
    }

    release(): void {
        if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            // give the slot to the waiter (do not change current)
            // we keep current unchanged here but to maintain correct accounting
            // we increment current to reflect the new active slot
            this.current++;
            next();
            return;
        }
        if (this.current > 0) this.current--;
    }
}

// tune concurrency with env var, default to 6
const SCRAMJET_CONCURRENCY = parseInt(process.env.SCRAMJET_CONCURRENCY || "6", 10);
const scramjetSemaphore = new Semaphore(SCRAMJET_CONCURRENCY);

const serverFactory: FastifyServerFactory = (
    handler: FastifyServerFactoryHandler
): RawServerDefault => {
    const server = createServer()
        .on("request", (req, res) => {
            const url = req.url || "";
            const isScramjet = url.startsWith("/~/scramjet/");

            if (!isScramjet) {
                // normal flow
                if (bareServer.shouldRoute(req)) {
                    bareServer.routeRequest(req, res);
                } else {
                    handler(req, res);
                }
                return;
            }

            // Scramjet request: throttle using semaphore
            // Acquire a slot and then process the request. Release on 'finish' or 'close'.
            scramjetSemaphore.acquire().then(() => {
                // ensure connection is closed after this request unless you want to reuse
                // res.setHeader('Connection', 'close'); // optional: force close

                const onDone = () => {
                    res.removeListener("finish", onDone);
                    res.removeListener("close", onDone);
                    scramjetSemaphore.release();
                };

                res.once("finish", onDone);
                res.once("close", onDone);

                try {
                    if (bareServer.shouldRoute(req)) {
                        bareServer.routeRequest(req, res);
                    } else {
                        handler(req, res);
                    }
                } catch (err) {
                    // ensure we release on sync error
                    onDone();
                    throw err;
                }
            }).catch((err) => {
                // If acquire throws (shouldn't), respond with 503
                try {
                    res.statusCode = 503;
                    res.end("Service temporarily unavailable");
                } catch (_) {}
            });
        })
        .on("upgrade", (req, socket, head) => {
            if (bareServer.shouldRoute(req)) {
                bareServer.routeUpgrade(req, socket as Socket, head);
            } else if (req.url?.endsWith("/wisp/") || req.url?.endsWith("/adblock/")) {
                console.log(req.url);
                wisp.routeRequest(req, socket as Socket, head);
            }
        });

    // optional server sockets tuning - keep existing defaults if you changed them earlier
    server.keepAliveTimeout = 3000;
    server.headersTimeout = 4000;

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
