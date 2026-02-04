import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
    AccountSnapshot: a.model({
        total_equity: a.float().required(),
        available_balance: a.float().required(),
        timestamp: a.datetime().required(),
    }).authorization(allow => [allow.authenticated()]),

    Signal: a.model({
        symbol: a.string().required(),
        direction: a.enum(['LONG', 'SHORT']),
        entry_min: a.float(),
        entry_max: a.float(),
        stop_loss: a.float(),
        take_profit_1: a.float(),
        max_risk_percent: a.float(),
        rationale: a.json(),
        generated_at: a.datetime().required(),
        ai_confidence: a.integer(),
        ai_comment: a.string(),
    }).authorization(allow => [allow.authenticated()]),

    Trade: a.model({
        symbol: a.string().required(),
        side: a.enum(['BUY', 'SELL']),
        entry_price: a.float().required(),
        exit_price: a.float(),
        quantity: a.float().required(),
        stop_loss: a.float().required(),
        take_profit: a.float().required(),
        realized_pnl: a.float(),
        realized_pnl_percent: a.float(),
        status: a.enum(['OPEN', 'CLOSED', 'CANCELLED']).required(),
        opened_at: a.datetime().required(),
        closed_at: a.datetime(),
        ai_analysis: a.string(),
    }).authorization(allow => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema,
    authorizationModes: {
        defaultAuthorizationMode: 'userPool',
    },
});
