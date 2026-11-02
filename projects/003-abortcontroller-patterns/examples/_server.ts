import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A tiny local server that answers `GET /?delay=ms` after `ms` milliseconds,
 * so the fetch examples run offline and timing is predictable.
 */
export async function startSlowServer() {
  const server = createServer((req, res) => {
    const delay = Number(new URL(req.url ?? "/", "http://localhost").searchParams.get("delay") ?? 0);
    const timer = setTimeout(() => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ delay }));
    }, delay);
    // Fires when the response finishes OR the client hangs up (an aborted fetch).
    res.on("close", () => clearTimeout(timer));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: (delay: number) => `http://127.0.0.1:${port}/?delay=${delay}`,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
}
