# Android emulator for agent-driven phone checks

Agents run the Android part of [tasks/mobile-release-checklist.md](../../tasks/mobile-release-checklist.md) (section "Android: instalación, avisos y badge") on a Pixel emulator on this Mac, driven over `adb`, so the only thing Jorge has to do by hand is sign in once. Set up with Jorge's OK in ZIG-I21-6 (2026-10-15); zero cost, about 4 GB on disk.

## Install (once)

```bash
brew install openjdk                                   # the SDK tools need a JDK; keg-only, no sudo
brew install --cask android-commandlinetools           # sdkmanager / avdmanager
export JAVA_HOME=/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | sdkmanager --licenses
sdkmanager "platform-tools" "emulator" "system-images;android-35;google_apis_playstore;arm64-v8a"
avdmanager create avd -n zigzag-pixel -d pixel_7 -k "system-images;android-35;google_apis_playstore;arm64-v8a"
sed -i '' 's/^PlayStore.enabled=no/PlayStore.enabled=yes/' ~/.android/avd/zigzag-pixel.avd/config.ini
```

- `avdmanager create` prints `Could not load devices from .../devices.xml`; the AVD is created anyway.
- Use the **Play Store** image (`google_apis_playstore`) and nothing else: it is the only one with Chrome and Google Play Services, and Web Push on Android goes through Play Services. The plain `google_apis` image has neither.
- Put `platform-tools` and `emulator` on `PATH`, or call them as `$ANDROID_HOME/platform-tools/adb` and `$ANDROID_HOME/emulator/emulator`.

## Boot

```bash
emulator -avd zigzag-pixel -dns-server 8.8.8.8,1.1.1.1 -cores 2 -memory 2048 -gpu auto -no-boot-anim
adb wait-for-device shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 2; done'
```

- `-dns-server` is **required** on this Mac. The host's resolvers are IPv6 addresses the emulator cannot forward to, so without the flag every site fails with `ERR_ADDRESS_UNREACHABLE` / "No internet" while an IP-literal URL loads.
- The Mac has 8 GB. With other sessions' `next-server` or Playwright running the emulator swaps, System UI shows "isn't responding" (tap **Wait**) and QEMU can hang and die. Before relaunching: `pkill -f qemu-system-aarch64` and `rm ~/.android/avd/zigzag-pixel.avd/*.lock`.
- `adb emu kill` stops it. Bring the window to the front for Jorge with `osascript -e 'tell application "System Events" to tell (first process whose name contains "qemu") to set frontmost to true'`.
- The image ships Chrome 124; Play Store only updates it with a Google account on the device.

## Sign-in and data

Jorge signs in **in the emulator window** with the ClimaTotal Demo test user; agents never type production credentials, in the emulator or anywhere else. Everything after that goes over `adb`. Allowed writes in prod during a run: this device's push subscription (deleted on sign-out), one export, and the overdue maintenance Jorge prepares. Captures must not show another company's data.

The maintenance aviso comes from the daily cron (`/api/cron/notifications`, 13:00 UTC); it deduplicates by schedule id + bucket + due date, so an overdue schedule that was already notified does not fire again — prepare a fresh one. The job queue (`runDueJobs`) drains at the same cron.

## Driving the checklist

```bash
adb shell am start -a android.intent.action.VIEW -d "https://zigzag-hazel.vercel.app/account" com.android.chrome
adb exec-out screencap -p > capture.png                       # screenshot
adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml   # native UI tree (Chrome sheets, dialogs, launcher)
adb shell input tap <x> <y>                                   # tap at device pixels (1080×2400)
adb shell cmd statusbar expand-notifications                  # open the notification shade
adb shell dumpsys notification --noredact                     # text evidence: badge icon, actions, channel
adb shell pm list packages | grep webapk                      # the installed WebAPK, if Play minted one
adb logcat -d | grep -i webapk                                # why Play did or did not mint it
```

- `uiautomator` sees Chrome's native sheets (install sheet ids `button_install`, `screenshots_container`; permission prompt `positive_button`) but not web content. For the page itself use Chrome DevTools over adb: `adb forward tcp:9222 localabstract:chrome_devtools_remote`, then `curl localhost:9222/json` lists the tabs, the installed app and the service worker as targets, and a WebSocket to `webSocketDebuggerUrl` takes `Runtime.evaluate`. Close stray tabs with `curl localhost:9222/json/close/<id>`.
- Map CSS px to device px: `x_dev = x * 2.625`, `y_dev = y * 2.625 + (2337 − clientHeight * 2.625)` (2337 is the top of the navigation bar; the formula works in Chrome and in the standalone app). The app smooth-scrolls, so measure after `scrollIntoView({ behavior: 'instant' })`, right before the tap.
- A page cannot `eval` (CSP); to see why a service worker fails to install, attach to the `service_worker` target (`Target.setAutoAttach` with `flatten: true`, `Runtime.enable`, `runIfWaitingForDebugger`) and read `Runtime.exceptionThrown`.

### Install (ZIG-I21-4)

Más › Cuenta › **Instalar ZigZag** opens Chrome's rich install sheet with the manifest screenshots. Chrome then asks Play Services to mint a **WebAPK**. Without a Google account on the device Play refuses (`Finsky: WebAPK service unknown_account` in logcat) and Chrome silently falls back to a legacy shortcut: the icon carries a small Chrome badge, the app still opens standalone on `/dashboard` and receives push, but the Badging API does nothing. For the app-icon badge check add a Google account in the emulator first (Settings › Passwords & accounts; Jorge does this), uninstall the shortcut and install again; the package then shows up as `org.chromium.webapk.*`.

### Avisos (ZIG-I21-1/2/3)

- **Activar avisos aquí** shows two prompts on Android 13+: the site's notification permission and Chrome's own app permission. Tap Allow on both, then tap the button once more if the card still reads "Activar avisos aquí".
- Push only works when the service worker is registered: check `navigator.serviceWorker.getRegistrations()` on prod before blaming the device (ZIG-15 was a broken `sw.js`, not the emulator).
- Status bar icon: `dumpsys notification --noredact` prints `icon=` for the small (badge) icon and `actions=` with the button titles; `screencap` shows the silhouette.
- The Pixel launcher shows a **dot**, not a number, for the app badge (Samsung One UI shows the number). Capture the home screen before and after **Marcar todo**.

## Clean-up

Apagar avisos aquí, Cerrar sesión (the subscription row disappears), then `adb emu kill`. The AVD keeps Chrome's profile between boots; `-no-snapshot-load` boots clean.
