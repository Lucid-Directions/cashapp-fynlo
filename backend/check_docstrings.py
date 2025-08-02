with open('app/core/tenant_security.py', 'r') as f:
    lines = f.readlines()

# Find all docstring positions
docstring_positions = []
for i, line in enumerate(lines):
    if '"""' in line:
        count = line.count('"""')
        docstring_positions.extend([i+1] * count)

print(f"Found {len(docstring_positions)} triple quotes at lines: {docstring_positions}")

# Check pairing
if len(docstring_positions) % 2 != 0:
    print("\nODD number of triple quotes\!")
    # Find the unpaired one
    for i in range(0, len(docstring_positions)-1, 2):
        start = docstring_positions[i]
        end = docstring_positions[i+1]
        print(f"Docstring pair: {start} -> {end}")
    print(f"Unpaired quote at line: {docstring_positions[-1]}")
