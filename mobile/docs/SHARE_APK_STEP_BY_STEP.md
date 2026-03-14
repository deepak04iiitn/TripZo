# TripZo - Share APK for Friend Testing (Step by Step)

This guide shows the easiest and most reliable way to generate an APK and share it with a friend for testing.

---

## 1) One-time setup on your machine

Open PowerShell in:

`C:\PERSONAL PROJECTS\TripZo\mobile`

### 1.1 Install dependencies

```powershell
npm install
```

### 1.2 Install EAS CLI globally (if not installed)

```powershell
npm install -g eas-cli
```

### 1.3 Log in to Expo account

```powershell
eas login
```

If you do not have an Expo account, create one here:
<https://expo.dev/signup>

---

## 2) Initialize EAS config (first time only)

Run:

```powershell
eas build:configure
```

This creates `eas.json`.

After it is created, update `eas.json` to ensure APK output for internal testing:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

Use the `preview` profile to create an `.apk`.

---

## 3) Set required environment values

Your `app.config.js` expects:

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

You can set this for the current PowerShell session:

```powershell
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_ANDROID_MAPS_KEY"
```

If you skip this, map-related features may not work correctly in the APK.

---

## 4) Build APK in Expo cloud

Run:

```powershell
eas build -p android --profile preview
```

What happens:
- Expo uploads your project
- Cloud build runs
- You get a build URL in terminal
- When complete, you can download the `.apk`

You can also view builds here:
<https://expo.dev/accounts>

---

## 5) Download and share the APK

When build is finished, open the build page and do one of these:

- Share the Expo build link directly with your friend
- Download the APK file and share via Google Drive, WhatsApp, Telegram, email, etc.

Tip: If messenger blocks APK files, zip it first and share the zip.

---

## 6) Steps for your friend to install

Send this to your friend:

1. Download the APK.
2. On Android, allow app installs from unknown sources for the app used to open the APK (Chrome/Files/Drive).
3. Tap APK and install.
4. If Play Protect warning appears, choose install anyway (only if they trust you).
5. Open TripZo and test.

---

## 7) Rebuild after changes

Every time you want to send an updated test build:

```powershell
eas build -p android --profile preview
```

Send the new build link/APK.

---

## 8) Common issues and fixes

### Issue: `eas` command not found

Fix:

```powershell
npm install -g eas-cli
```

Then restart PowerShell.

### Issue: Build fails due to login/project ownership

Fix:

```powershell
eas whoami
```

Make sure correct Expo account is logged in.

### Issue: App installs but crashes on startup

Most common causes:
- Missing environment variables
- Runtime API key/config issue
- Recent code error

Create another build after fixing env/config.

### Issue: Friend cannot install APK

Check:
- APK fully downloaded
- Unknown sources allowed
- Android version compatibility
- Device storage available

---

## 9) Optional: Keep testing and production builds separate

- Use `preview` profile for friend testing (`apk`)
- Use `production` profile for Play Store (`aab`)

This avoids sending Play Store bundles (`.aab`) to testers.


