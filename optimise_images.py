"""
Recursively convert large PNGs to WebP and report savings.
"""
import os
from pathlib import Path
import pkg_resources

try:
    pkg_resources.get_distribution('pillow-simd')
    from PIL import Image
    PILLOW_LIB = 'pillow-simd'
except Exception:
    from PIL import Image
    PILLOW_LIB = 'pillow'

THRESHOLD = 300 * 1024  # 300 kB
QUALITY = 85


def convert_pngs(root: Path):
    summary = []
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            if not name.lower().endswith('.png'):
                continue
            path = Path(dirpath) / name
            if path.stat().st_size <= THRESHOLD:
                continue
            webp_path = path.with_suffix('.webp')
            try:
                with Image.open(path) as img:
                    img.save(webp_path, 'WEBP', quality=QUALITY)
                summary.append((path.relative_to(root), path.stat().st_size, webp_path.stat().st_size))
            except Exception as e:
                print(f"Failed to convert {path}: {e}")
    return summary


def print_summary(summary):
    if not summary:
        print('No images converted.')
        return
    header = f"{'File':<50}{'Original KB':>12}{'WebP KB':>10}{'Savings %':>12}"
    print(header)
    for file, orig, new in summary:
        savings = 100 * (1 - new / orig)
        print(f"{str(file):<50}{orig/1024:>12.1f}{new/1024:>10.1f}{savings:>12.1f}")


def main():
    root = Path(__file__).resolve().parent
    print(f'Using {PILLOW_LIB}')
    summary = convert_pngs(root)
    print_summary(summary)


if __name__ == '__main__':
    main()
