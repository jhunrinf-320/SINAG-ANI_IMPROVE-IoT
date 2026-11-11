
import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  CloudOff,
  Download,
  Droplets,
  Gauge,
  Home,
  Leaf,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sun,
  Thermometer,
  Wind,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

import {
  auth,
  database,
  ref,
  onValue,
  set,
  query,
  limitToLast,
  signInAnonymously,
  onAuthStateChanged,
} from "./firebase/firebaseConfig";

// =============================================
// FIREBASE PATHS
// =============================================

const BASE = "devices/device001";
const COMMAND_PATH = `${BASE}/control/mode`;
const HISTORY_PATH = `${BASE}/history`;

const PAGES = [
  ["overview", "Overview", Home],
  ["auto", "Automatic", Wind],
  ["ai", "AI Adaptive", BrainCircuit],
  ["monitoring", "Monitoring", BarChart3],
];

// =============================================
// HELPERS
// =============================================

const numberValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    String(value).toLowerCase() === "nan"
  ) {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result) ? result : null;
};

const isTrue = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  value === "true";

const formatNumber = (value, decimals = 1) => {
  const result = numberValue(value);

  return result === null
    ? "—"
    : result.toFixed(decimals);
};

const formatTime = (seconds) => {
  const value = numberValue(seconds);

  if (value === null || value < 0) {
    return "--:--:--";
  }

  const total = Math.floor(value);

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  return [hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const getRecordTimestamp = (record) => {
  const raw =
    record.timestamp ??
    record.time ??
    record.createdAt ??
    record.epoch ??
    null;

  const parsed = numberValue(raw);

  if (parsed === null) return null;

  return new Date(
    parsed < 1000000000000
      ? parsed * 1000
      : parsed
  );
};

const getTemperature = (record) =>
  numberValue(
    record.storageChamberTemperature ??
    record.temp1 ??
    record.temperature ??
    record.temp
  );

const getHumidity = (record) =>
  numberValue(
    record.humidity ??
    record.relativeHumidity ??
    record.humidityPercent
  );

// =============================================
// REUSABLE COMPONENTS
// =============================================

function MetricCard({
  label,
  value,
  unit,
  Icon,
  color,
  detail,
}) {
  return (
    <article className={`metric ${color || ""}`}>
      <div className="metric-label">
        <span>
          <Icon size={18} />
        </span>

        {label}
      </div>

      <div className="metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>

      {detail && <p>{detail}</p>}
    </article>
  );
}

function PanelHeading({ label, title, Icon, right }) {
  return (
    <div className="panel-head">
      <div>
        <label>{label}</label>
        <h3>{title}</h3>
      </div>

      {right || (Icon && <Icon size={19} />)}
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <b>{value ?? "—"}</b>
    </div>
  );
}

function ConnectionRow({ label, connected }) {
  return (
    <div className="conn-row">
      <span>{label}</span>

      <b className={connected ? "good" : "bad"}>
        <i />
        {connected ? "Connected" : "Unavailable"}
      </b>
    </div>
  );
}

// =============================================
// HIGHEST TEMPERATURE DISPLAY
// =============================================

function HighestTemperatureCard({
  value,
  detail = "Highest available reactor temperature",
}) {
  return (
    <section className="highest-panel">
      <div className="highest-icon">
        <Thermometer size={27} />
      </div>

      <div className="highest-info">
        <span className="eyebrow">
          TEMPERATURE PERFORMANCE
        </span>

        <h3>Highest Recorded Temperature</h3>

        <p>{detail}</p>
      </div>

      <div className="highest-value">
        <strong>
          {value === null
            ? "—"
            : value.toFixed(2)}
        </strong>

        <span>°C</span>
      </div>
    </section>
  );
}

// =============================================
// TEMPERATURE CHART
// =============================================

function HistoryChart({
  title,
  data,
  unit,
  color,
  decimals = 1,
}) {
  const validData = data.filter(
    (item) => item.value !== null
  );

  if (!validData.length) {
    return (
      <div className="empty">
        <BarChart3 size={30} />

        <strong>No historical readings available</strong>

        <p>
          Waiting for saved Firebase sensor records.
        </p>
      </div>
    );
  }

  const values = validData.map(
    (item) => item.value
  );

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  const padding = Math.max(
    (maximum - minimum) * 0.2,
    unit === "°C" ? 1 : 2
  );

  const lower = minimum - padding;
  const upper = maximum + padding;
  const range = upper - lower || 1;

  const width = 720;
  const height = 260;

  const left = 55;
  const right = 20;
  const top = 20;
  const bottom = 38;

  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const points = validData.map((item, index) => {
    const x =
      left +
      (index / Math.max(validData.length - 1, 1)) *
        graphWidth;

    const y =
      top +
      ((upper - item.value) / range) *
        graphHeight;

    return { ...item, x, y };
  });

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const gridValues = [0, 1, 2, 3, 4].map(
    (index) => upper - (range * index) / 4
  );

  return (
    <div className="chart">
      <div className="chart-stats">
        <span>
          Highest:{" "}
          <b>{maximum.toFixed(decimals)}{unit}</b>
        </span>

        <span>
          Lowest:{" "}
          <b>{minimum.toFixed(decimals)}{unit}</b>
        </span>

        <span>
          Records: <b>{validData.length}</b>
        </span>
      </div>

      <div className="chart-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} history chart`}
        >
          {gridValues.map((value, index) => {
            const y =
              top + (index / 4) * graphHeight;

            return (
              <g key={index}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  className="chart-grid"
                />

                <text
                  x={left - 9}
                  y={y + 4}
                  textAnchor="end"
                  className="chart-label"
                >
                  {value.toFixed(decimals)}
                </text>
              </g>
            );
          })}

          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={color}
              stroke="#101d2e"
              strokeWidth="2"
            >
              <title>
                {point.label || `Reading ${index + 1}`}
                : {point.value.toFixed(decimals)}
                {unit}
              </title>
            </circle>
          ))}

          <text
            x={left}
            y={height - 8}
            className="chart-label"
          >
            Older readings
          </text>

          <text
            x={width - right}
            y={height - 8}
            textAnchor="end"
            className="chart-label"
          >
            Latest readings
          </text>
        </svg>
      </div>

      <div className="chart-footer">
        {title} · Firebase historical data
      </div>
    </div>
  );
}

// =============================================
// MAIN APPLICATION
// =============================================

function App() {
  const [device, setDevice] = useState({});
  const [history, setHistory] = useState([]);

  const [authOK, setAuthOK] = useState(false);
  const [dbOK, setDbOK] = useState(false);

  const [error, setError] = useState("");
  const [page, setPage] = useState("overview");

  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");

  const [mobileMenu, setMobileMenu] = useState(false);

  // ===========================================
  // FIREBASE AUTHENTICATION AND LISTENERS
  // ===========================================

  useEffect(() => {
    let stopDevice;
    let stopHistory;
    let disposed = false;
    let signingIn = false;

    const stopAuth = onAuthStateChanged(
      auth,
      async (user) => {
        if (disposed) return;

        if (!user) {
          setAuthOK(false);
          setDbOK(false);

          if (signingIn) return;

          signingIn = true;

          try {
            await signInAnonymously(auth);
          } catch (firebaseError) {
            if (!disposed) {
              setError(
                `Firebase authentication failed: ${firebaseError.message}`
              );
            }
          } finally {
            signingIn = false;
          }

          return;
        }

        setAuthOK(true);
        setError("");

        stopDevice?.();
        stopHistory?.();

        stopDevice = onValue(
          ref(database, BASE),

          (snapshot) => {
            if (disposed) return;

            setDevice(snapshot.val() || {});
            setDbOK(true);
            setError("");
          },

          (firebaseError) => {
            if (disposed) return;

            setDbOK(false);

            setError(
              `Database connection failed: ${firebaseError.message}`
            );
          }
        );

        stopHistory = onValue(
          query(
            ref(database, HISTORY_PATH),
            limitToLast(60)
          ),

          (snapshot) => {
            if (disposed) return;

            const records = snapshot.val() || {};

            const rows = Object.entries(records).map(
              ([key, value]) => ({
                key,
                ...(value || {}),
              })
            );

            setHistory(rows);
          },

          (firebaseError) => {
            console.warn(
              "History listener failed:",
              firebaseError.message
            );
          }
        );
      },

      (firebaseError) => {
        if (!disposed) {
          setAuthOK(false);

          setError(
            `Authentication listener failed: ${firebaseError.message}`
          );
        }
      }
    );

    return () => {
      disposed = true;

      stopAuth();
      stopDevice?.();
      stopHistory?.();
    };
  }, []);

  // ===========================================
  // FIREBASE DATA
  // ===========================================

  const sensors = device.sensors || {};
  const status = device.status || {};

  const mode = String(
    status.mode || "IDLE"
  ).toUpperCase();

  const paused = isTrue(status.paused);

  const automatic =
    isTrue(status.automatic) ||
    mode === "AUTO" ||
    mode === "AUTOMATIC";

  const aiMode = [
    "AI",
    "AI_ADAPTIVE",
    "AI ADAPTIVE",
  ].includes(mode);

  const safetyFault = isTrue(status.safetyFault);

  const temperature = numberValue(
    sensors.storageChamberTemperature ??
    sensors.temp1
  );

  const humidity = numberValue(
    sensors.humidity
  );

  const ambientTemperature = numberValue(
    sensors.dht11Temperature ??
    sensors.dhtTemperature
  );

  const weight = numberValue(
    sensors.sampleWeightGrams
  );

  const aiValid = isTrue(
    sensors.aiPredictionValid
  );

  const aiMoisture = aiValid
    ? numberValue(
        sensors.aiPredictedMoisturePercent
      )
    : null;

  const estimatedMoisture = numberValue(
    sensors.estimatedMoisturePercent ??
    status.estimatedMoisturePercent
  );

  const pwm = numberValue(status.pwm);

  const elapsed = numberValue(
    status.totalElapsedSeconds
  );

  const remaining = numberValue(
    status.totalRemainingSeconds
  );

  const stageElapsed = numberValue(
    status.stageElapsedSeconds
  );

  const stageRemaining = numberValue(
    status.stageRemainingSeconds
  );

  const endpointDetected = isTrue(
    sensors.endpointDetected ??
    status.endpointDetected
  );

  const online = isTrue(status.online);

  const wifiConnected = isTrue(
    status.wifiConnected ?? status.wifi
  );

  const cloudConnected = authOK && dbOK;

  const temperatureHealthy = isTrue(
    sensors.storageChamberTemperatureHealthy ??
    status.storageChamberTemperatureHealthy
  );

  const humidityHealthy = isTrue(
    sensors.humidityHealthy ??
    status.humidityHealthy
  );

  const weightHealthy = isTrue(
    sensors.loadCellHealthy ??
    status.loadCellHealthy
  );

  const stage = String(
    status.stage || "Waiting for controller"
  );

  // ===========================================
  // HISTORY PROCESSING
  // ===========================================

  const temperatureHistory = useMemo(() => {
    return history
      .map((record, index) => ({
        value: getTemperature(record),
        label: record.key || `Reading ${index + 1}`,
        timestamp: getRecordTimestamp(record),
      }))
      .filter((record) => record.value !== null);
  }, [history]);

  const humidityHistory = useMemo(() => {
    return history
      .map((record, index) => ({
        value: getHumidity(record),
        label: record.key || `Reading ${index + 1}`,
        timestamp: getRecordTimestamp(record),
      }))
      .filter((record) => record.value !== null);
  }, [history]);

  // Highest among loaded history, current reading,
  // and a persisted controller maximum if available.
  const highestTemperature = useMemo(() => {
    const values = temperatureHistory.map(
      (item) => item.value
    );

    if (temperature !== null) {
      values.push(temperature);
    }

    const savedMaximum = numberValue(
      sensors.highestTemperature ??
      status.highestTemperature
    );

    if (savedMaximum !== null) {
      values.push(savedMaximum);
    }

    return values.length
      ? Math.max(...values)
      : null;
  }, [
    temperatureHistory,
    temperature,
    sensors.highestTemperature,
    status.highestTemperature,
  ]);

  const highestHumidity = useMemo(() => {
    const values = humidityHistory.map(
      (item) => item.value
    );

    if (humidity !== null) {
      values.push(humidity);
    }

    return values.length
      ? Math.max(...values)
      : null;
  }, [humidityHistory, humidity]);

  const title =
    PAGES.find((item) => item[0] === page)?.[1] ||
    "Overview";

  // ===========================================
  // COMMAND HANDLING
  // ===========================================

  const sendCommand = async (commandValue) => {
    if (!cloudConnected) {
      setFeedback(
        "Command not sent. Firebase is disconnected."
      );
      return;
    }

    if (pending) return;

    if (
      safetyFault &&
      !["STOP"].includes(commandValue)
    ) {
      setFeedback(
        "Command blocked because a safety fault is active."
      );
      return;
    }

    if (commandValue === "STOP") {
      const confirmed = window.confirm(
        "Are you sure you want to stop the drying operation?"
      );

      if (!confirmed) return;
    }

    setPending(commandValue);
    setFeedback("");

    try {
      await set(
        ref(database, COMMAND_PATH),
        commandValue
      );

      setFeedback(
        `${commandValue} command written to Firebase. Waiting for ESP32 confirmation.`
      );
    } catch (commandError) {
      setFeedback(
        `Command failed: ${commandError.message}`
      );
    } finally {
      setPending("");
    }
  };

  // ===========================================
  // CSV EXPORT
  // ===========================================

  const exportCSV = () => {
    const rows = history.map((record) => {
      const timestamp = getRecordTimestamp(record);

      return {
        timestamp: timestamp
          ? timestamp.toISOString()
          : record.key,

        reactorTemperature:
          getTemperature(record) ?? "",

        humidity:
          getHumidity(record) ?? "",

        sampleWeight:
          numberValue(record.sampleWeightGrams) ?? "",
      };
    });

    if (!rows.length) {
      setFeedback(
        "There are no historical records available to export."
      );
      return;
    }

    const columns = [
      "timestamp",
      "reactorTemperature",
      "humidity",
      "sampleWeight",
    ];

    const csv = [
      columns.join(","),

      ...rows.map((row) =>
        columns
          .map((column) => {
            const value = String(row[column] ?? "");
            return `"${value.replaceAll('"', '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      [csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "SINAG-ANI-History.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  // ===========================================
  // SHARED DISPLAY COMPONENTS
  // ===========================================

  const commandButtons = (
    <div className="actions">
      <button
        className="start"
        disabled={!!pending || safetyFault || !cloudConnected}
        onClick={() =>
          sendCommand(page === "ai" ? "AI" : "AUTO")
        }
      >
        <Zap size={16} />
        Start {page === "ai" ? "AI" : "AUTO"}
      </button>

      <button
        className="pause"
        disabled={!!pending || paused || !cloudConnected}
        onClick={() => sendCommand("PAUSE")}
      >
        <Activity size={16} />
        Pause
      </button>

      <button
        disabled={!!pending || !paused || !cloudConnected}
        onClick={() => sendCommand("RESUME")}
      >
        <RefreshCw size={16} />
        Resume
      </button>

      <button
        className="stop"
        disabled={!!pending || !cloudConnected}
        onClick={() => sendCommand("STOP")}
      >
        <span className="stop-square" />
        Stop
      </button>
    </div>
  );

  const commandFeedback = (
    <>
      {pending && (
        <p className="feedback">
          Sending {pending} command...
        </p>
      )}

      {feedback && (
        <p className="feedback">
          {feedback}
        </p>
      )}
    </>
  );

  const selectPage = (nextPage) => {
    setPage(nextPage);
    setMobileMenu(false);
    setFeedback("");
  };

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div className="shell">

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          mobileMenu ? "sidebar-open" : ""
        }`}
      >
        <div className="brand">
          <div className="sun">
            <Sun size={22} />
            <Leaf size={12} />
          </div>

          <div>
            <b>SINAG-ANI</b>
            <small>SOLAR FOOD DRYER</small>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <label>SYSTEM MENU</label>

        <nav>
          {PAGES.map(([id, name, Icon]) => (
            <button
              key={id}
              className={
                page === id ? "selected" : ""
              }
              onClick={() => selectPage(id)}
            >
              <Icon size={18} />

              {name}

              {page === id && <i />}
            </button>
          ))}
        </nav>

        <div className="device">
          <Zap size={18} />

          <div>
            <b>ESP32 Controller</b>
            <small>Device ID: device001</small>
          </div>
        </div>

        <div className="cloud-state">
          <i className={cloudConnected ? "online" : ""} />

          {cloudConnected
            ? "Firebase connected"
            : "Firebase disconnected"}
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenu(false)}
          aria-label="Close navigation"
        />
      )}

      {/* MAIN */}

      <main>
        <header>
          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>

          <div className="mobile-brand">
            <div className="sun">
              <Sun size={19} />
              <Leaf size={10} />
            </div>

            <b>SINAG-ANI</b>
          </div>

          <div className="crumb">
            Workspace
            <ChevronRight size={14} />
            <b>{title}</b>
          </div>

          <div className="top-status">
            {cloudConnected
              ? <Cloud size={15} />
              : <CloudOff size={15} />}

            {cloudConnected
              ? "CLOUD CONNECTED"
              : "CLOUD DISCONNECTED"}
          </div>
        </header>

        <div className="content">

          {/* PAGE TITLE */}

          <div className="page-title">
            <div>
              <span className="eyebrow">
                SINAG-ANI RESEARCH SYSTEM
              </span>

              <h1>
                SINAG-ANI{" "}
                <span>IoT Monitoring</span>
              </h1>

              <p>
                Solar food dryer · Live monitoring and adaptive drying
              </p>
            </div>

            <div
              className={`device-pill ${
                online ? "online" : ""
              }`}
            >
              <i />

              {online ? "DEVICE ONLINE" : "DEVICE OFFLINE"}
            </div>
          </div>

          {error && (
            <div className="error">
              <AlertTriangle size={17} />
              {error}
            </div>
          )}

          {/* OVERVIEW */}

          {page === "overview" && (
            <>
              <section className="heading">
                <div>
                  <label>LIVE SYSTEM OVERVIEW</label>

                  <h2>Drying system at a glance</h2>

                  <p>
                    Reactor chamber conditions, drying progress,
                    and controller status.
                  </p>
                </div>

                <span className="live">
                  <i />
                  LIVE FIREBASE DATA
                </span>
              </section>

              <div className="metrics">
                <MetricCard
                  label="Reactor Temperature"
                  value={formatNumber(temperature, 2)}
                  unit="°C"
                  Icon={Thermometer}
                  color="orange"
                  detail={
                    temperatureHealthy
                      ? "Temperature sensor healthy"
                      : "Waiting for valid reading"
                  }
                />

                <MetricCard
                  label="Air Humidity"
                  value={formatNumber(humidity)}
                  unit="%"
                  Icon={Droplets}
                  color="blue"
                  detail={
                    humidityHealthy
                      ? "Humidity sensor healthy"
                      : "Waiting for valid reading"
                  }
                />

                <MetricCard
                  label="AI Predicted Moisture"
                  value={
                    aiMoisture === null
                      ? "N/A"
                      : formatNumber(aiMoisture)
                  }
                  unit={aiMoisture === null ? "" : "%"}
                  Icon={Gauge}
                  color="purple"
                  detail={
                    aiValid
                      ? "Valid model output"
                      : "Prediction unavailable"
                  }
                />

                <MetricCard
                  label="Sample Weight"
                  value={formatNumber(weight, 2)}
                  unit="g"
                  Icon={Leaf}
                  color="green"
                  detail={
                    weightHealthy
                      ? "Load cell available"
                      : "Load cell unavailable"
                  }
                />
              </div>

              <HighestTemperatureCard
                value={highestTemperature}
                detail="Highest among currently loaded history and live reading"
              />

              <div className="columns">
                <section className="panel">
                  <PanelHeading
                    label="OPERATING MODES"
                    title="Select a drying mode"
                  />

                  <div className="modes">
                    <button
                      className={`mode auto ${
                        automatic ? "active" : ""
                      }`}
                      onClick={() => selectPage("auto")}
                    >
                      <Wind size={23} />

                      <b>Automatic Drying</b>

                      <p>
                        Runs the configured initial,
                        main and final drying stages.
                      </p>

                      <strong>
                        OPEN AUTOMATIC
                        <ChevronRight size={15} />
                      </strong>
                    </button>

                    <button
                      className={`mode ai ${
                        aiMode ? "active" : ""
                      }`}
                      onClick={() => selectPage("ai")}
                    >
                      <BrainCircuit size={23} />

                      <b>AI Adaptive Drying</b>

                      <p>
                        Displays model-based moisture
                        prediction and AI status.
                      </p>

                      <strong>
                        OPEN AI MODE
                        <ChevronRight size={15} />
                      </strong>
                    </button>
                  </div>

                  <div className="note">
                    <ShieldCheck size={17} />

                    The main ESP32 remains responsible
                    for fan control, timing and hardware safety.
                  </div>
                </section>

                <section className="panel">
                  <PanelHeading
                    label="CONTROLLER STATUS"
                    title="Current operation"
                    right={
                      <span
                        className={`tag ${
                          safetyFault
                            ? "danger"
                            : paused
                              ? "warn"
                              : "ok"
                        }`}
                      >
                        {safetyFault
                          ? "SAFETY FAULT"
                          : paused
                            ? "PAUSED"
                            : "NORMAL"}
                      </span>
                    }
                  />

                  <StatusRow
                    label="Operating mode"
                    value={
                      aiMode
                        ? "AI ADAPTIVE"
                        : automatic
                          ? "AUTOMATIC"
                          : paused
                            ? "PAUSED"
                            : mode
                    }
                  />

                  <StatusRow
                    label="Drying stage"
                    value={stage}
                  />

                  <StatusRow
                    label="Fan output"
                    value={
                      pwm === null ? "—" : `${pwm}%`
                    }
                  />

                  <StatusRow
                    label="Cool-air fan"
                    value={
                      isTrue(status.coolFan) ? "ON" : "OFF"
                    }
                  />

                  <StatusRow
                    label="Trial number"
                    value={
                      numberValue(status.trialNumber) ?? "—"
                    }
                  />

                  {safetyFault && (
                    <div className="fault">
                      <AlertTriangle size={17} />

                      {status.safetyFaultReason ||
                        "Safety fault active. Check the controller."}
                    </div>
                  )}
                </section>
              </div>

              <div className="columns">
                <section className="panel">
                  <PanelHeading
                    label="DRYING TIME"
                    title="Elapsed and remaining time"
                    Icon={Clock3}
                  />

                  <div className="timers">
                    <div>
                      <small>Total elapsed</small>
                      <b>{formatTime(elapsed)}</b>
                    </div>

                    <div>
                      <small>Total remaining</small>
                      <b>{formatTime(remaining)}</b>
                    </div>

                    <div>
                      <small>Stage elapsed</small>
                      <b>{formatTime(stageElapsed)}</b>
                    </div>

                    <div>
                      <small>Stage remaining</small>
                      <b>{formatTime(stageRemaining)}</b>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <PanelHeading
                    label="CONNECTION STATUS"
                    title="Device and cloud"
                    Icon={Cloud}
                  />

                  <ConnectionRow
                    label="Firebase authentication"
                    connected={authOK}
                  />

                  <ConnectionRow
                    label="Realtime database"
                    connected={dbOK}
                  />

                  <ConnectionRow
                    label="ESP32 Wi-Fi"
                    connected={wifiConnected}
                  />

                  <ConnectionRow
                    label="Device heartbeat"
                    connected={online}
                  />
                </section>
              </div>

              <section className="panel">
                <PanelHeading
                  label="TEMPERATURE PERFORMANCE"
                  title="Reactor chamber summary"
                  Icon={Thermometer}
                />

                <div className="summary-grid">
                  <div>
                    <small>Current temperature</small>
                    <b>{formatNumber(temperature, 2)} °C</b>
                  </div>

                  <div>
                    <small>Highest recorded</small>
                    <b>
                      {formatNumber(highestTemperature, 2)} °C
                    </b>
                  </div>

                  <div>
                    <small>Highest humidity</small>
                    <b>{formatNumber(highestHumidity)} %</b>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* AUTOMATIC */}

          {page === "auto" && (
            <>
              <section className="heading">
                <div>
                  <label>AUTOMATIC MODE</label>

                  <h2>Automatic drying control</h2>

                  <p>
                    The ESP32 controls drying stages.
                    This website sends commands and displays
                    controller-reported progress.
                  </p>
                </div>
              </section>

              <section className="hero">
                <Wind size={30} />

                <div>
                  <label>CURRENT DRYING STAGE</label>

                  <h2>{stage}</h2>

                  <p>
                    {paused
                      ? "Drying is paused."
                      : automatic
                        ? "Automatic drying is active."
                        : "Automatic drying is not active."}
                  </p>
                </div>

                <div className="hero-time">
                  <small>TOTAL ELAPSED</small>
                  <b>{formatTime(elapsed)}</b>
                </div>
              </section>

              <div className="metrics compact">
                <MetricCard
                  label="Reactor Temperature"
                  value={formatNumber(temperature)}
                  unit="°C"
                  Icon={Thermometer}
                  color="orange"
                />

                <MetricCard
                  label="Air Humidity"
                  value={formatNumber(humidity)}
                  unit="%"
                  Icon={Droplets}
                  color="blue"
                />

                <MetricCard
                  label="Sample Weight"
                  value={formatNumber(weight)}
                  unit="g"
                  Icon={Leaf}
                  color="green"
                />
              </div>

              <section className="panel">
                <PanelHeading
                  label="CONTROLLER COMMANDS"
                  title="Automatic mode actions"
                  right={<small>Firebase → ESP32</small>}
                />

                {commandButtons}
                {commandFeedback}
              </section>

              <section className="panel">
                <PanelHeading
                  label="STAGE PROGRESS"
                  title="Controller-reported sequence"
                />

                <div className="stages">
                  {["INITIAL", "MAIN", "FINAL", "COMPLETE"].map(
                    (item, index) => {
                      const current = stage.toUpperCase();

                      const activeIndex =
                        current.includes("INITIAL") ? 0 :
                        current.includes("MAIN") ? 1 :
                        current.includes("FINAL") ? 2 :
                        current.includes("COMPLETE") ? 3 : -1;

                      return (
                        <div
                          key={item}
                          className={
                            activeIndex === index
                              ? "current"
                              : activeIndex > index
                                ? "done"
                                : ""
                          }
                        >
                          <span>{index + 1}</span>
                          <b>{item}</b>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="timers two">
                  <div>
                    <small>Stage elapsed</small>
                    <b>{formatTime(stageElapsed)}</b>
                  </div>

                  <div>
                    <small>Stage remaining</small>
                    <b>{formatTime(stageRemaining)}</b>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* AI ADAPTIVE */}

          {page === "ai" && (
            <>
              <section className="heading">
                <div>
                  <label>AI ADAPTIVE MODE</label>

                  <h2>AI moisture prediction</h2>

                  <p>
                    Prediction and validity are read from
                    the main ESP32. This website does not
                    independently run the model.
                  </p>
                </div>
              </section>

              <section className="ai-hero">
                <div className="ai-top">
                  <BrainCircuit size={28} />

                  <span
                    className={`tag ${
                      aiMode ? "ok" : "neutral"
                    }`}
                  >
                    {aiMode
                      ? "AI MODE ACTIVE"
                      : "AI MODE INACTIVE"}
                  </span>
                </div>

                <label>PREDICTED MOISTURE CONTENT</label>

                <div className="ai-number">
                  {aiMoisture === null
                    ? "N/A"
                    : aiMoisture.toFixed(1)}

                  {aiMoisture !== null && <small>%</small>}
                </div>

                <p>
                  {aiValid && aiMoisture !== null
                    ? "The controller reports a valid model output."
                    : "A valid prediction is not currently available."}
                </p>

                <div className="ai-data">
                  <div>
                    <small>Prediction status</small>
                    <b>
                      {aiValid && aiMoisture !== null
                        ? "VALID OUTPUT"
                        : "NOT AVAILABLE"}
                    </b>
                  </div>

                  <div>
                    <small>Chamber temperature</small>
                    <b>{formatNumber(temperature, 2)} °C</b>
                  </div>

                  <div>
                    <small>Air humidity</small>
                    <b>{formatNumber(humidity)} %</b>
                  </div>

                  <div>
                    <small>Elapsed time</small>
                    <b>{formatTime(elapsed)}</b>
                  </div>

                  <div>
                    <small>Target moisture</small>
                    <b>
                      {formatNumber(
                        status.targetMoisturePercent ??
                        sensors.targetMoisturePercent
                      )} %
                    </b>
                  </div>
                </div>
              </section>

              <div className="metrics compact">
                <MetricCard
                  label="Estimated Moisture"
                  value={formatNumber(estimatedMoisture)}
                  unit={estimatedMoisture === null ? "" : "%"}
                  Icon={Droplets}
                  color="blue"
                  detail="Controller-reported estimate"
                />

                <MetricCard
                  label="Stable Weight Readings"
                  value={
                    numberValue(sensors.stableWeightReadings) ?? "—"
                  }
                  Icon={Activity}
                  color="green"
                  detail={
                    weightHealthy
                      ? "Load cell available"
                      : "Load cell unavailable"
                  }
                />

                <MetricCard
                  label="Endpoint Detection"
                  value={
                    endpointDetected ? "DETECTED" : "NOT DETECTED"
                  }
                  Icon={CheckCircle2}
                  color={endpointDetected ? "green" : "orange"}
                  detail="Controller-reported status"
                />
              </div>

              <section className="panel">
                <PanelHeading
                  label="AI MODE ACTIONS"
                  title="Start or manage AI drying"
                  right={<small>ESP32 remains in control</small>}
                />

                {commandButtons}
                {commandFeedback}
              </section>

              <div className="research-note">
                <ShieldCheck size={19} />

                <div>
                  <b>Research interpretation</b>

                  <p>
                    AI predictions outside the source
                    dataset's measured conditions are
                    experimental extrapolations.
                    Displayed estimates are not proof
                    of accuracy. Independent moisture
                    measurements are needed for validation.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* MONITORING */}

          {page === "monitoring" && (
            <>
              <section className="heading">
                <div>
                  <label>SENSOR MONITORING</label>

                  <h2>Live sensor readings</h2>

                  <p>
                    Sensor data and historical records
                    from Firebase Realtime Database.
                  </p>
                </div>

                <button
                  className="export-button"
                  onClick={exportCSV}
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </section>

              <div className="metrics">
                <MetricCard
                  label="Reactor Temperature"
                  value={formatNumber(temperature, 2)}
                  unit="°C"
                  Icon={Thermometer}
                  color="orange"
                  detail={
                    temperatureHealthy
                      ? "Sensor healthy"
                      : "Sensor unavailable"
                  }
                />

                <MetricCard
                  label="Ambient Temperature"
                  value={formatNumber(ambientTemperature)}
                  unit="°C"
                  Icon={Sun}
                  color="orange"
                />

                <MetricCard
                  label="Air Humidity"
                  value={formatNumber(humidity)}
                  unit="%"
                  Icon={Droplets}
                  color="blue"
                />

                <MetricCard
                  label="Sample Weight"
                  value={formatNumber(weight, 2)}
                  unit="g"
                  Icon={Leaf}
                  color="green"
                />
              </div>

              <HighestTemperatureCard
                value={highestTemperature}
                detail="Highest among currently loaded history and live reading"
              />

              <section className="panel">
                <PanelHeading
                  label="TEMPERATURE TREND"
                  title="Reactor chamber history"
                  Icon={Thermometer}
                />

                <HistoryChart
                  title="Reactor chamber temperature"
                  data={temperatureHistory}
                  unit="°C"
                  color="#50d69a"
                  decimals={2}
                />
              </section>

              <section className="panel">
                <PanelHeading
                  label="HUMIDITY TREND"
                  title="Relative humidity history"
                  Icon={Droplets}
                />

                <HistoryChart
                  title="Relative humidity"
                  data={humidityHistory}
                  unit="%"
                  color="#5ac8ed"
                  decimals={1}
                />
              </section>

              <section className="panel">
                <PanelHeading
                  label="SENSOR HEALTH"
                  title="Measurement availability"
                  Icon={ShieldCheck}
                />

                <ConnectionRow
                  label="Reactor temperature sensor"
                  connected={temperatureHealthy}
                />

                <ConnectionRow
                  label="Humidity sensor"
                  connected={humidityHealthy}
                />

                <ConnectionRow
                  label="Load cell / HX711"
                  connected={weightHealthy}
                />

                <ConnectionRow
                  label="HX711 ready"
                  connected={isTrue(
                    sensors.hx711Ready ?? status.hx711Ready
                  )}
                />
              </section>
            </>
          )}

          {/* FOOTER */}

          <footer>
            <span>
              © SINAG-ANI · Solar Food Dryer Research Project
            </span>

            <span>
              Firebase · devices/device001
            </span>
          </footer>
        </div>
      </main>

      {/* MOBILE NAVIGATION */}

      <nav className="mobile-nav">
        {PAGES.map(([id, name, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => selectPage(id)}
          >
            <Icon size={18} />

            <span>
              {name === "Automatic"
                ? "AUTO"
                : name === "AI Adaptive"
                  ? "AI"
                  : name}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
