# Host the design prototype on Vercel

This is a shareable, read-only design demo. A Git deployment contains only the
synthetic demonstration activity: Garmin captures, API keys, screenshot imports,
and personal records are excluded. The online version has no sign-in, durable
check-in storage, Garmin connection, or private activity history.

## Deploy from GitHub

1. Push the `codex/prototype-vercel` branch to GitHub.
2. In Vercel, choose **Add New → Project**, import `shubhams-git/My_Fitness_Analyser`,
   and select the `codex/prototype-vercel` branch.
3. Set **Root Directory** to `my-fitness-analyser`.
4. Select **Other** as the framework preset. Leave Build Command and Install
   Command empty; set **Output Directory** to `.`.
5. Do not add `API_KEY` or any Garmin credentials to Vercel. Click **Deploy**.

The root directory setting matters: it makes the Vercel project build from this
application folder while the rest of the repository stays outside the published
site. `/api/data` serves the synthetic sample through a serverless function;
the rewrites expose the prototype's static pages, styles, scripts, and local fonts.

## Update the hosted preview

After the first import, Vercel can automatically deploy later pushes to this
branch. Push prototype changes to `codex/prototype-vercel`; Vercel creates a
preview deployment and updates the branch deployment when configured as its
production branch.

## Local preview

Run `npm run prototype` in this folder and open <http://127.0.0.1:4173/>. The
local server can load private fixtures from ignored `private-data/`; the Vercel
deployment cannot and intentionally falls back to the synthetic demonstration.
