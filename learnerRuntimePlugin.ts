import type { Plugin } from "vite";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import fs from "node:fs/promises";
import path from "node:path";

export function learnerRuntimePlugin(): Plugin {
  let runtime: Promise<{ js: string; css: string }> | undefined;
  const compile = () => runtime ??= (async () => {
    const result = await build({
      entryPoints: ["src/standalone/learner.tsx"], bundle: true, write: false,
      format: "iife", platform: "browser", minify: true, jsx: "automatic",
      loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl" },
      define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
      plugins: [{ name: "standalone-alias", setup(builder) {
        builder.onResolve({ filter: /^@\// }, args => ({ path: path.resolve(args.path === "@/integrations/supabase/client" || args.path === "@/lib/supabase" ? "src/lib/standaloneLearnerBackend.ts" : `src/${args.path.slice(2)}`) }));
        builder.onResolve({ filter: /.*/ }, async args => {
          if (!args.path.startsWith("@/")) return;
          return undefined;
        });
      } }],
    });
    const source = (await fs.readFile("src/index.css", "utf8")).replace(/@import\s+url\([^;]+;/g, "");
    const css = await postcss([tailwindcss(), autoprefixer()]).process(source, { from: path.resolve("src/index.css") });
    return { js: result.outputFiles[0].text, css: css.css };
  })();
  return {
    name: "contentforge-learner-runtime",
    configureServer(server) {
      server.watcher.on("change", file => { if (file.includes("/src/") || file.endsWith("tailwind.config.ts")) runtime = undefined; });
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/learner-runtime.")) return next();
        try {
          const compiled = await compile();
          const isCss = req.url.startsWith("/learner-runtime.css");
          res.setHeader("Content-Type", isCss ? "text/css" : "application/javascript");
          res.end(isCss ? compiled.css : compiled.js);
        } catch (error) { runtime = undefined; res.statusCode = 500; res.end(String(error)); }
      });
    },
    async generateBundle() {
      const compiled = await compile();
      this.emitFile({ type: "asset", fileName: "learner-runtime.js", source: compiled.js });
      this.emitFile({ type: "asset", fileName: "learner-runtime.css", source: compiled.css });
    },
  };
}