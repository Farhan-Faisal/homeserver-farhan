
import Database from "better-sqlite3";
import { config } from "./config.ts";

export const db = new Database(config.dbPath, {
  readonly: true,       // this program can never change the data, even by mistake
  fileMustExist: true,  // stop at startup if the collector hasn't created the database yet
});