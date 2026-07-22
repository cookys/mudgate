/** Minimal TCP mock that plays a byte fixture then optional MCCP2 compressed payload. */
import net from "node:net";
import zlib from "node:zlib";
import { IAC, WILL, DO, SB, SE, OPT } from "@mudgate/protocol";

export type MockMudHandle = {
  port: number;
  close: () => Promise<void>;
};

export async function startMockMud(opts: {
  fixture: Buffer;
  mccp?: boolean;
  compressedPlain?: Buffer;
}): Promise<MockMudHandle> {
  const server = net.createServer((sock) => {
    // IAC preamble: WILL MCCP2 optional
    if (opts.mccp) {
      sock.write(Buffer.from([IAC, WILL, OPT.MCCP2]));
    }
    sock.write(opts.fixture);
    if (opts.mccp && opts.compressedPlain) {
      const z = zlib.deflateSync(opts.compressedPlain);
      sock.write(Buffer.from([IAC, SB, OPT.MCCP2, IAC, SE]));
      sock.write(z);
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return {
    port: addr.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

export { IAC, WILL, DO, OPT };
