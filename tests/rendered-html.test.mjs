import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Municipio Digital portal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Municipio Digital \| Cuatro Cañadas/);
  assert.match(html, /Gobierno Autónomo Municipal de Cuatro Cañadas/);
  assert.match(html, /id="seguimiento"/);
  assert.match(html, /HR-2026-00481/);
  assert.match(html, /Consulta el código exacto entregado/);
  assert.match(html, /Saca tu ficha médica virtual aquí/);
  assert.match(html, /Denuncia anónima y protegida/);
  assert.match(html, /Secretaría General o en la unidad municipal competente/);
  assert.doesNotMatch(html, /Iniciar un trámite/);
  assert.doesNotMatch(html, /DATABASE_URL|postgresql:\/\//i);
});

test("keeps Neon lazy and ChatGPT Sites build-compatible", async () => {
  const [page, dbIndex, schema, listApi, trackingApi, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/hojas-ruta/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/seguimiento/[codigo]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/hojas-ruta"/);
  assert.match(page, /\/api\/seguimiento\//);
  assert.match(page, /Neon · datos en vivo/);
  assert.match(listApi, /export async function GET/);
  assert.match(listApi, /export async function POST/);
  assert.match(trackingApi, /obtenerSeguimiento/);
  assert.match(dbIndex, /let database: ReturnType<typeof createDb> \| null = null/);
  assert.match(dbIndex, /if \(!database\) database = createDb\(\)/);
  assert.doesNotMatch(dbIndex, /neon\(process\.env\.DATABASE_URL!/);

  for (const table of [
    "unidades",
    "funcionarios",
    "solicitantes",
    "hojas_de_ruta",
    "derivaciones",
    "eventos_seguimiento",
    "auditoria",
  ]) {
    assert.match(schema, new RegExp(`"${table}"`));
  }

  assert.match(hosting, /"project_id"/);
  assert.match(hosting, /"d1": null/);
  assert.doesNotMatch(`${page}\n${dbIndex}\n${schema}`, /postgresql:\/\//i);
});
