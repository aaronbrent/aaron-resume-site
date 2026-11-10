# Deploying to Railway

A step-by-step guide to putting the site live on Railway. Steps 1–3 are one-time
setup. After that, deploying is a single command.

How it works: the site is fully static. Railway builds it with Railpack (`pnpm build`,
configured in `railway.toml`), then serves `build/client` with `pnpm start`
(`scripts/serve.mjs`) on the `$PORT` Railway provides. `scripts/deploy-railway.ts`
(`pnpm run deploy:railway`) automates everything after `railway login`.

---

## Part 1: One-time setup on your computer

### Step 1: Check Node.js (22.13 or newer)

```bash
node -v
```

You need `v22.13.0` or higher; the project uses pnpm 11, which needs it. If it's
older or missing, install the current LTS from nodejs.org (or with
`nvm install 22`), then reopen your terminal and check again.

### Step 2: Turn on pnpm

The repo pins its pnpm version (`packageManager` in `package.json`), and Corepack
picks it up automatically:

```bash
corepack enable
```

If `corepack` isn't found (some Node 25+ installs don't bundle it):

```bash
npm i -g corepack
```

### Step 3: Install the Railway CLI

On macOS with Homebrew:

```bash
brew install railway
```

Otherwise, with npm:

```bash
npm i -g @railway/cli
```

Confirm it installed:

```bash
railway --version
```

You should see something like `railway 5.x.x`.

**Windows:** the deploy script calls `railway` directly, which can't find npm's
`railway.cmd` shim. Use WSL, or install with Scoop (`scoop install railway`), or set
`RAILWAY_BIN` to the full path of `railway.exe` before running the script.

---

## Part 2: Railway account

### Step 4: Create an account and choose a plan

1. Go to railway.com and sign up. Signing in with GitHub is easiest.
2. Deploying needs an active plan or trial. Railway offers a trial, then the Hobby
   plan; check railway.com/pricing for current terms. A small static Node server
   like this uses very few resources.

### Step 5: Log the CLI in

```bash
railway login
```

A browser window opens; approve the login there. If you're on a machine without a
browser (for example over SSH):

```bash
railway login --browserless
```

Confirm it worked:

```bash
railway whoami
```

It should print your account name or email.

---

## Part 3: Get the code

### Step 6: Clone the repo, or update your copy

If you don't have it locally:

```bash
git clone https://github.com/aaronbrent/aaron-resume-site.git
```

```bash
cd aaron-resume-site
```

If you already have it, `cd` into it and fetch:

```bash
git fetch origin
```

### Step 7: Check out the branch you want to deploy

Railway deploys whatever is in your folder (Step 11), not what's on GitHub, so check
out the branch you want live (usually `main`) and pull:

```bash
git switch main
```

```bash
git pull
```

### Step 8: Install dependencies

```bash
pnpm install
```

The deploy script runs through the project's own tooling, so this has to be done
once.

### Step 9 (optional): Build it locally first

This catches problems before you wait on a remote build:

```bash
pnpm build
```

```bash
PORT=3000 pnpm start
```

Open http://localhost:3000, scroll through the planets, then press Ctrl+C to stop
the server.

---

## Part 4: Deploy

### Step 10: Preview the deploy (optional, harmless)

```bash
pnpm run deploy:railway --dry-run
```

This lists the Railway commands the script will run, without running any of them.

**Multiple Railway workspaces:** if your account has more than one (for example
personal plus a team), create and link the project yourself first. The script can't
answer Railway's "which workspace?" prompt:

```bash
railway init --name aaron-ellis --workspace "<your workspace name>"
```

The script will then see the project is already linked and skip creating it.

### Step 11: Deploy

Use `pnpm run deploy:railway`. Plain `pnpm deploy` is a different, built-in pnpm
command.

```bash
pnpm run deploy:railway
```

You'll see these stages in order:

1. **Checking the Railway CLI and login:** prints the CLI version.
2. **Linking project "aaron-ellis":** creates it on the first run; afterwards it says
   "already linked".
3. **Linking service "web":** creates the service the first time, then links your
   folder to it.
4. **Setting NODE_ENV=production.**
5. **Building and deploying (railway up):** uploads the folder and streams Railway's
   build log.
   - The upload skips anything in `.gitignore`, such as `node_modules/` and `build/`.
   - Railway installs dependencies, runs `pnpm build`, then starts the server with
     `pnpm start`.
   - Expect 2–5 minutes on the first run.
6. **Ensuring a public \*.up.railway.app domain:** creates your public address if
   there isn't one yet.

It finishes with:

```
✓ Live at https://web-production-xxxx.up.railway.app
```

**Copy that URL.**

To use different names, set `RAILWAY_PROJECT` and/or `RAILWAY_SERVICE` before
running the script.

---

## Part 5: Check the live site

### Step 12: Check it in a browser

At your URL, confirm:

- The page loads, the sun appears, and scrolling flies past all five planets.
- `/resume` shows the plain resume.
- `/aaron-ellis-resume.pdf` downloads the PDF.
- A made-up path such as `/nope` shows the "404 — Nothing in this orbit" page.

Also try it on your phone.

### Step 13 (optional): Run the automated smoke test against the live site

First, one-time, download the test browser:

```bash
pnpm exec playwright install chromium
```

Then run the smoke test with your URL:

```bash
pnpm qa:smoke https://web-production-xxxx.up.railway.app
```

It checks that the 3D scene renders, files arrive compressed, unknown paths return
404, `/resume` and the PDF load, and there are no console errors. On your machine's
real graphics card it also checks the frame rate stays above 30 fps. It should end
with `✓ smoke test passed`.

---

## Part 6: Point the site at its real address

Until this is done, the page metadata, social share image, sitemap and robots file
still say `aaronellis.dev`.

### Step 14: Update the address

Edit these files:

- `app/content/meta.ts`: change `url: "https://aaronellis.dev"` to your Railway URL.
- `public/sitemap.xml`: change both `<loc>` entries.
- `public/robots.txt`: change the `Sitemap:` line.

Then commit, push and redeploy:

```bash
git commit -am "Point site URL at Railway"
```

```bash
git push
```

```bash
pnpm run deploy:railway
```

---

## Everyday use

**Redeploy after any change.** Commit if you like, then:

```bash
pnpm run deploy:railway
```

Railway deploys your local folder as it is, including uncommitted edits, so make sure
you're on the right branch.

**View logs:**

```bash
railway logs
```

**Open the Railway dashboard:**

```bash
railway open
```

**Roll back:** in the dashboard, open the service, go to **Deployments**, find an
earlier successful deploy and choose **Redeploy**.

**Auto-deploy on every push (optional):** in the dashboard, open the `web` service, go
to **Settings → Source**, connect `aaronbrent/aaron-resume-site` and pick the branch,
usually `main`. After that, pushes deploy without the CLI.

**Custom domain (later):**

```bash
railway domain yourdomain.com --service web
```

It prints a DNS record (usually a CNAME). Add it at your domain registrar. Railway
issues the HTTPS certificate automatically once DNS resolves, which can take minutes
to a few hours. Then repeat Step 14 with the new domain.

---

## If something goes wrong

| Symptom                                                            | Fix                                                                                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Not logged in. Run railway login`                                 | Run `railway login`, then rerun the deploy.                                                                                                                                 |
| `The Railway CLI isn't installed`                                  | Step 3. On Windows, see the note there about `RAILWAY_BIN`.                                                                                                                 |
| The script stops at creating the project or asks about a workspace | Run the `railway init --workspace …` command from Step 10 yourself, then rerun.                                                                                             |
| Build log shows `react-router: not found` or missing packages      | Development packages weren't installed during the build. In the dashboard, open the `web` service, go to **Variables** and delete `NODE_ENV`, then redeploy.                |
| Build log shows a Node version below 22.13                         | In **Variables**, add `RAILPACK_NODE_VERSION` = `22`, then redeploy.                                                                                                        |
| Deploy succeeds but the health check fails, or the site won't open | Run `railway logs`. You should see `Serving build/client on :<port>`. If it's missing, the start command failed, and the log says why.                                      |
| Finished with "no \*.up.railway.app domain was reported"           | Run `railway domain --service web` and it prints the URL. Or check the dashboard under **Settings → Networking**.                                                           |
| Site loads but shows no 3D, just the poster                        | That's the built-in fallback for that device or browser: reduced motion is on, WebGL isn't available, or the browser uses software graphics. Try another browser or device. |
