# Binance Trader - Deployment Guide

## 1. Region Selection (Important)

To access **Binance Global API** (as required by this app), you MUST deploy your backend to a region outside the US.

**Recommended Region:** `ap-south-1` (Mumbai)

### How to set region for Amplify Gen 2

When you deploy or sandbox, specify the region using your AWS profile or environment variables.

#### Option A: Using AWS Profile (Recommended)
1. Configure a profile for ap-south-1:
   ```bash
   aws configure --profile mumbai
   # Region: ap-south-1
   ```
2. Run sandbox/deploy with this profile:
   ```bash
   npx ampx sandbox --profile mumbai
   ```

#### Option B: Using Environment Variable
```bash
AWS_REGION=ap-south-1 npx ampx sandbox
```

## 2. Deploying Backend

The `amplify.yml` currently only builds the frontend. To deploy the backend (database + API) with Amplify Gen 2:

1. Ensure your `amplify/backend.ts` defines all necessary resources (Auth is defined, but verify Data/DB).
2. Run:
   ```bash
   npx ampx pipeline-deploy --branch main --app-id <YOUR_APP_ID>
   ```

## 3. Environment Variables

In the Amplify Console (under Hosting > Environment variables), verify:

- `BINANCE_API_KEY`: Your Global API Key
- `BINANCE_API_SECRET`: Your Global API Secret
- `TRADING_MODE`: `paper` or `live`

## 4. Local Development Note

If you are developing locally from the **US**:
- Calls to `api.binance.com` will fail with `Service unavailable from a restricted location`.
- **Workaround**: Use a VPN connected to a non-restricted region (e.g., Japan, Singapore, India) while running `npm run dev`.

## 5. Troubleshooting authentication

If "Cognito auth is not working":
1. Check that `amplify_outputs.json` is generated correctly.
2. Ensure you are wrapping your App in `<Authenticator>` (we just added this).
3. Verify the User Pool is created in the correct region (`ap-south-1`).
