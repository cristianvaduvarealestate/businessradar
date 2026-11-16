#!/bin/bash
set -e

for file in migrations/chunks/chunk_*.sql; do
    # Skip chunk_000 as it was already executed
    if [ "$file" = "migrations/chunks/chunk_000.sql" ]; then
        continue
    fi
    echo "=== Executing $file ==="
    npx wrangler d1 execute businessradar-db --file="$file" --remote --yes
done

echo "=== All chunks executed successfully ==="
