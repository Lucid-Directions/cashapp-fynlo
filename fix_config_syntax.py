#!/usr/bin/env python3
"""Fix config.py syntax errors"""

import re

# Read the backup file
with open('./app/api/v1/endpoints/config.py.backup', 'r') as f:
    content = f.read()

# Find the problematic section and fix it
lines = content.split('\n')
new_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Skip lines that are part of the broken section
    if 'monitoring_service = get_monitoring_service(db)' in line and 'metrics =' in lines[i+1] if i+1 < len(lines) else False:
        # This is the orphaned code, wrap it in proper function
        new_lines.extend([
            '',
            '@router.get("/monitoring/metrics")',
            'async def get_system_metrics(',
            '    hours: int = Query(24, description="Number of hours to look back"),',
            '    db: Session = Depends(get_db),',
            '    current_user: User = Depends(get_current_user)',
            '):',
            '    """Get system metrics for the specified time period"""',
            '    try:',
            '        monitoring_service = get_monitoring_service(db)',
            '        metrics = await monitoring_service.get_system_metrics(hours)',
            '',
            '        return APIResponseHelper.success(',
            '            data=metrics,',
            f'            message=f"System metrics for last {{hours}} hours retrieved successfully",',
            '        )',
            '',
            '    except FynloException:',
            '        raise',
            '    except Exception as e:',
            '        raise FynloException(message=str(e))'
        ])
        
        # Skip the broken lines
        while i < len(lines) and not lines[i].strip().startswith('@router.'):
            if 'except Exception as e:' in lines[i]:
                i += 2  # Skip the except and raise lines too
                break
            i += 1
        continue
    
    new_lines.append(line)
    i += 1

# Write the fixed content
with open('./app/api/v1/endpoints/config.py', 'w') as f:
    f.write('\n'.join(new_lines))

print("Fixed config.py syntax errors")