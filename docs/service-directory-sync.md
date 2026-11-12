# Service directory: maintained in HubEasy, published here

Oakdene's community service directory is maintained in **HubEasy** (Directory → Services and Organisations), the
single source since 7 November 2026. The website keeps reading `src/content/oakdene-service-directory.json`
exactly as before; a scheduled job keeps that file in step with HubEasy. The staff intranet's Service Directory
page embeds this site's directory, so it follows too.

## How it flows

1. A staff member adds or edits a service in HubEasy. To appear on the website a service needs **Show on the
   public website directory** ticked, plus a **Website group**, **Category**, **Service type** and **Coverage**
   (Edit → Public website).
2. Every 30 minutes `.github/workflows/sync-service-directory.yml` runs `scripts/sync-service-directory.mjs`. It
   reads HubEasy's public feed (`https://oakdene.hubeasy.com.au/api/public-directory.php`), rebuilds the
   `services` array, refreshes the counts in `categoryGroups`, `coverageTiers` and `lgaTiers`, and commits the
   file only if it changed.
3. The push rebuilds the site as usual. An edit in HubEasy is live within about 30 to 35 minutes.

`meta`, `otherDirectories` and the group/tier descriptions stay in this file and are edited here as before.

## What the feed is

A read-only JSON document with no sign-in: each organisation (name, ABN, ACNC details, official accounts) with
its published services nested under it. Only services marked for the website are in it, and only public fields.
A service's own social accounts are used where it has them; otherwise its organisation's. The ABN and ACNC link
are the organisation's.

## Safety

- Nothing to configure: no secrets, no app registration. The feed is public by design and read-only.
- It refuses to publish fewer than 50 services, so a fault at HubEasy can't empty the directory.
- A service marked for the website but missing its group, category, type or coverage is left out and named in
  the run's warnings, rather than breaking the page.
- Unchanged services keep their exact JSON, so each commit diff shows only real edits.

## Testing locally

```
node scripts/sync-service-directory.mjs --check                 # would the file change?
node scripts/sync-service-directory.mjs --from saved-feed.json  # use a saved feed document
```

The workflow pushes to `main` with the built-in `GITHUB_TOKEN`; if `main` gets branch protection, allow GitHub
Actions to push or switch the job to open a pull request instead.
