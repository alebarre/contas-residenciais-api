import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { env } from './env';
import { registerCors } from './plugins/cors';
import { healthRoutes } from './routes/health.route';

import { registerErrorHandler } from './plugins/error-handler';

import { authRoutes } from './auth/auth.route';
import { meRoutes } from './me/me.route';
import { bankRoutes } from './banks/banks.routes';
import { itemRoutes } from './items/item.routes';
import { expenseRoutes } from './expenses/expense.routes';


export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug'
    }
  });

  registerErrorHandler(app);

  app.register(helmet);
  app.register(sensible);
  registerCors(app);

  // Swagger (ajuda muito na Etapa 1)
  app.register(swagger, {
    openapi: {
      info: { title: 'Contas Residenciais API', version: 'v1' }
    }
  });
  app.register(swaggerUI, { routePrefix: '/docs' });

  app.register(healthRoutes, { prefix: '/api' });

  app.register(authRoutes, { prefix: '/api' });

  app.register(meRoutes, { prefix: '/api' });

  app.register(bankRoutes, { prefix: '/api' });

  app.register(itemRoutes, { prefix: '/api' });

  app.register(expenseRoutes, { prefix: '/api' });



  return app;
}
