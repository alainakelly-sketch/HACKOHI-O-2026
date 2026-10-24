import 'dotenv/config';
import { createApp } from './app';
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const server = createApp().listen(port, host, () =>
  console.log(
    `PaperBridge server listening on port ${port}. Model requests are gated by server configuration.`,
  ),
);
function close() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
