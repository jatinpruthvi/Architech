import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInContext, createContext, type Context } from "node:vm";

/* Executes the REAL public/sw.js against a stubbed Cache API. There is no
   browser in this sandbox (Playwright's Chromium download is blocked, which is
   why mobile-audit.mjs is static too), so this is the closest thing to a real
   registration test: the file under test is the shipped artifact, not a
   re-implementation of it. */

const SW_SOURCE = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://architech.example";

class FakeCache {
  private store = new Map<string, Response>();
  private fetchImpl: (request: Request) => Promise<Response>;

  constructor(fetchImpl: (request: Request) => Promise<Response>) {
    this.fetchImpl = fetchImpl;
  }

  private key(request: Request | string) {
    return typeof request === "string" ? new URL(request, ORIGIN).pathname : new URL(request.url).pathname;
  }

  async add(request: Request) {
    const response = await this.fetchImpl(request);
    if (!response.ok) throw new Error(`precache failed for ${this.key(request)}`);
    this.store.set(this.key(request), response.clone());
  }

  async match(request: Request | string) {
    const hit = this.store.get(this.key(request));
    return hit ? hit.clone() : undefined;
  }

  async put(request: Request, response: Response) {
    this.store.set(this.key(request), response.clone());
  }

  get size() {
    return this.store.size;
  }
}

/* The worker only touches these members of each event, so the stubs are typed
   to exactly that surface instead of `any`. */
interface StubEvent {
  waitUntil?: (promise: Promise<unknown>) => void;
  request?: Request;
  respondWith?: (promise: Promise<Response>) => void;
}
type StubHandler = (event: StubEvent) => void;

interface Harness {
  listeners: Record<string, StubHandler[]>;
  fire: (type: string, event: StubEvent) => void;
  caches: Map<string, FakeCache>;
  seedCache: (name: string) => Promise<void>;
  setFetch: (impl: (request: Request) => Promise<Response>) => void;
}

/* A Request built by `new Request()` always carries mode "cors" — the spec
   forbids constructing a navigate-mode one. The worker branches on
   `request.mode === "navigate"`, so navigations are represented by a plain
   request-shaped object; the worker only ever reads url/method/mode. */
function navigationRequest(url: string) {
  return { url, method: "GET", mode: "navigate" } as unknown as Request;
}

function loadWorker(): Harness {
  const listeners: Record<string, StubHandler[]> = {};
  const cacheStore = new Map<string, FakeCache>();
  let fetchImpl: (request: Request) => Promise<Response> = async () => new Response("network", { status: 200 });

  const caches = {
    open: async (name: string) => {
      if (!cacheStore.has(name)) cacheStore.set(name, new FakeCache((request) => fetchImpl(request)));
      return cacheStore.get(name)!;
    },
    keys: async () => [...cacheStore.keys()],
    delete: async (name: string) => cacheStore.delete(name),
    match: async (request: Request | string) => {
      for (const cache of cacheStore.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const self = {
    location: new URL(ORIGIN),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    addEventListener: (type: string, handler: StubHandler) => {
      (listeners[type] ??= []).push(handler);
    },
  };

  const context: Context = createContext({
    self,
    caches,
    Request,
    Response,
    URL,
    Promise,
    console,
    get fetch() {
      return (request: Request) => fetchImpl(request);
    },
  });
  runInContext(SW_SOURCE, context);

  return {
    listeners,
    caches: cacheStore,
    seedCache: async (name: string) => {
      await caches.open(name);
    },
    setFetch: (impl) => {
      fetchImpl = impl;
    },
    fire: (type, event) => {
      for (const handler of listeners[type] ?? []) handler(event);
    },
  };
}

function waitUntilEvent() {
  const pending: Promise<unknown>[] = [];
  return {
    event: { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) },
    settled: () => Promise.all(pending),
  };
}

function fetchEvent(request: Request) {
  let responded: Promise<Response> | undefined;
  return {
    event: {
      request,
      respondWith: (promise: Promise<Response>) => {
        responded = promise;
      },
    },
    responded: () => responded,
  };
}

describe("public/sw.js", () => {
  let worker: Harness;

  beforeEach(() => {
    worker = loadWorker();
  });

  it("registers install, activate and fetch handlers", () => {
    expect(Object.keys(worker.listeners).sort()).toEqual(["activate", "fetch", "install"]);
  });

  it("precaches the offline shell on install", async () => {
    const { event, settled } = waitUntilEvent();
    worker.fire("install", event);
    await settled();
    const shell = worker.caches.get("architech-v1-shell");
    expect(shell).toBeDefined();
    expect(await shell!.match(new Request(`${ORIGIN}/offline.html`))).toBeDefined();
    expect(await shell!.match(new Request(`${ORIGIN}/manifest.webmanifest`))).toBeDefined();
    expect(shell!.size).toBe(4); // offline page, manifest, both home-screen icons
  });

  it("survives a precache 404 instead of failing the whole install", async () => {
    worker.setFetch(async (request) =>
      new URL(request.url).pathname === "/icon-512.png" ? new Response("nope", { status: 404 }) : new Response("ok", { status: 200 })
    );
    const { event, settled } = waitUntilEvent();
    worker.fire("install", event);
    await settled();
    const shell = worker.caches.get("architech-v1-shell")!;
    expect(await shell.match(new Request(`${ORIGIN}/offline.html`))).toBeDefined();
    expect(shell.size).toBe(3);
  });

  it("deletes caches from previous versions on activate", async () => {
    await worker.seedCache("architech-v0-shell");
    const { event, settled } = waitUntilEvent();
    worker.fire("activate", event);
    await settled();
    expect([...worker.caches.keys()]).not.toContain("architech-v0-shell");
  });

  it("serves the offline page when a navigation fails", async () => {
    worker.setFetch(async (request) =>
      new URL(request.url).pathname === "/offline.html" ? new Response("<html>offline</html>", { status: 200 }) : new Response("ok", { status: 200 })
    );
    const install = waitUntilEvent();
    worker.fire("install", install.event);
    await install.settled();

    worker.setFetch(async () => {
      throw new Error("network down");
    });
    const navigation = fetchEvent(navigationRequest(`${ORIGIN}/buy/ahmedabad/thaltej/`));
    worker.fire("fetch", navigation.event);
    const response = await navigation.responded()!;
    expect(await response.text()).toBe("<html>offline</html>");
  });

  it("leaves API calls to the network so lead data can never go stale", () => {
    const api = fetchEvent(new Request(`${ORIGIN}/api/broker/leads/metrics`));
    worker.fire("fetch", api.event);
    expect(api.responded()).toBeUndefined();
  });

  it("leaves cross-origin requests to the network", () => {
    const tile = fetchEvent(new Request("https://tile.openstreetmap.org/1/1/1.png"));
    worker.fire("fetch", tile.event);
    expect(tile.responded()).toBeUndefined();
  });

  it("caches immutable build assets and reuses them", async () => {
    let calls = 0;
    worker.setFetch(async () => {
      calls += 1;
      return new Response("chunk", { status: 200 });
    });
    const url = `${ORIGIN}/_next/static/chunks/abc123.js`;

    const first = fetchEvent(new Request(url));
    worker.fire("fetch", first.event);
    expect(await (await first.responded()!).text()).toBe("chunk");
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the cache.put settle

    const second = fetchEvent(new Request(url));
    worker.fire("fetch", second.event);
    expect(await (await second.responded()!).text()).toBe("chunk");
    expect(calls).toBe(1);
  });

  it("does not cache dynamic assets such as listing images", () => {
    const image = fetchEvent(new Request(`${ORIGIN}/images/prop-thaltej.webp`));
    worker.fire("fetch", image.event);
    expect(image.responded()).toBeUndefined();
  });
});
