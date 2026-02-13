import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { corsOrigins } from '../env';

export function registerCors(app: FastifyInstance) {
  app.register(cors, {
    origin: (origin, cb) => {
      // Postman/curl não envia Origin
      if (!origin) return cb(null, true);

      if (corsOrigins.includes(origin)) return cb(null, true);

      return cb(new Error('Not allowed by CORS'), false);
    }
  });
}