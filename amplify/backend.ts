import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { api } from './functions/api/resource';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const backend = defineBackend({
  auth,
  data,
  api,
});

// Create API Gateway HTTP API
const apiStack = backend.createStack('api-stack');

const httpApi = new HttpApi(apiStack, 'HttpApi', {
  apiName: 'binance-trader-api',
  corsPreflight: {
    allowOrigins: ['*'],
    allowMethods: [CorsHttpMethod.ANY],
    allowHeaders: ['*'],
  },
});

// Create Lambda integration
const integration = new HttpLambdaIntegration(
  'ApiIntegration',
  backend.api.resources.lambda
);

// Add catch-all route for /api/*
httpApi.addRoutes({
  path: '/api/{proxy+}',
  methods: [HttpMethod.ANY],
  integration,
});

// Add outputs so frontend can access the API URL
backend.addOutput({
  custom: {
    API: {
      url: httpApi.url,
    },
  },
});
