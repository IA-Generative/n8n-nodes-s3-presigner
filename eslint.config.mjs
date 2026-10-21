import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
    ...configWithoutCloudSupport,
    {
        files: ['nodes/**/*.ts'],
        rules: {
            '@n8n/community-nodes/no-credential-reuse': 'off',
        },
    },
];