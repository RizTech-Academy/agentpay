import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const app = buildApp();

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`AgentPay API listening on http://localhost:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
