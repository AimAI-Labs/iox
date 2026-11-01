import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const WIREFRAMES = [
  "preview-overview-placeholder.svg",
  "feature-bubble-placeholder.svg",
  "feature-card-placeholder.svg",
  "feature-web-placeholder.svg",
  "feature-file-drag-placeholder.svg",
];

// SVG images inherit color-scheme from the page. Keep the original artwork
// editable in public/, and add the night palette when serving or building it.
const NIGHT_PALETTE = `<style>
  @media (prefers-color-scheme: dark) {
    [fill="#F5F1E8"] { fill: #1f1f1f; }
    [fill="#30343A"] { fill: #c9cdd3; }
    [stroke="#30343A"] { stroke: #626262; }
    [fill="#2148B8"] { fill: #8fa9ff; }
    [stroke="#2148B8"] { stroke: #8fa9ff; }
    [fill="#C65F38"] { fill: #ef9b7a; }
    [stroke="#C65F38"] { stroke: #ef9b7a; }
    pattern [fill="#30343A"] { fill: #626262; }
    text { font-weight: 600; }
    text[fill="#30343A"] { fill: #f5f5f5; }
    text[fill="#2148B8"] { fill: #b3c3ff; }
    text[fill="#C65F38"] { fill: #ffc4a9; }
    text[fill="#F5F1E8"] { fill: #181818; }
  }
</style>`;

export function wireframeTheme(): Plugin {
  let publicDir = "";

  async function readArtwork(name: string): Promise<string | undefined> {
    try {
      const svg = await readFile(path.join(publicDir, "placeholders", name), "utf8");
      return svg.replace(/<\/svg>\s*$/i, `${NIGHT_PALETTE}</svg>`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  return {
    name: "iox-wireframe-theme",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url?.split("?")[0];
        const name = WIREFRAMES.find((file) => url === `/placeholders/${file}`);
        if (!name || !["GET", "HEAD"].includes(request.method ?? "")) return next();
        try {
          const svg = await readArtwork(name);
          if (!svg) return next();
          response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
          response.setHeader("Cache-Control", "no-cache");
          response.end(request.method === "HEAD" ? undefined : svg);
        } catch (error) {
          next(error);
        }
      });
    },
    async writeBundle(output) {
      if (!output.dir) return;
      const directory = output.dir;
      await Promise.all(WIREFRAMES.map(async (name) => {
        const svg = await readArtwork(name);
        if (svg) await writeFile(path.join(directory, "placeholders", name), svg);
      }));
    },
  };
}
