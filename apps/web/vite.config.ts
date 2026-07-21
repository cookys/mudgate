import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * iconv-lite needs Node builtins in the browser:
 * - package.json "browser": { "stream": false } would blank out stream
 * - encodings/internal.js requires string_decoder
 * Force real browserify polyfills so Big5/HKSCS tables load.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: process.env.VITE_HOST ?? "127.0.0.1",
  },
  resolve: {
    alias: {
      stream: require.resolve("stream-browserify"),
      string_decoder: require.resolve("string_decoder/"),
      events: require.resolve("events/"),
      buffer: require.resolve("buffer/"),
    },
  },
  define: {
    global: "globalThis",
  },
  optimizeDeps: {
    include: [
      "iconv-lite",
      "buffer",
      "stream-browserify",
      "string_decoder",
      "events",
      "safer-buffer",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/iconv-lite/, /safer-buffer/, /buffer/, /node_modules/],
    },
  },
});
