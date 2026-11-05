// Starts the API on the address in config.
import { app } from "./app.ts";
import { config } from "./config.ts";

app.listen(config.port, config.host, (error) => {
  if (error) throw error;  // e.g. the port is already taken
  console.log(`serverdash API on http://${config.host}:${config.port}`);
});