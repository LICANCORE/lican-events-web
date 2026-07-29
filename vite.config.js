import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const headbangBridgePublicPath =
  '/headbangdealers_the_game/assets/supabase-bridge.js';
const headbangBridgeSourcePath =
  '/src/headbang-game/gamePersistenceBridge.js';

function headbangBridgeDevelopmentAlias() {
  return {
    name: 'headbang-supabase-bridge-development-alias',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const [pathname, query] = (request.url ?? '').split('?', 2);
        const querySuffix = query ? `?${query}` : '';

        if (pathname === headbangBridgePublicPath) {
          request.url = `${headbangBridgeSourcePath}${querySuffix}`;
        } else if (
          pathname === '/headbangdealers_the_game' ||
          pathname === '/headbangdealers_the_game/'
        ) {
          request.url = `/headbangdealers_the_game/index.html${querySuffix}`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), headbangBridgeDevelopmentAlias()],
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        headbangSupabaseBridge: fileURLToPath(
          new URL(
            'src/headbang-game/gamePersistenceBridge.js',
            import.meta.url,
          ),
        ),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'headbangSupabaseBridge'
            ? 'headbangdealers_the_game/assets/supabase-bridge.js'
            : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
