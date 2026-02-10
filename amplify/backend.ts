import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { api } from './functions/api/resource';
import { tradingRunner } from './functions/trading-runner/resource';
import { ws } from './functions/ws/resource';
import { HttpApi, HttpMethod, CorsHttpMethod, WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration, WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Duration, Stack } from 'aws-cdk-lib';
import { Rule, Schedule, RuleTargetInput } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { StateMachine, DefinitionBody, Wait, WaitTime, Choice, Condition, Succeed, StateMachineType, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  api,
  tradingRunner,
  ws,
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

const httpAuthorizer = new HttpJwtAuthorizer(
  'CognitoAuthorizer',
  backend.auth.resources.userPool.userPoolProviderUrl,
  {
    jwtAudience: [backend.auth.resources.userPoolClient.userPoolClientId],
  }
);

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
  authorizer: httpAuthorizer,
});

// WebSocket API for real-time updates
const wsApi = new WebSocketApi(apiStack, 'WsApi', {
  apiName: 'binance-trader-ws',
  connectRouteOptions: {
    integration: new WebSocketLambdaIntegration('WsConnectIntegration', backend.ws.resources.lambda),
  },
  disconnectRouteOptions: {
    integration: new WebSocketLambdaIntegration('WsDisconnectIntegration', backend.ws.resources.lambda),
  },
  defaultRouteOptions: {
    integration: new WebSocketLambdaIntegration('WsDefaultIntegration', backend.ws.resources.lambda),
  },
});

const wsStage = new WebSocketStage(apiStack, 'WsStage', {
  webSocketApi: wsApi,
  stageName: 'prod',
  autoDeploy: true,
});

const wsManagementEndpoint = wsStage.url.replace('wss://', 'https://');
backend.tradingRunner.resources.lambda.addEnvironment('WS_API_ENDPOINT', wsManagementEndpoint);

const stack = Stack.of(apiStack);
backend.tradingRunner.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['execute-api:ManageConnections'],
  resources: [`arn:aws:execute-api:${stack.region}:${stack.account}:${wsApi.apiId}/*`],
}));

// Scheduled trading runner (1m + 10m)
new Rule(apiStack, 'TradingSchedule1m', {
  schedule: Schedule.rate(Duration.minutes(1)),
  targets: [new LambdaFunction(backend.tradingRunner.resources.lambda, {
    event: RuleTargetInput.fromObject({ cadence: 'STANDARD_1M' }),
  })],
});

new Rule(apiStack, 'TradingSchedule10m', {
  schedule: Schedule.rate(Duration.minutes(10)),
  targets: [new LambdaFunction(backend.tradingRunner.resources.lambda, {
    event: RuleTargetInput.fromObject({ cadence: 'SLOW_10M' }),
  })],
});

// Step Functions loop for 5s cadence
const fastInvoke = new LambdaInvoke(apiStack, 'FastInvoke', {
  lambdaFunction: backend.tradingRunner.resources.lambda,
  payload: TaskInput.fromObject({ cadence: 'FAST_5S' }),
  resultPath: '$.lastRun',
});

const fastWait = new Wait(apiStack, 'FastWait', {
  time: WaitTime.duration(Duration.seconds(5)),
});

const fastChoice = new Choice(apiStack, 'FastContinue')
  .when(Condition.booleanEquals('$.continue', true), fastInvoke)
  .otherwise(new Succeed(apiStack, 'FastStop'));

const fastDefinition = fastInvoke.next(fastWait).next(fastChoice);

const fastStateMachine = new StateMachine(apiStack, 'FastTradingStateMachine', {
  definitionBody: DefinitionBody.fromChainable(fastDefinition),
  stateMachineType: StateMachineType.EXPRESS,
});

backend.api.resources.lambda.addEnvironment('FAST_STATE_MACHINE_ARN', fastStateMachine.stateMachineArn);
fastStateMachine.grantStartExecution(backend.api.resources.lambda);
backend.api.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['states:StopExecution'],
  resources: [fastStateMachine.stateMachineArn],
}));

// Add outputs so frontend can access the API URL
backend.addOutput({
  custom: {
    API: {
      url: httpApi.url,
    },
    WS: {
      url: wsStage.url,
    },
  },
});
