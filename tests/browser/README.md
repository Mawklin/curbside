# Browser walkthrough

Drives the real app in headless Chrome at iPhone size, asserting each step and saving screenshots
to `out/shots/`. Needs the `curbside` preview server running on port 5174.

    cd tests/browser
    npm i --no-save playwright-core@1
    node make-demo.mjs   # drawn item photos + a demo backup (uses sharp from the Lessons app)
    node e2e.mjs         # add, edit, photos, post kit, pending, sold, AI (mocked), restore, backup, wipe
    node offline.mjs     # service worker: app loads with the network off

e2e.mjs expects an empty app (a fresh browser profile, which headless Chrome gives it).
