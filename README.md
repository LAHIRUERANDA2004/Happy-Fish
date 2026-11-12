# Happy Fish — multi-page project

This project reorganizes the supplied Happy Fish game into a maintainable folder structure while preserving its original gameplay, 15 missions, progression, local save data, audio, profile, mission gates, camera/microphone options and canvas rendering.

## Project structure

```text
happy-fish-project/
├── index.html                 # Main game shell and all screen markup
├── css/
│   └── style.css               # Extracted styles
├── js/
│   └── app.js                  # Shared game engine and screen logic
├── pages/                      # Separate HTML entry pages
│   ├── login.html
│   ├── home.html
│   ├── mission-map.html
│   ├── player-profile.html
│   └── mission-details.html
└── README.md
```

## Run

1. Extract the ZIP file.
2. Open `index.html` in a modern browser. For camera/microphone access, use `localhost` or HTTPS (browsers restrict media permissions on ordinary file URLs).
3. Optional: open an entry page inside `pages/`; it forwards to the corresponding screen in the shared game.

For a local server, run `python -m http.server 8000` from this folder and visit `http://localhost:8000`.

## Notes

- Game progress is saved in browser `localStorage` under `happyFish2`.
- Google/Facebook buttons retain the original guest/name-based flow; real social authentication requires backend services and developer credentials.
- Camera and microphone features are optional. Players can type gate answers instead.
- The individual page files are lightweight entry routes; the game engine and state are shared in `index.html` + `js/app.js` so progress and gameplay are not duplicated across separate copies.
