import { defineConfig } from 'orval';

export default defineConfig({
  'core-api': {
    input: {
      target: './swagger.json',
    },
    output: {
      target: './src/api/core/generated.ts',
      schemas: './src/api/core/model',
      client: 'axios',
      mode: 'split',
      override: {
        mutator: {
          path: './src/lib/axios-instance.ts',
          name: 'axiosInstance',
        },
      },
      clean: true,
    },
  },
  'audit-api': {
    input: {
      target: './swagger-audit.json',
    },
    output: {
      target: './src/api/audit/generated.ts',
      schemas: './src/api/audit/model',
      client: 'axios',
      mode: 'split',
      override: {
        mutator: {
          path: './src/lib/axios-instance.ts',
          name: 'auditAxiosInstance',
        },
      },
      clean: true,
    },
  },
});
