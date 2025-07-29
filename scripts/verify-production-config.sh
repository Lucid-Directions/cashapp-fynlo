#!/bin/bash
# Script to verify production configuration in DigitalOcean
# Issue #394 - Production configuration validation

APP_ID="04073e70-e799-4d27-873a-dadea0503858"

echo "=== Verifying Production Configuration for Fynlo POS ==="
echo "App ID: $APP_ID"
echo ""

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "ERROR: doctl CLI is not installed. Please install it first."
    echo "Visit: https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

echo "Fetching current app configuration..."
APP_SPEC=$(doctl apps get $APP_ID --format json 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to fetch app configuration. Please check your doctl authentication."
    exit 1
fi

echo ""
echo "=== Checking Critical Environment Variables ==="
echo ""

# Function to check if an env var exists
check_env_var() {
    local var_name=$1
    local expected_value=$2
    
    if echo "$APP_SPEC" | jq -r '.[] | .spec.envs[]? | select(.key=="'$var_name'")' | grep -q "$var_name"; then
        echo "✅ $var_name is set"
        if [ ! -z "$expected_value" ]; then
            # For non-secret values, we can check the actual value
            actual_value=$(echo "$APP_SPEC" | jq -r '.[] | .spec.envs[]? | select(.key=="'$var_name'") | .value' 2>/dev/null)
            if [[ "$actual_value" != *"EV["* ]]; then
                if [ "$actual_value" == "$expected_value" ]; then
                    echo "   ✅ Value is correct: $actual_value"
                else
                    echo "   ❌ Value mismatch - Expected: $expected_value, Got: $actual_value"
                fi
            else
                echo "   ℹ️  Value is encrypted (secret)"
            fi
        fi
    else
        echo "❌ $var_name is NOT set"
    fi
}

echo "Critical Variables for Production Validation:"
echo "-------------------------------------------"
check_env_var "ENVIRONMENT" "production"
check_env_var "DEBUG"
check_env_var "ERROR_DETAIL_ENABLED" "false"
check_env_var "LOG_LEVEL" "INFO"
check_env_var "CORS_ORIGINS"
check_env_var "SECRET_KEY"
check_env_var "SUMUP_ENVIRONMENT"

echo ""
echo "=== Summary ==="
echo ""
echo "If ENVIRONMENT is not set to 'production', the production validation will NOT run!"
echo "This means security checks are bypassed."
echo ""
echo "To apply the required changes, run:"
echo "doctl apps update $APP_ID --spec-file digitalocean/app-spec-production-update.yaml"
echo ""