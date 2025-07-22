# DigitalOcean Deployment Fix

## Quick Fix - Update Your Run Command

Replace your current run command in DigitalOcean with:

```bash
PYTHONPATH=/workspace python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8080} --log-level info
```

Or use our startup script:

```bash
python start_server.py
```

## Alternative Fixes

### Option 1: Update DigitalOcean App Spec
Use the `.do/app.yaml` file we created to sync your deployment configuration.

### Option 2: Use Environment Variable
Add this environment variable in DigitalOcean:
- Key: `PYTHONPATH`
- Value: `/workspace`

Then keep your existing run command.

### Option 3: Use Procfile
Remove your custom run command and let DigitalOcean use the Procfile:
- The Procfile will handle the module path setup automatically

## Root Cause
The issue is that when uvicorn runs from the repository root, Python can't find the 'backend' module. We need to add the root directory to Python's module search path.

## Verification
After deployment, check the logs for:
- No "ModuleNotFoundError: No module named 'backend'"
- Successful startup message: "Uvicorn running on http://0.0.0.0:8080"