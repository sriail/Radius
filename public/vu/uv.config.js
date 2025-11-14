self.__uv$config = {
    prefix: "/~/uv/",
    encodeUrl: function encode(str) {
        if (!str) return str;
        try {
            // More robust encoding for complex URLs
            return encodeURIComponent(
                str
                    .toString()
                    .split("")
                    .map((char, ind) =>
                        ind % 2 ? String.fromCharCode(char.charCodeAt() ^ 3) : char
                    )
                    .join("")
            );
        } catch (e) {
            console.error("URL encoding error:", e);
            return encodeURIComponent(str);
        }
    },
    decodeUrl: function decode(str) {
        if (!str) return str;
        try {
            let [input, ...search] = str.split("?");

            return (
                decodeURIComponent(input)
                    .split("")
                    .map((char, ind) =>
                        ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 3) : char
                    )
                    .join("") + (search.length ? "?" + search.join("?") : "")
            );
        } catch (e) {
            console.error("URL decoding error:", e);
            return decodeURIComponent(str);
        }
    },
    handler: "/vu/uv.handler.js",
    client: "/vu/uv.client.js",
    bundle: "/vu/uv.bundle.js",
    config: "/vu/uv.config.js",
    sw: "/vu/uv.sw.js"
};
