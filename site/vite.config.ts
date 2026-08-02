import { defineConfig } from "vite"

export default defineConfig({
  root: "site",
  build: {
    emptyOutDir: true,
    outDir: "../site-dist",
    target: "es2022",
  },
  worker: {
    format: "es",
  },
})
