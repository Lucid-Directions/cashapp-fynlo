# SumUp Configuration Setup

## Environment Variables

The SumUp integration requires the following environment variables to be configured:

- `SUMUP_API_KEY` - Your SumUp API key
- `SUMUP_MERCHANT_CODE` - Your SumUp merchant code
- `SUMUP_AFFILIATE_KEY` - Your SumUp affiliate key (required for SDK initialization)
- `SUMUP_APPLICATION_ID` - Your SumUp application ID
- `SUMUP_ENVIRONMENT` - Either "sandbox" or "production"

## Setup Instructions

### For Local Development

1. Create a `.env.local` file in the `backend/` directory (this file is git-ignored)
2. Add your SumUp credentials:

```env
SUMUP_API_KEY="your-actual-api-key"
SUMUP_MERCHANT_CODE="your-actual-merchant-code"
SUMUP_AFFILIATE_KEY="your-actual-affiliate-key"
SUMUP_APPLICATION_ID="your-actual-app-id"
SUMUP_ENVIRONMENT="sandbox"
```

3. The application will automatically load these values from `.env.local`

### For Production Deployment (DigitalOcean)

Set these environment variables in your DigitalOcean App Platform:

1. Go to your app in DigitalOcean dashboard
2. Navigate to Settings → App-Level Environment Variables
3. Add each variable with its production value
4. Set `SUMUP_ENVIRONMENT="production"` for production

### For Testing

Use the test script to verify your configuration:

```bash
# Set your DigitalOcean app ID
export DO_APP_ID="your-digitalocean-app-id"

# Run the test
./test-sumup-flow.sh
```

## Security Notes

- **NEVER** commit actual API keys to version control
- Always use `.env.local` for local development (git-ignored)
- Use environment variables for production deployments
- The `.env` file should only contain placeholder values

## Troubleshooting

If the SumUp SDK initialization fails:

1. Check that all environment variables are set
2. Verify the affiliate key is correct (required for SDK init)
3. Ensure you're using the correct environment (sandbox vs production)
4. Check backend logs for any configuration errors