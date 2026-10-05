#!/usr/bin/env python3
"""Verify pinned bytes and reconstruct the manifest's Git tree. No writes/network."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath

def git_object(kind: str, data: bytes) -> bytes:
    return hashlib.sha1(kind.encode() + b' ' + str(len(data)).encode() + b'\0' + data).digest()

def tree_hash(tree: dict) -> bytes:
    entries = []
    for name, value in tree.items():
        directory = isinstance(value, dict)
        mode, digest = ('40000', tree_hash(value)) if directory else value
        entries.append((name.encode() + (b'/' if directory else b''),
                        mode.encode() + b' ' + name.encode() + b'\0' + digest))
    return git_object('tree', b''.join(data for _, data in sorted(entries)))

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('checkout', type=Path)
    parser.add_argument('--manifest', type=Path,
                        default=Path(__file__).resolve().parent.parent / 'evidence/source-identity.json')
    args = parser.parse_args()
    root = args.checkout.resolve(strict=True)
    record = json.loads(args.manifest.read_text(encoding='utf-8'))
    tree: dict = {}
    seen: set[str] = set()
    for item in record['files']:
        name = item['path']; parts = PurePosixPath(name).parts
        if name in seen or not parts or '..' in parts or PurePosixPath(name).is_absolute():
            raise ValueError(f'Unsafe/duplicate manifest path: {name}')
        seen.add(name)
        file = (root / name).resolve(strict=True)
        if root not in file.parents:
            raise ValueError(f'Path escaped checkout: {name}')
        data = file.read_bytes(); blob = git_object('blob', data)
        if (len(data) != item['bytes'] or hashlib.sha256(data).hexdigest() != item['sha256']
                or blob.hex() != item['git_blob_sha1']):
            raise ValueError(f'Pinned content mismatch: {name}')
        branch = tree
        for part in parts[:-1]:
            branch = branch.setdefault(part, {})
        branch[parts[-1]] = (item['mode'], blob)
    computed = tree_hash(tree).hex()
    if computed != record['expected_git_tree'] or len(seen) != record['file_count']:
        raise ValueError('Tree/count mismatch')
    print(json.dumps({'verified_files': len(seen), 'reconstructed_git_tree': computed,
                      'byte_match': True, 'mode_source': 'pinned manifest',
                      'extra_worktree_files_censused': False}, indent=2))

if __name__ == '__main__':
    main()
