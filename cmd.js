(async () => {
    const frida = await import("frida");
    const readline = require("readline");
    const fs = require("fs");

    const session = await frida.attach("Polytoria Client.exe");

    const script = await session.createScript(fs.readFileSync("hack.js", "utf8"));
    await script.load();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "luau> "
    });

    script.message.connect(message => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);

        if (message.type === "send") {
            console.log("[frida]", message.payload);
        } else if (message.type === "error") {
            console.log("[frida error]", message.stack);
        }

        rl.prompt(true);
    });

    rl.prompt();

    rl.on("line", async (line) => {
        try {
            await script.exports.run(line);
        } catch (e) {
            console.log("error:", e);
        }

        rl.prompt();
    });
})();