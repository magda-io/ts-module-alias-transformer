# How to Release a New Version

This guide covers how to release a new version of `ts-module-alias-transformer`. A release publishes the package to [npmjs.org](https://www.npmjs.com/package/ts-module-alias-transformer). The same four-step process applies whether you are publishing a pre-release build for testing (e.g. to verify integration in a downstream project such as [magda](https://github.com/magda-io/magda)) or an official production release — the difference is which branch you release from and which version string you use.

Publishing uses [npm **trusted publishing** (OIDC)](https://docs.npmjs.com/trusted-publishers): there is no long-lived `NPM_TOKEN` secret. The [`publish.yml`](../.github/workflows/publish.yml) workflow exchanges a short-lived, workflow-scoped token at publish time and attaches build [provenance](https://docs.npmjs.com/generating-provenance-statements).

## Version Format

This package follows [Semantic Versioning](https://semver.org/). A version string is structured as follows:

```
v3.0.0-alpha.2
│ │ │ │
│ │ │ └─ pre-release version: alpha.2
│ │ │    ├─ identifier: alpha
│ │ │    └─ identifier: 2
│ │ └─ patch: 0
│ └─ minor: 0
└─ major: 3
```

Always enter the version string **with a leading `v`** (e.g. `v3.0.0`, `v3.0.0-alpha.2`). The workflows strip the `v` before writing it to `package.json` (npm versions have no `v` prefix) and re-add it for the git tag.

### Pre-release Identifiers

The first identifier in the pre-release version indicates the release type:

| Identifier | Meaning                         | Example           |
| ---------- | ------------------------------- | ----------------- |
| `alpha`    | Planned early / integration test | `v3.0.0-alpha.0`  |
| `beta`     | Broader testing release         | `v3.0.0-beta.0`   |
| `rc`       | Release candidate               | `v3.0.0-rc.0`     |
| `pr`       | Temporary PR / testing build    | `v3.0.0-pr.16.0`  |

## Release Types

Not every release is a production release. A **pre-release** publishes to npm under a version that npm will not treat as `latest`, so `npm install ts-module-alias-transformer` still resolves to the last stable version — you must opt in with `@<version>` or a matching range to consume it.

| Release Type          | Version Pattern                                          | Example          | Release From        |
| --------------------- | -------------------------------------------------------- | ---------------- | ------------------- |
| PR / testing build    | `v<MAJOR>.<MINOR>.<PATCH>-pr.<PR_NUMBER>.<BUILD_NUMBER>`  | `v3.0.0-pr.16.0` | PR / feature branch |
| Alpha release         | `v<MAJOR>.<MINOR>.<PATCH>-alpha.<N>`                     | `v3.0.0-alpha.0` | any branch          |
| Beta release          | `v<MAJOR>.<MINOR>.<PATCH>-beta.<N>`                      | `v3.0.0-beta.0`  | `main`              |
| Release candidate     | `v<MAJOR>.<MINOR>.<PATCH>-rc.<N>`                        | `v3.0.0-rc.0`    | `main`              |
| Official / production | `v<MAJOR>.<MINOR>.<PATCH>`                               | `v3.0.0`         | `main`              |

Official production releases should **only** be released from the `main` branch. Before starting one, ensure:

- All changes intended for the release have been merged into `main`
- The CI checks ([`main.yml`](../.github/workflows/main.yml): build, test, eslint) are passing on `main`
- `CHANGES.md` has been updated with the changes included in this release

## Release Process

Regardless of release type, the process is the same four steps: create a release branch, set the version, create a GitHub Release, and monitor the pipeline.

### Step 1: Create a Release Branch

Always create a dedicated release branch before setting the version. The set-version workflow commits the version change directly to the branch it runs on, and you don't want that commit landing on your source branch (e.g. your PR branch or `main`).

Create a branch named `release/v<VERSION>` from the appropriate source branch:

| Release Type       | Create from         | Example branch name       |
| ------------------ | ------------------- | ------------------------- |
| PR / testing build | PR / feature branch | `release/v3.0.0-pr.16.0`  |
| Alpha release      | source branch       | `release/v3.0.0-alpha.0`  |
| Beta / RC release  | `main`              | `release/v3.0.0-rc.0`     |
| Production release | `main`              | `release/v3.0.0`          |

```bash
git checkout <source-branch>
git pull
git checkout -b release/v3.0.0
git push -u origin release/v3.0.0
```

### Step 2: Set the Version Number

Use the **set-version** GitHub Actions workflow to update `package.json`.

1. Go to the repository on GitHub
2. Navigate to **Actions** > **Set version** workflow
3. Click **Run workflow**
4. Select the **release branch** you created in Step 1 (e.g. `release/v3.0.0`)
5. Enter the **version string** with a leading `v` (e.g. `v3.0.0` or `v3.0.0-alpha.2`)
6. Click **Run workflow**

The workflow will:

- Validate the version is a valid semver string (rejects anything that is not)
- Set the `version` field in `package.json` (via `npm version`, preserving formatting)
- Commit and push the change to the release branch

Wait for this workflow to complete before proceeding.

### Step 3: Create a GitHub Release

Once the version has been set and CI on the release branch is green, create the release.

1. Go to **Releases** > **Draft a new release**
2. Configure the release:
   - **Choose a tag:** Enter the version string (e.g. `v3.0.0`) — this creates a new tag
   - **Target:** Select the **release branch** (e.g. `release/v3.0.0`)
   - **Release title:** Use the version string
   - **Description:** Describe what's in this release. For production releases, copy the relevant section from `CHANGES.md`
   - **Set as a pre-release** / **Set as the latest release:** see the table below
3. Click **Publish release**

> **Important:** The tag must exactly match the version set in Step 2. The publish workflow validates that the tag matches `package.json` — a mismatch fails the release before anything is published.

#### Pre-release and Latest Release Settings

Unless you are releasing an official production version, always select `Set as a pre-release` and never select `Set as the latest release`:

| Version          | Purpose                     | Pre-release? | Latest release? |
| ---------------- | --------------------------- | :----------: | :-------------: |
| `v3.0.0-pr.16.0` | PR / testing build          |    ✅ Yes    |      ❌ No      |
| `v3.0.0-alpha.0` | Alpha release               |    ✅ Yes    |      ❌ No      |
| `v3.0.0-beta.0`  | Beta release                |    ✅ Yes    |      ❌ No      |
| `v3.0.0-rc.0`    | Release candidate           |    ✅ Yes    |      ❌ No      |
| `v3.0.0`         | Official production release |    ❌ No     |     ✅ Yes      |

**Why this matters:** GitHub's **latest release** label indicates the release users should generally consume, and downstream automation/badges may key off it. Marking a pre-release as "latest" can cause consumers to accidentally pick up a testing build.

### Step 4: Monitor the Publish Workflow

Publishing the release triggers the [`publish.yml`](../.github/workflows/publish.yml) workflow (**Actions** > **Publish to npm**). It:

1. Installs dependencies (`yarn install --frozen-lockfile`)
2. **Validates** the release tag is valid semver **and** matches the `package.json` version
3. Builds, tests, and lints
4. Publishes to npm via OIDC trusted publishing (`npm publish --provenance`)

The run fails before publishing if the version check does not pass.

### Step 5: Verify the Release

- **npm:** Confirm the new version at [npmjs.com/package/ts-module-alias-transformer](https://www.npmjs.com/package/ts-module-alias-transformer), e.g. `npm view ts-module-alias-transformer@<VERSION>`
- **GitHub Release:** Confirm the release page shows the correct tag and description
- **Provenance:** The npm package page shows a provenance/"Built and signed on GitHub Actions" badge for the version

## Troubleshooting

### Version mismatch error

If the publish workflow fails at the version-check step, the git tag does not match the `version` in `package.json`. Make sure you ran the **Set version** workflow on the correct branch before creating the release tag. To fix: delete the tag and release on GitHub, re-run **Set version** if needed, then create the release again.

### Cannot republish the same version

npm does not allow republishing a version that already exists. If you need to re-release with fixes, bump to a new version (e.g. `v3.0.1` instead of `v3.0.0`, or `v3.0.0-alpha.1` instead of `v3.0.0-alpha.0`).

### OIDC / trusted publishing failures

- The publish job needs `permissions: id-token: write` (already set in `publish.yml`).
- Trusted publishing requires npm ≥ 11.5.1; the workflow upgrades npm before publishing.
- The trusted publisher configured on npm must match this repo (`magda-io/ts-module-alias-transformer`) and the workflow filename (`publish.yml`). If either changes, update the trusted-publisher settings on the npm package page.
- Provenance requires `package.json` `repository.url` to point at this repo; a mismatch fails the publish.

## Release Artifact Summary

| Artifact    | Registry                                             | Example                          |
| ----------- | ---------------------------------------------------- | -------------------------------- |
| npm package | [npmjs.org](https://www.npmjs.com/package/ts-module-alias-transformer) | `ts-module-alias-transformer@3.0.0` |
