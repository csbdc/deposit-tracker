# House Deposit Tracker

A cheerful house-deposit savings tracker with app-owned persistence. The app is
served by a dependency-free Node.js server and stores its values in a Docker
volume.

## Run locally with Docker

```bash
docker compose up --build -d
```

Open <http://localhost:8080>.

Stop the app without deleting its saved values:

```bash
docker compose down
```

To also delete the saved values:

```bash
docker compose down -v
```

## Container image

The GitHub Actions workflow builds the image for `linux/amd64` and
`linux/arm64`.

- Pull requests build the image without publishing it.
- Pushes to `main` publish `main`, `latest`, and commit-SHA tags.
- Tags beginning with `v` publish a matching version tag.
- The image is published to `ghcr.io/<owner>/<repository>`.

After the repository is pushed to GitHub, pull the image with:

```bash
docker pull ghcr.io/<owner>/<repository>:latest
```

The workflow authenticates with GitHub's automatically provided
`GITHUB_TOKEN`; no custom registry secret is required.
