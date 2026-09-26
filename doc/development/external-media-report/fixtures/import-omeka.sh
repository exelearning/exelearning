#!/bin/sh
# Import evil.elpx into Omeka S as a NEW item, through the module's own ingestion path.
#
# Uses the media API with the `upload` ingester, which is what the admin UI uses, so the
# module's extraction and content-token minting run exactly as they would for a real
# upload. Writing rows or unzipping files by hand would produce an item that looks right
# and proves nothing about the plugin.
#
# Usage: ./import-omeka.sh /path/to/evil.elpx [OMEKA_URL]
set -e

PACKAGE="${1:?usage: import-omeka.sh <package.elpx> [omeka-url]}"
OMEKA_URL="${2:-http://localhost:8080}"
SITE_SLUG="${SITE_SLUG:-exelearning-demo}"

[ -f "$PACKAGE" ] || { echo "no such package: $PACKAGE" >&2; exit 1; }

# A throwaway key per run: Omeka has no other scriptable auth, and reusing a stale one
# fails as a 403 that looks exactly like a broken payload.
OUT=$(docker compose exec -T -w /var/www/html/volume omekas omeka-s-cli \
        user:create-api-key admin@example.com "import-$(date +%s)" 2>&1)
ID=$(echo "$OUT"   | grep '|' | grep -v '^+' | tail -1 | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$2); print $2}')
CRED=$(echo "$OUT" | grep '|' | grep -v '^+' | tail -1 | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$3); print $3}')
[ -n "$ID" ] && [ -n "$CRED" ] || { echo "could not create an API key" >&2; exit 1; }
AUTH="key_identity=${ID}&key_credential=${CRED}"

ITEM=$(curl -s -X POST "${OMEKA_URL}/api/items?${AUTH}" -H 'Content-Type: application/json' -d '{
  "dcterms:title":[{"type":"literal","property_id":1,"@value":"evil.elpx (adversarial probe)"}],
  "dcterms:description":[{"type":"literal","property_id":4,"@value":"Untrusted-content probe from the LMS security paper."}],
  "o:is_public": true}' | python3 -c "import sys,json; print(json.load(sys.stdin)['o:id'])")

curl -s -X POST "${OMEKA_URL}/api/media?${AUTH}" \
  -F "data={\"o:ingester\":\"upload\",\"file_index\":0,\"o:item\":{\"o:id\":${ITEM}},\"dcterms:title\":[{\"type\":\"literal\",\"property_id\":1,\"@value\":\"evil.elpx\"}]}" \
  -F "file[0]=@${PACKAGE};type=application/zip" \
  | python3 -c "import sys,json; print('media', json.load(sys.stdin).get('o:id'))"

# Without a site the item exists but has no public page for the walk to visit.
SITE=$(curl -s "${OMEKA_URL}/api/sites?${AUTH}" \
  | python3 -c "import sys,json; print([s['o:id'] for s in json.load(sys.stdin) if s['o:slug']=='${SITE_SLUG}'][0])")
curl -s -X PATCH "${OMEKA_URL}/api/items/${ITEM}?${AUTH}" -H 'Content-Type: application/json' \
  -d "{\"o:site\":[{\"o:id\":${SITE}}]}" -o /dev/null

echo "item ${ITEM} -> ${OMEKA_URL}/s/${SITE_SLUG}/item/${ITEM}"
echo "Put that URL in pages.spec.ts and shots.spec.ts."
