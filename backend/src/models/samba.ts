// Samba accounts. Listed and created by one small root-only script, run through sudo
// (deploy/serverdash-samba). The API itself never runs as root.
import { execFile } from "node:child_process";
import { httpError } from "./tailnet.ts";

const HELPER = "/usr/local/sbin/serverdash-samba";
export const USERNAME = /^[a-z][a-z0-9-]{1,31}$/;

// Run the helper as root. `input` goes to its standard input; that's how the password travels.
function runHelper(args: string[], input = ""): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("sudo", ["-n", HELPER, ...args], { timeout: 15_000 }, (error, stdout, stderr) => {
      if (!error) {
        resolve(stdout);
        return;
      }
      // the helper's exit code: 2 = bad input, 3 = already exists
      const status = error.code === 2 ? 400 : error.code === 3 ? 409 : 500;
      reject(httpError(status, stderr.trim() || error.message));
    });
    child.stdin?.end(input);
  });
}

export async function getSambaUsers(): Promise<string[]> {
  const out = await runHelper(["list"]);
  return out.split("\n").filter((line) => line !== "");
}

export async function createSambaUser(username: string, password: string) {
  await runHelper(["add", username], password + "\n");
  return { created: true, username, folder: `/srv/data/files/${username}` };
}