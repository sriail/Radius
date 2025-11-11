import type { Handler } from "@netlify/functions";
import Fastify from "fastify";
import fastifyMiddie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { createBareServer } from "@tomphttp/bare-server-node";
import { handler as astroHandler } from "../../dist/server/entry.mjs";
import { createServer } from "node:http";
import { Socket } from "node:net";

const bareServer = createBareServer("/bare/");

let app: any = null;

async function getApp() {
    if (app) return app;

    const serverFactory = (handler: any) => {
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
                    wisp.routeRequest(req, socket as Socket, head);
                }
            });
    };

    app = Fastify({
        logger: false,
        ignoreDuplicateSlashes: true,
        ignoreTrailingSlash: true,
        serverFactory: serverFactory
    });

    await app.register(fastifyStatic, {
        root: fileURLToPath(new URL("../../dist/client", import.meta.url))
    });

    await app.register(fastifyMiddie);
    await app.use(astroHandler);

    app.setNotFoundHandler((req: any, res: any) => {
        res.redirect("/404");
    });

    return app;
}

export const handler: Handler = async (event, context) => {
    const app = await getApp();

    // Handle the request through Fastify
    return new Promise((resolve, reject) => {
        const req = {
            method: event.httpMethod,
            url:
                event.path +
                (event.queryStringParameters
                    ? "?" + new URLSearchParams(event.queryStringParameters).toString()
                    : ""),
            headers: event.headers,
            body: event.body
        };

        app.inject(req, (err: any, res: any) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: res.payload
                });
            }
        });
    });
};
