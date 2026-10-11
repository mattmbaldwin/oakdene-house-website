# Content editor: one-off setup

The editor is built and tested. It can't sign anyone in until these steps are done. There are three parts: Simon's, Matt's, and each staff editor's. Allow about 30 minutes in total.

docs/ is never published, so this file stays private to the repository.

## How it fits together

- The full editor is at oakdenehouse.org.au/admin/ and the staff editor is at oakdenehouse.org.au/admin/staff/.
- People sign in with a free GitHub account.
- A change is saved as a draft. It goes live only when Simon (or another full editor) marks it Ready and publishes it. Cloudflare then rebuilds the site, which takes a few minutes.
- On the live site, published changes are saved straight to Matt's repository (mattmbaldwin/oakdene-house-website). On the test copy (oakdene-house-website-exk.pages.dev) they go to Simon's fork instead, so you can practise there without touching the live site.

## Part 1: Simon

### 1. Create the GitHub sign-in app for the live site

1. In GitHub, go to Settings, then Developer settings, then OAuth Apps, then New OAuth App.
2. Fill in:
   - Application name: Oakdene content editor
   - Homepage URL: https://oakdenehouse.org.au
   - Authorization callback URL: https://oakdenehouse.org.au/api/callback
3. Select Register application.
4. Copy the Client ID.
5. Select Generate a new client secret and copy the secret straight away, because GitHub only shows it once.
6. Send both to Matt through a password manager share, not in plain email or in GitHub.

### 2. Create a second app for the test copy

Repeat step 1 with these values:

- Application name: Oakdene content editor (test copy)
- Homepage URL: https://oakdene-house-website-exk.pages.dev
- Authorization callback URL: https://oakdene-house-website-exk.pages.dev/api/callback

Each app only works for its own address, which is why there are two.

### 3. Add the test app to your Cloudflare project

1. In Cloudflare, open Workers & Pages, then oakdene-house-website-exk, then Settings, then Variables and secrets.
2. Under Production, add:
   - GITHUB_CLIENT_ID as Text, with the test app's Client ID
   - GITHUB_CLIENT_SECRET as Secret, with the test app's client secret
3. Redeploy the latest production deployment so the settings take effect.

### 4. Let staff practise on the test copy (optional)

The test copy saves to your fork. Add each staff editor as a collaborator on Simon-HubEasy/oakdene-house-website: Settings, then Collaborators, then Add people. Remove them later if you like.

## Part 2: Matt

1. Cloudflare: in the Pages project oakdene-house-website, open Settings, then Variables and secrets. Under Production, add:
   - GITHUB_CLIENT_ID as Text, with the Client ID Simon sends
   - GITHUB_CLIENT_SECRET as Secret, with the client secret Simon sends

   Then redeploy the latest production deployment.
2. GitHub: in mattmbaldwin/oakdene-house-website, open Settings, then Collaborators, then Add people. Add Simon and each staff editor by their GitHub username. Each person gets an email invitation to accept.

That's all Matt needs to do. After this, Simon publishes content changes himself and they go live without a pull request.

## Part 3: each staff editor

1. Create a free GitHub account at github.com with your work email.
2. Send your GitHub username to Simon.
3. Accept the collaborator invitation email from GitHub.
4. Go to oakdenehouse.org.au/admin/staff/ and select Login with GitHub.

## Check it works

1. Simon goes to oakdene-house-website-exk.pages.dev/admin/ and signs in.
2. Change something small, such as one word in a FAQ answer, then save it.
3. Set the status to Ready, then Publish now.
4. Within a few minutes the change shows on the test copy.
5. Change it back the same way.
6. Repeat on the live site once Matt has finished Part 2.

## Things to know

- Content published on the live site goes straight into Matt's repository. Before starting any code work, tap Sync fork on Simon's GitHub repository so the fork has the latest content. Otherwise the next pull request to Matt can conflict.
- New photos added through the editor work straight away. Phones get a smaller copy once someone runs npm run images and commits the result. That's worth doing every few months.
- The staff screen hides the Publish button. That keeps staff changes as drafts, but it isn't a lock: anyone who is a collaborator could publish from /admin/. Only add people you trust to publish.
- If sign-in shows "Sign-in is not set up yet", the two Cloudflare settings are missing or the site hasn't been redeployed since they were added.
