HAPPY FISH — STATIC GITHUB PAGES EDITION
All pages use HTML, CSS and browser JavaScript. No Node.js server required.
Firebase Authentication + Cloud Firestore provide Google sign-in and cross-device cloud saves.

FILES
- index.html / styles.css / app.js: game
- admin.html / admin.css / admin.js: separate admin website
- config.js: Firebase project config and admin account
- firestore.rules: database security rules

FIRST-TIME SETUP (REQUIRED)
1. Create a Firebase project: https://console.firebase.google.com/
2. Add a Web App in Project settings. Copy its config into config.js (all six values).
3. Firebase Console -> Authentication -> Sign-in method -> enable Google.
4. Authentication -> Settings -> Authorized domains: add www.happyfish.run.place and happyfish.run.place.
5. Google Cloud Console OAuth client -> Authorized JavaScript origins: add https://www.happyfish.run.place and https://happyfish.run.place.
6. In config.js set HAPPY_FISH_ADMIN_EMAIL to the exact Google email that will administer the game.
7. In firestore.rules replace YOUR_ADMIN_GOOGLE_EMAIL with that exact same email, then publish rules in Firebase Console -> Firestore Database -> Rules.
8. Create Firestore Database. Publish the rules above.
9. Upload all files in this folder to the root of your GitHub Pages repository.
10. Test https://www.happyfish.run.place/ and open https://www.happyfish.run.place/admin.html.

ADMIN
- Password is 00000000 as requested.
- Admin must also sign in with the exact configured admin Google email.
- Password is only an extra UI gate; static JS passwords are visible to visitors. Firestore rules + admin Google email enforce database permissions.
- Replace the placeholder email in BOTH config.js and firestore.rules.

GOOGLE LOGIN FIX
- Removed the old localhost:3000 backend dependency. On GitHub Pages, localhost refers to each visitor's computer, so the previous login request could not reach your backend.
- Firebase Auth now handles Google popup sign-in, with redirect fallback when popups are blocked.
- This requires completing Firebase config and allowed-domain steps above. Firebase web config is public by design; never put OAuth client secrets or service-account keys in frontend code.

MISSION CONTINUE
- When the fish dies, the player can continue at the same stage and retain current stage progress and score.
- Cost: 500 coins OR 10 gems. Continue gives one life and resets active fish/hazards.
- If currency is insufficient, a message appears. Retry and map options remain.

LIMITATIONS
- Static HTML/CSS/JS cannot securely hide an admin password or validate game rewards. Admin database access is protected by Firestore rules and the configured Google email, not by the password alone.
- Currency and mission progress can still be manipulated by a determined user through browser tools; cheat-proof rewards need trusted server logic.
- No Firebase project credentials were provided, so config.js contains placeholders that must be filled before Google sign-in/cloud saves can work.
