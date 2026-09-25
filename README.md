# Tile Match (web)

Browser version of the game. No build step: plain HTML, CSS and JavaScript modules.

- Test locally: `python3 tools/devserver.py` then open http://localhost:8080 (`?fps` shows a frame-rate meter).
- Photos: put originals in `../Our Photos`, run `node tools/photos.mjs`, then commit and push.
  Photos are stored encrypted; the key lives in `../.photo-key` (never committed) and in the private link.
- Riders: the shop animals are drawn once in `js/animals.js`. The shop shows them as live SVG with GSAP tricks (`js/shoprider.js`); the game plays watercolour frames painted from the same drawing, `riders/<id>.webp`. After changing a drawing, repaint them with `node bake.mjs` in `../art-lab` (run `npm install` there first).
