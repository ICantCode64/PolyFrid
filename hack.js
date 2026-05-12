let L = null;

const vm = Process.getModuleByName("Luau.VM.dll");
const compiler = Module.load("Luau.Compiler.dll");

function E(m, n) {
    return m.enumerateExports().find(x => x.name === n)?.address;
}

const compile = new NativeFunction(
    E(compiler, "luau_compile"),
    "pointer",
    ["pointer", "int", "pointer", "pointer"]
);

const luau_load = new NativeFunction(
    E(vm, "luau_load"),
    "int",
    ["pointer","pointer","pointer","int","pointer","pointer","pointer","pointer","int"]
);

const lua_gettop = new NativeFunction(
    E(vm, "lua_gettop"),
    "int",
    ["pointer"]
);

const lua_pcall = new NativeFunction(
    E(vm, "lua_pcall"),
    "int",
    ["pointer","int","int","int"]
);

const lua_tolstring = new NativeFunction(
    E(vm, "lua_tolstring"),
    "pointer",
    ["pointer", "int", "pointer"]
);

function exec(code) {
    if (!L) return;

    const out = Memory.alloc(8);

    const bytecode = compile(
        Memory.allocUtf8String(code),
        code.length,
        ptr(0),
        out
    );

    const size = out.readU32();

    const status = luau_load(
        L,
        Memory.allocUtf8String("chunk"),
        bytecode,
        size,
        ptr(0), ptr(0), ptr(0), ptr(0), 0
    );

    console.log("load:", status, "top:", lua_gettop(L));

    if (!status)
        console.log("pcall:", lua_pcall(L, 0, -1, 0));
}

const hook = vm.enumerateExports().find(e => e.name === "lua_gettop");

if (hook) {
    Interceptor.attach(hook.address, {
        onEnter(args) {
            if (L) return;
            L = args[0];
            console.log("lua_State:", L);
        }
    });
}

Interceptor.attach(E(vm, "lua_pcall"), {
    onEnter(args) {
        this.L = args[0];
        this.top = lua_gettop(this.L);
    },

    onLeave(retval) {
        const L = this.L;
        const top = lua_gettop(L);

        for (let i = this.top + 1; i <= top; i++) {
            const lenPtr = Memory.alloc(8);

            const strPtr = lua_tolstring(L, i, lenPtr);

            if (strPtr.isNull()) continue;

            const str = strPtr.readUtf8String();

            console.log("[lua]", str);
        }
    }
});

rpc.exports = {
    run(code) {
        exec(code);
    }
};