#!/usr/bin/env bash
# Release a new version of the landing site (apps/web).
#   scripts/release-web.sh 1.1.0 "What changed in one or two sentences."
# Bumps version.json/version.js, prepends CHANGELOG.md, regenerates changelog.html,
# commits, and tags web-v<version>. Pushing is left to you (protected branch):
#   git push origin master --tags      -> Vercel deploys production from master.
set -euo pipefail
VER="${1:-}"; NOTES="${2:-}"
[[ "$VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "usage: $0 <major.minor.patch> \"<notes>\""; exit 1; }
[ -n "$NOTES" ] || { echo "notes are required"; exit 1; }
ROOT="$(git rev-parse --show-toplevel)"; W="$ROOT/apps/web"; DATE="$(date +%F)"
[ -z "$(git -C "$ROOT" status --short -- apps/web)" ] || { echo "apps/web has uncommitted changes; commit them first"; exit 1; }
git -C "$ROOT" rev-parse -q --verify "refs/tags/web-v$VER" >/dev/null && { echo "tag web-v$VER exists"; exit 1; }

VER="$VER" NOTES="$NOTES" DATE="$DATE" W="$W" python3 - <<'PY'
import json,os,re
W=os.environ['W']; ver=os.environ['VER']; notes=os.environ['NOTES']; date=os.environ['DATE']
data={"version":ver,"date":date,"notes":notes}
json.dump(data,open(f'{W}/version.json','w'),indent=2)
js=open(f'{W}/version.js').read()
js=re.sub(r'window\.PAYO_VERSION = \{.*?\};', 'window.PAYO_VERSION = '+json.dumps(data)+';', js, count=1, flags=re.S)
open(f'{W}/version.js','w').write(js)
md=open(f'{W}/CHANGELOG.md').read()
head,sep,rest=md.partition('\n## ')
md=head+f'\n## {ver} ({date})\n{notes}\n'+(sep+rest if sep else '')
open(f'{W}/CHANGELOG.md','w').write(md)
items=re.findall(r'^## (\S+) \((\d{4}-\d{2}-\d{2})\)\n(.*?)(?=^## |\Z)', md, re.S|re.M)
lis=''.join(f'<li><span class="v">v{v}</span><time datetime="{d}">{d}</time><p>{n.strip()}</p></li>' for v,d,n in items)
html=open(f'{W}/changelog.html').read()
html=re.sub(r'<ul>.*?</ul>', '<ul>'+lis+'</ul>', html, count=1, flags=re.S)
open(f'{W}/changelog.html','w').write(html)
idx=open(f'{W}/index.html').read()
idx=re.sub(r'(data-version>)v[0-9.]+(<)', r'\g<1>v'+ver+r'\2', idx, count=1)
open(f'{W}/index.html','w').write(idx)
PY

git -C "$ROOT" add apps/web/version.json apps/web/version.js apps/web/CHANGELOG.md apps/web/changelog.html apps/web/index.html
git -C "$ROOT" commit -q -m "web: release v$VER" -m "$NOTES"
git -C "$ROOT" tag -a "web-v$VER" -m "PAYO website v$VER: $NOTES"
echo "committed and tagged web-v$VER. Now run:"
echo "  git push origin master --tags"
echo "Vercel deploys production from master; previous deployments stay available for rollback (Vercel dashboard > Deployments > Promote, or: npx vercel rollback)."
