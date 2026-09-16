# Push Peytakilid to GitHub (independent repo)

This workspace has **no GitHub credentials**, so push must be done from a machine where you are logged in.

## Option A — from the git bundle (recommended)

```bash
# on your computer
git clone peytakilid.bundle peytakilid
cd peytakilid
gh auth login
gh repo create peytakilid --private --source=. --remote=origin --push
```

Or with a custom name:

```bash
gh repo create "پی-تا-کلید" --private --source=. --remote=origin --push
```

## Option B — from source tarball

```bash
tar -xzf peytakilid-source.tar.gz -C peytakilid-src
cd peytakilid-src
git init -b main
git add -A
git commit -m "Peytakilid independent marketplace"
gh repo create peytakilid --private --source=. --remote=origin --push
```

## Files in this environment

| File | Purpose |
|---|---|
| `peytakilid.bundle` / `پی-تا-کلید.bundle` | Full git history (cloneable) |
| `peytakilid-source.tar.gz` / `پی-تا-کلید-source.tar.gz` | Source tree without node_modules |

This project is **Peytakilid-only** — no Stoncity remotes, submodules, or path imports.
