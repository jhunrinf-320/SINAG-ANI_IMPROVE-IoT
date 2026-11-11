# SINAG-ANI IoT Monitoring Website

Responsive React + Vite dashboard using the supplied Firebase project configuration and anonymous authentication.

## Pages
- Overview: reactor temperature, humidity, AI prediction, sample weight, operating state, fan output, timers, and connection status.
- Automatic: AUTO / PAUSE / RESUME / STOP controls and controller-reported drying stage.
- AI Adaptive: AI prediction validity, estimated moisture, endpoint status, and AI / PAUSE / RESUME / STOP controls.
- Monitoring: live sensors, sensor health, and saved temperature history.

Manual mode is intentionally excluded.

## Firebase paths
- Read: `devices/device001`
- History: `devices/device001/history`
- Write commands: `devices/device001/control/mode`

Commands written: `AUTO`, `AI`, `PAUSE`, `RESUME`, `STOP`. The main ESP32 must support these commands. The ESP32 remains responsible for fan outputs, timing, and safety.

## Run locally
Requires Node.js 20+.
```bash
npm install
npm run dev
```
Build:
```bash
npm run build
npm run preview
```

## GitHub Pages
1. Extract the ZIP and copy the folder contents into the root of the existing `PROJECT-SINAG-ANI-IoT-Monitoring-System` repository.
2. Push to the `main` branch.
3. In GitHub, open Settings → Pages and select **GitHub Actions** as the build/deployment source.
4. Open Actions and wait for the workflow to complete. GitHub displays the published URL in Settings → Pages.
5. If the repository name changes, update `base` in `vite.config.js`.

## Firebase security
Anonymous Authentication must be enabled. Configure Firebase Realtime Database Security Rules so authenticated users can read the device data and write only the control command path. Do not make the whole database publicly writable. Firebase web config identifies the project; database rules are the access control.

## Current data fields read
`sensors.storageChamberTemperature`, `sensors.humidity`, `sensors.dht11Temperature`, `sensors.sampleWeightGrams`, `sensors.aiPredictionValid`, `sensors.aiPredictedMoisturePercent`, `sensors.estimatedMoisturePercent`, `sensors.endpointDetected`, `sensors.stableWeightReadings`, sensor-health fields, and `status.mode`, `status.stage`, `status.pwm`, `status.paused`, `status.totalElapsedSeconds`, `status.totalRemainingSeconds`, `status.stageElapsedSeconds`, `status.stageRemainingSeconds`, `status.online`, `status.wifiConnected`, and `status.firebaseReady`.

Missing or invalid readings display as an em dash or N/A. No demo values are inserted.
