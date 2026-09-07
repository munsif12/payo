# Releasing the website

The site is static (no build). Production is whatever is on `master` under `apps/web`; Vercel deploys it on every push (project `web`, Root Directory `apps/web`). Any other branch gets a preview URL automatically.

## Cut a release
1. Land your changes on `master` (commit them normally).
2. From the repo root:
   `scripts/release-web.sh 1.1.0 "One or two sentences on what changed."`
   This bumps `version.json` and `version.js`, prepends `CHANGELOG.md`, regenerates `changelog.html`, updates the footer stamp, commits, and tags `web-v1.1.0`.
3. Push: `git push origin master --tags`. Vercel builds production from the push.
4. Check `https://web-flax-beta-22.vercel.app/version` shows the new number, and `/changelog` lists it.

## Roll back
Vercel keeps every deployment. Dashboard: Deployments, pick the previous one, Promote to Production. CLI: `npx vercel rollback` from the repo root. Or `git revert` the release commit and push.

## Rules
- Semantic versions: patch for copy and asset fixes, minor for new sections, major for a redesign.
- Never edit `version.js` or `changelog.html` by hand; the script generates them.
- `/version` is served with `no-cache`, so it is safe to poll from anywhere.
