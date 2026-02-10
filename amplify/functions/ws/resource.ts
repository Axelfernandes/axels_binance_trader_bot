import { defineFunction } from '@aws-amplify/backend';

export const ws = defineFunction({
    name: 'ws-handler',
    entry: './handler.ts',
    timeoutSeconds: 30,
    memoryMB: 256,
});
