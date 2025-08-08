#\!/bin/bash
echo "Terminating old instance..."
xcrun simctl terminate "iPhone 16 Pro" com.fynlo.cashappposlucid 2>/dev/null
sleep 1

echo "Launching app..."
xcrun simctl launch "iPhone 16 Pro" com.fynlo.cashappposlucid &
PID=$\!

echo "Waiting for app to start..."
sleep 3

echo "Checking logs for errors..."
xcrun simctl spawn "iPhone 16 Pro" log show --predicate 'process == "CashAppPOS"' --last 5s --style json 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        log = json.loads(line)
        msg = log.get('eventMessage', '')
        if 'ReferenceError' in msg or 'theme' in msg or 'error' in msg.lower():
            print(f\"{log.get('timestamp', '')}: {msg}\")
    except:
        pass
"

echo "Done"
