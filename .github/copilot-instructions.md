# Repository workflow

- For every task that changes tracked project files, validate the change, commit only the files changed for that task, and immediately push the commit to `origin` on the current branch.
- Before editing, inspect the working tree. Preserve pre-existing changes and do not stage or commit unrelated user work.
- Do not commit credentials, tokens, or other secrets.
- Do not create empty commits. Do not force-push. If validation or pushing is blocked, explain the issue clearly and do not claim the change is live remotely.