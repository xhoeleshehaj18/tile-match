# Tile Match (web)

Browser version of the game. No build step: plain HTML, CSS and JavaScript modules.

- Test locally: `python3 tools/devserver.py` then open http://localhost:8080 (`?fps` shows a frame-rate meter).
- Photos: put originals in `../Our Photos`, run `node tools/photos.mjs`, then commit and push.
  Photos are stored encrypted; the key lives in `../.photo-key` (never committed) and in the private link.
