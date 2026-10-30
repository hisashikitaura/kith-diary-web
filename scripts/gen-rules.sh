#!/bin/sh
# Generate firestore.rules / storage.rules from the *.rules.template files.
# Owner email is read from $OWNER_EMAIL or NEXT_PUBLIC_OWNER_EMAIL in .env.local (never committed).
set -e
cd "$(dirname "$0")/.."
if [ -z "$OWNER_EMAIL" ] && [ -f .env.local ]; then
  OWNER_EMAIL=$(grep -E '^NEXT_PUBLIC_OWNER_EMAIL=' .env.local | head -1 | cut -d= -f2-)
fi
if [ -z "$OWNER_EMAIL" ]; then echo "OWNER_EMAIL is not set" >&2; exit 1; fi
for f in firestore storage; do
  sed "s/__OWNER_EMAIL__/$OWNER_EMAIL/" "$f.rules.template" > "$f.rules"
done
echo "generated firestore.rules and storage.rules"
