#!/usr/bin/env python3
from pathlib import Path
import sys

IGNORE = {'.DS_Store'}

def files(root: Path):
    result = set()
    for p in root.rglob('*'):
        if p.is_file() and p.name not in IGNORE:
            result.add(p.relative_to(root).as_posix())
    return result

def main():
    if len(sys.argv) != 3:
        print('Usage: python merge_collision_check.py <DEV1_DELTA_DIR> <DEV2_DELTA_DIR>')
        raise SystemExit(2)
    a, b = map(Path, sys.argv[1:3])
    if not a.is_dir() or not b.is_dir():
        print('ERROR: both arguments must be directories')
        raise SystemExit(2)
    overlap = sorted(files(a) & files(b))
    if overlap:
        print(f'STOP: {len(overlap)} relative-path collision(s)')
        for x in overlap:
            print(' -', x)
        raise SystemExit(1)
    print('PASS: no relative-path collisions')

if __name__ == '__main__':
    main()
