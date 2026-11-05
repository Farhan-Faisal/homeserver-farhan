// Shared by every test file: start the real API on a free port, and call it.
import type { AddressInfo } from "node:net";
import { after, before } from "node:test";
import { app } from "../src/app.ts";

// You. Tests check you're listed as the owner/admin everywhere, and that you're always protected.
export const OWNER = { email: "dmitri.farhan@gmail.com", username: "dmitri5556" };

let base = "";

// Start the app before this file's tests, on any free port (0), and stop it afterwards.
export function useServer() {
  let server: ReturnType<typeof app.listen>;
  before(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });
  after(() => {
    server.closeAllConnections();  // fetch keeps connections open; close them so the test can end
    server.close();
  });
}

// Call the API. Returns the status code and the JSON body.
// The body is typed `any` on purpose: tests read whatever fields they check.
export async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}