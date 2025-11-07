import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// https://vitejs.dev/config/
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig(async ({ mode }) => {
  const visualize = process.env.VISUALIZE === 'true' || process.env.ANALYZE === 'true';
  let visualizerPlugin: any = null;
  if (visualize) {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer');
      visualizerPlugin = visualizer({
        filename: 'dist/stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
      });
    } catch (e) {
      console.warn('[analyze] rollup-plugin-visualizer not installed; skip report');
    }
  }

  return ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    headers: {
      // Allow fullscreen broadly in dev to avoid PDF viewer warnings
      // Note: Some Chrome builds honor legacy wildcard syntax
      'Permissions-Policy': 'fullscreen=*'
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5000,
    headers: {
      'Permissions-Policy': 'fullscreen=*'
    },
  },
  plugins: [
    react(),
    ...(visualizerPlugin ? [visualizerPlugin] : []),
  ],
  resolve: {
    alias: {
      "@": resolve(root, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'charts';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('react-router')) return 'router';
            if (id.includes('@supabase')) return 'supabase';
            return 'vendor';
          }
        },
      },
    },
  },
  });
});
