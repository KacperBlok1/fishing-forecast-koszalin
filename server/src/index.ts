import { existsSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config } from './config.js';
import { closePool, waitForDatabase } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { attachUser } from './lib/auth.js';
import { HttpError } from './lib/errors.js';
import { cleanupExpiredSessions } from './lib/sessions.js';
import { authRoutes } from './routes/auth.js';
import { prefsRoutes } from './routes/prefs.js';
import { spotRoutes } from './routes/spots.js';
import { weatherRoutes } from './routes/weather.js';
import { cleanupWeatherCache } from './services/weatherCache.js';

/** Co godzinę sprzątamy wygasłe sesje i przeterminowany cache pogodowy. */
const MAINTENANCE_INTERVAL_MS = 60 * 60_000;

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: config.logLevel },
    // Za reverse proxy (nginx, Caddy) pozwala poprawnie odczytać adres klienta,
    // co ma znaczenie dla limitu prób logowania.
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  app.log.info('Czekam na bazę danych…');
  await waitForDatabase();
  app.log.info('Baza odpowiada, uruchamiam migracje');
  await runMigrations((message) => app.log.info(message));

  await app.register(cookie);

  // Nagłówki bezpieczeństwa — ręcznie, bez dodatkowej zależności.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return payload;
  });

  app.addHook('preHandler', attachUser);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error }, 'Błąd aplikacji');
      }
      reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
      return;
    }

    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Nieobsłużony błąd');
      reply.code(500).send({
        error: {
          code: 'internal_error',
          message: 'Coś poszło nie tak po stronie serwera. Sprawdź logi kontenera.',
        },
      });
      return;
    }

    reply.code(statusCode).send({
      error: { code: 'bad_request', message: error.message || 'Nieprawidłowe żądanie.' },
    });
  });

  app.get('/api/health', async () => {
    return { status: 'ok', time: new Date().toISOString() };
  });

  // Trasy deklarują pełne ścieżki (/api/...), więc rejestrujemy je bez prefiksu.
  // Dzięki temu nie ma wątpliwości, czy adres kończy się ukośnikiem, czy nie.
  await app.register(authRoutes);
  await app.register(spotRoutes);
  await app.register(prefsRoutes);
  await app.register(weatherRoutes);

  const clientDir = config.clientDir;
  const hasClient = existsSync(join(clientDir, 'index.html'));

  if (hasClient) {
    await app.register(fastifyStatic, {
      root: clientDir,
      index: false,
      wildcard: false,
      setHeaders(response: ServerResponse, path: string) {
        // Pliki z hashem w nazwie (Vite) można trzymać w cache długo,
        // ale powłoka i service worker muszą być zawsze świeże.
        if (path.endsWith('index.html') || path.endsWith('sw.js') || path.endsWith('manifest.json')) {
          response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (path.includes(`${'/'}assets${'/'}`)) {
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          response.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    });
    app.log.info(`Serwuję frontend z ${clientDir}`);
  } else {
    app.log.warn(
      `Nie znalazłem zbudowanego frontendu w ${clientDir}. API działa, ale aplikacja nie będzie się otwierać.`
    );
  }

  /**
   * Nieznana ścieżka pod /api zwraca JSON, a nie index.html — inaczej literówka
   * w adresie kończyłaby się dziwnym błędem parsowania po stronie klienta.
   * Wszystko inne dostaje powłokę aplikacji, bo routing jest po stronie przeglądarki.
   */
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.code(404).send({ error: { code: 'not_found', message: 'Nie ma takiego endpointu.' } });
      return;
    }
    if (!hasClient) {
      reply.code(503).type('text/plain; charset=utf-8').send('Frontend nie został zbudowany.');
      return;
    }
    reply.sendFile('index.html');
  });

  const maintenance = setInterval(() => {
    void (async () => {
      try {
        const sessions = await cleanupExpiredSessions();
        const cache = await cleanupWeatherCache();
        if (sessions || cache) {
          app.log.info(`Porządki: usunięto ${sessions} sesji i ${cache} wpisów cache`);
        }
      } catch (error) {
        app.log.warn({ err: error }, 'Porządki nie powiodły się');
      }
    })();
  }, MAINTENANCE_INTERVAL_MS);
  maintenance.unref();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Otrzymano ${signal}, zamykam serwer`);
    clearInterval(maintenance);
    try {
      await app.close();
      await closePool();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Serwer słucha na ${config.host}:${config.port}`);
}

main().catch((error: unknown) => {
  console.error('Serwer nie wystartował:', error instanceof Error ? error.message : error);
  process.exit(1);
});
