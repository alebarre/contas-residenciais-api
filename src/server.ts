import { env } from './env';
import { buildApp } from './app';

async function main() {
  const app = buildApp();

  await app.listen({ port: env.PORT, host: '0.0.0.0' });

  app.log.info(`API up: http://localhost:${env.PORT}/api/health`);
  app.log.info(`Docs: http://localhost:${env.PORT}/docs`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
