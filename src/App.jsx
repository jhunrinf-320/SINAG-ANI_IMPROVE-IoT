
import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  CloudOff,
  Cpu,
  Download,
  Droplets,
  FileSpreadsheet,
  Gauge,
  Home,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Sun,
  Thermometer,
  Wind,
  Zap,
  ClipboardList,
  History,
  Wifi,
  Menu,
  X,
  Plus,
  Trash2,
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

/* =========================================================
   FIREBASE PATHS
   Keep existing device and command paths unchanged.
========================================================= */

const BASE = "devices/device001";
const CMD = `${BASE}/control/mode`;
const HISTORY = `${BASE}/history`;

const PAGES = [
  ["overview", "Overview", Home],
  ["auto", "Automatic", Wind],
  ["ai", "AI Adaptive", Gauge],
  ["monitoring", "Monitoring", BarChart3],
  ["trials", "Trial Reports", FileSpreadsheet],
  ["logs", "System Logs", History],
];

const STAGES = ["INITIAL", "MAIN", "FINAL", "COMPLETE"];

/* =========================================================
   HELPERS
========================================================= */

const num = (value) => {
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

const yes = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  value === "true";

const fmt = (value, decimals = 1) => {
  const n = num(value);
  return n === null ? "—" : n.toFixed(decimals);
};

const time = (seconds) => {
  const value = num(seconds);

  if (value === null || value < 0) return "--:--:--";

  const total = Math.floor(value);

  return [
    Math.floor(total / 3600),
    Math.floor((total % 3600) / 60),
    total % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const timestampLabel = (value) => {
  if (value === null || value === undefined) return "Time unavailable";

  if (typeof value === "number") {
    const milliseconds =
      value < 100000000000 ? value * 1000 : value;

    const date = new Date(milliseconds);

    return Number.isNaN(date.getTime())
      ? "Time unavailable"
      : date.toLocaleString();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
};

const getTemperature = (record = {}) =>
  num(
    record.storageChamberTemperature ??
      record.temp1 ??
      record.temperature ??
      record.temp
  );

const getHumidity = (record = {}) =>
  num(
    record.humidity ??
      record.relativeHumidity ??
      record.humidityPercent
  );

const csvEscape = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

function downloadCSV(filename, rows) {
  if (!rows.length) {
    alert("There is no data available to export yet.");
    return;
  }

  const columns = Object.keys(rows[0]);

  const csv = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvEscape(row[column])).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  color = "blue",
  detail,
}) {
  return (
    <article className={`metric ${color}`}>
      <div className="metric-label">
        <span>
          <Icon size={17} />
        </span>
        {label}
      </div>

      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>

      {detail && <p>{detail}</p>}
    </article>
  );
}

function Panel({ label, title, children, action }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <label>{label}</label>
          <h3>{title}</h3>
        </div>

        {action}
      </div>

      {children}
    </section>
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

function EmptyState({ message }) {
  return <div className="empty">{message}</div>;
}

/* =========================================================
   HISTORY CHART
   Uses existing history records only.
========================================================= */

function HistoryChart({ records, field = "temperature" }) {
  const values = records
    .map((record) =>
      field === "temperature"
        ? getTemperature(record)
        : getHumidity(record)
    )
    .filter((value) => value !== null);

  if (!values.length) {
    return (
      <EmptyState message="No saved readings are available for this chart yet." />
    );
  }

  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = Math.max(high - low, 1);

  const points = values.map((value, index) => {
    const x =
      20 + (index * 660) / Math.max(values.length - 1, 1);

    const y = 175 - ((value - low) / range) * 145;

    return [x, y];
  });

  const path = points
    .map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`)
    .join(" ");

  return (
    <div className="chart">
      <div className="chart-stats">
        <span>
          Highest: <b>{high.toFixed(1)}</b>
        </span>

        <span>
          Lowest: <b>{low.toFixed(1)}</b>
        </span>

        <span>
          Readings: <b>{values.length}</b>
        </span>
      </div>

      <svg
        viewBox="0 0 700 190"
        role="img"
        aria-label={`${field} history chart`}
      >
        {[30, 75, 120, 175].map((y) => (
          <line
            key={y}
            x1="20"
            x2="680"
            y1={y}
            y2={y}
            stroke="#26394f"
            strokeDasharray="4 5"
          />
        ))}

        <path
          d={path}
          fill="none"
          stroke={field === "temperature" ? "#63dca9" : "#5ac8ed"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="3"
            fill={field === "temperature" ? "#b1f4d2" : "#a8eaff"}
          />
        ))}
      </svg>

      <small>
        {field === "temperature"
          ? "Reactor chamber temperature"
          : "Air humidity"}
      </small>
    </div>
  );
}

/* =========================================================
   MAIN APPLICATION
========================================================= */

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

  /* Trial records are intentionally browser-side only.
     No new Firebase path is created by this code. */

  const [trials, setTrials] = useState([]);
  const [trialForm, setTrialForm] = useState({
    name: "",
    fruit: "Banana",
    mode: "Automatic",
    initialWeight: "",
    finalWeight: "",
    highestTemperature: "",
    initialHumidity: "",
    finalHumidity: "",
    dryingHours: "",
    weather: "",
    notes: "",
  });

  /* =======================================================
     FIREBASE AUTHENTICATION AND LIVE LISTENERS
  ======================================================= */

  useEffect(() => {
    let stopDevice;
    let stopHistory;
    let dead = false;

    const stopAuth = onAuthStateChanged(auth, async (user) => {
      if (dead) return;

      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          setError(err.message);
          setAuthOK(false);
        }

        return;
      }

      setAuthOK(true);

      stopDevice?.();
      stopHistory?.();

      stopDevice = onValue(
        ref(database, BASE),
        (snapshot) => {
          setDevice(snapshot.val() || {});
          setDbOK(true);
          setError("");
        },
        (err) => {
          setError(err.message);
          setDbOK(false);
        }
      );

      stopHistory = onValue(
        query(ref(database, HISTORY), limitToLast(60)),
        (snapshot) => {
          const data = snapshot.val() || {};

          const records = Object.entries(data).map(([key, value]) => ({
            key,
            ...(value || {}),
          }));

          setHistory(records);
        },
        (err) => {
          console.warn("History unavailable:", err.message);
        }
      );
    });

    return () => {
      dead = true;
      stopAuth();
      stopDevice?.();
      stopHistory?.();
    };
  }, []);

  /* =======================================================
     CURRENT DEVICE DATA
  ======================================================= */

  const sensors = device.sensors || {};
  const status = device.status || {};

  const mode = String(status.mode || "IDLE").toUpperCase();

  const paused = yes(status.paused);

  const automatic =
    yes(status.automatic) ||
    mode === "AUTO" ||
    mode === "AUTOMATIC";

  const aiMode = [
    "AI",
    "AI_ADAPTIVE",
    "AI ADAPTIVE",
  ].includes(mode);

  const fault = yes(status.safetyFault);

  const temperature = num(
    sensors.storageChamberTemperature ?? sensors.temp1
  );

  const humidity = num(sensors.humidity);

  const ambientTemperature = num(
    sensors.dht11Temperature ?? sensors.dhtTemperature
  );

  const sampleWeight = num(sensors.sampleWeightGrams);

  const aiValid = yes(sensors.aiPredictionValid);

  const aiMoisture = aiValid
    ? num(sensors.aiPredictedMoisturePercent)
    : null;

  const estimatedMoisture = num(
    sensors.estimatedMoisturePercent ??
      status.estimatedMoisturePercent
  );

  const pwm = num(status.pwm);

  const elapsed = num(status.totalElapsedSeconds);
  const remaining = num(status.totalRemainingSeconds);

  const stageElapsed = num(status.stageElapsedSeconds);
  const stageRemaining = num(status.stageRemainingSeconds);

  const endpointDetected = yes(
    sensors.endpointDetected ?? status.endpointDetected
  );

  const online = yes(status.online);
  const wifi = yes(status.wifiConnected);

  const cloudConnected = authOK && dbOK;

  const temperatureHealthy = yes(
    sensors.storageChamberTemperatureHealthy ??
      sensors.temp1Healthy ??
      status.storageChamberTemperatureHealthy ??
      status.temp1Healthy
  );

  const humidityHealthy = yes(
    sensors.humidityHealthy ?? status.humidityHealthy
  );

  const loadCellHealthy = yes(
    sensors.loadCellHealthy ?? status.loadCellHealthy
  );

  /* =======================================================
     HIGHEST AND LOWEST AVAILABLE READINGS
  ======================================================= */

  const temperatureValues = useMemo(
    () =>
      history
        .map(getTemperature)
        .filter((value) => value !== null),
    [history]
  );

  const humidityValues = useMemo(
    () =>
      history
        .map(getHumidity)
        .filter((value) => value !== null),
    [history]
  );

  const highestTemperature = Math.max(
    ...[
      temperature,
      ...temperatureValues,
      num(sensors.highestTemperature),
      num(status.highestTemperature),
    ].filter((value) => value !== null),
    -Infinity
  );

  const lowestTemperature = Math.min(
    ...[temperature, ...temperatureValues].filter(
      (value) => value !== null
    ),
    Infinity
  );

  const highestHumidity = Math.max(
    ...[humidity, ...humidityValues].filter(
      (value) => value !== null
    ),
    -Infinity
  );

  const title =
    PAGES.find((item) => item[0] === page)?.[1] || "Overview";

  /* =======================================================
     FIREBASE COMMANDS
     Keep original command path and values unchanged.
  ======================================================= */

  const sendCommand = async (command) => {
    if (pending) return;

    if (fault && command !== "STOP") {
      setFeedback(
        "Command blocked because the controller reports a safety fault."
      );
      return;
    }

    if (command === "STOP") {
      const confirmed = window.confirm(
        "Stop the current drying operation?"
      );

      if (!confirmed) return;
    }

    setPending(command);
    setFeedback("");

    try {
      await set(ref(database, CMD), command);

      setFeedback(
        `${command} command written to Firebase. Waiting for controller response.`
      );
    } catch (err) {
      setFeedback(`Command failed: ${err.message}`);
    } finally {
      setPending("");
    }
  };

  /* =======================================================
     COMMON COMMAND BUTTONS
  ======================================================= */

  const commandButtons = (
    <div className="actions">
      <button
        className="start"
        disabled={!!pending || fault}
        onClick={() => sendCommand("AUTO")}
      >
        <Zap size={16} />
        Start AUTO
      </button>

      <button
        className="ai-start"
        disabled={!!pending || fault}
        onClick={() => sendCommand("AI")}
      >
        <Gauge size={16} />
        Start AI
      </button>

      <button
        className="pause"
        disabled={!!pending || paused}
        onClick={() => sendCommand("PAUSE")}
      >
        <Activity size={16} />
        Pause
      </button>

      <button
        disabled={!!pending || !paused}
        onClick={() => sendCommand("RESUME")}
      >
        <RefreshCw size={16} />
        Resume
      </button>

      <button
        className="stop"
        disabled={!!pending}
        onClick={() => sendCommand("STOP")}
      >
        <span className="stop-square" />
        Stop
      </button>
    </div>
  );

  /* =======================================================
     STAGE STATUS
  ======================================================= */

  const currentStage = String(status.stage || "").toUpperCase();

  const stageIndex = currentStage.includes("INITIAL")
    ? 0
    : currentStage.includes("MAIN")
      ? 1
      : currentStage.includes("FINAL")
        ? 2
        : currentStage.includes("COMPLETE")
          ? 3
          : -1;

  /* =======================================================
     TRIAL MANAGEMENT
     Browser-side only. No Firebase writes.
  ======================================================= */

  const updateTrialForm = (field, value) => {
    setTrialForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const addTrial = (event) => {
    event.preventDefault();

    const initial = num(trialForm.initialWeight);
    const final = num(trialForm.finalWeight);

    if (
      !trialForm.name.trim() ||
      initial === null ||
      final === null ||
      initial <= 0 ||
      final < 0 ||
      final > initial
    ) {
      alert(
        "Enter a trial name and valid initial and final weights. Final weight cannot exceed initial weight."
      );
      return;
    }

    const reduction = ((initial - final) / initial) * 100;

    const record = {
      ...trialForm,
      initialWeight: initial,
      finalWeight: final,
      weightReduction: Number(reduction.toFixed(2)),
      highestTemperature: num(trialForm.highestTemperature),
      initialHumidity: num(trialForm.initialHumidity),
      finalHumidity: num(trialForm.finalHumidity),
      dryingHours: num(trialForm.dryingHours),
      recordedAt: new Date().toISOString(),
    };

    setTrials((previous) => [...previous, record]);

    setTrialForm({
      name: "",
      fruit: "Banana",
      mode: "Automatic",
      initialWeight: "",
      finalWeight: "",
      highestTemperature: "",
      initialHumidity: "",
      finalHumidity: "",
      dryingHours: "",
      weather: "",
      notes: "",
    });
  };

  const exportTrials = () => {
    downloadCSV(
      "SINAG-ANI-Trial-Reports.csv",
      trials.map((trial) => ({
        Trial: trial.name,
        Fruit: trial.fruit,
        Mode: trial.mode,
        InitialWeightGrams: trial.initialWeight,
        FinalWeightGrams: trial.finalWeight,
        WeightReductionPercent: trial.weightReduction,
        HighestTemperatureC: trial.highestTemperature,
        InitialHumidity: trial.initialHumidity,
        FinalHumidity: trial.finalHumidity,
        DryingHours: trial.dryingHours,
        Weather: trial.weather,
        Notes: trial.notes,
        RecordedAt: trial.recordedAt,
      }))
    );
  };

  const removeTrial = (index) => {
    if (!window.confirm("Delete this trial entry?")) return;

    setTrials((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  /* =======================================================
     HISTORY EXPORT
  ======================================================= */

  const exportHistory = () => {
    downloadCSV(
      "SINAG-ANI-Sensor-History.csv",
      history.map((record) => ({
        Timestamp:
          record.timestamp ??
          record.time ??
          record.createdAt ??
          record.key,
        ReactorTemperature: getTemperature(record),
        Humidity: getHumidity(record),
        SampleWeight: num(record.sampleWeightGrams),
        Stage: record.stage ?? "",
        Mode: record.mode ?? "",
      }))
    );
  };

  /* =======================================================
     EVENT LOGS
     Display existing history fields only.
  ======================================================= */

  const eventRecords = useMemo(
    () =>
      [...history].reverse().map((record) => ({
        id: record.key,
        time: timestampLabel(
          record.timestamp ??
            record.time ??
            record.createdAt ??
            record.key
        ),
        mode: record.mode ?? "—",
        stage: record.stage ?? "—",
        temperature: getTemperature(record),
        humidity: getHumidity(record),
        event:
          record.event ??
          record.message ??
          record.status ??
          "Sensor history record",
      })),
    [history]
  );

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const navigate = (nextPage) => {
    setPage(nextPage);
    setMobileMenu(false);
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="shell">

      {/* ================================================
          SIDEBAR
      ================================================ */}

      <aside
        className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}
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
            aria-label="Close navigation"
            onClick={() => setMobileMenu(false)}
          >
            <X size={19} />
          </button>
        </div>

        <label>SYSTEM MENU</label>

        <nav>
          {PAGES.map(([id, name, Icon]) => (
            <button
              key={id}
              className={page === id ? "selected" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              {name}
              {page === id && <i />}
            </button>
          ))}
        </nav>

        <div className="device">
          <Cpu size={18} />

          <div>
            <b>ESP32 Controller</b>
            <small>Device ID: device001</small>
          </div>
        </div>

        <div className="cloud-state">
          <i className={cloudConnected ? "online" : ""} />
          {cloudConnected
            ? "Firebase connected"
            : "Connecting to Firebase"}
        </div>
      </aside>

      {/* ================================================
          MAIN APPLICATION
      ================================================ */}

      <main>
        <header>
          <button
            className="mobile-menu-toggle"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(true)}
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
            {cloudConnected ? (
              <CheckCircle2 size={15} />
            ) : (
              <CloudOff size={15} />
            )}

            {cloudConnected
              ? "CLOUD CONNECTED"
              : "CLOUD DISCONNECTED"}
          </div>
        </header>

        <div className="content">

          {/* ==========================================
              PAGE TITLE
          ========================================== */}

          <div className="page-title">
            <div>
              <h1>
                SINAG-ANI <span>IoT Monitoring</span>
              </h1>

              <p>
                Solar food dryer · Live monitoring and adaptive drying
              </p>
            </div>

            <div className={`device-pill ${online ? "online" : ""}`}>
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

          {/* ==========================================
              OVERVIEW
          ========================================== */}

          {page === "overview" && (
            <>
              <div className="heading">
                <div>
                  <label>LIVE SYSTEM OVERVIEW</label>
                  <h2>Drying system at a glance</h2>
                  <p>
                    Reactor chamber conditions, drying progress,
                    and controller status.
                  </p>
                </div>

                <span className="live">
                  <i /> LIVE FIREBASE DATA
                </span>
              </div>

              <div className="metrics">
                <MetricCard
                  label="Reactor Temperature"
                  value={fmt(temperature, 2)}
                  unit="°C"
                  icon={Thermometer}
                  color="orange"
                  detail={
                    temperatureHealthy
                      ? "Temperature sensor healthy"
                      : "Sensor health not confirmed"
                  }
                />

                <MetricCard
                  label="Air Humidity"
                  value={fmt(humidity)}
                  unit="%"
                  icon={Droplets}
                  color="blue"
                  detail={
                    humidityHealthy
                      ? "Humidity sensor healthy"
                      : "Sensor health not confirmed"
                  }
                />

                <MetricCard
                  label="AI Predicted Moisture"
                  value={
                    aiMoisture === null
                      ? "N/A"
                      : fmt(aiMoisture)
                  }
                  unit={aiMoisture === null ? "" : "%"}
                  icon={Gauge}
                  color="purple"
                  detail={
                    aiValid
                      ? "Prediction available"
                      : "Prediction unavailable"
                  }
                />

                <MetricCard
                  label="Sample Weight"
                  value={fmt(sampleWeight, 2)}
                  unit="g"
                  icon={Leaf}
                  color="green"
                  detail={
                    loadCellHealthy
                      ? "Load cell available"
                      : "Load cell health not confirmed"
                  }
                />
              </div>

              <section className="highest-panel">
                <div className="highest-icon">
                  <Thermometer size={30} />
                </div>

                <div className="highest-info">
                  <label>TEMPERATURE PERFORMANCE</label>
                  <h3>Highest Recorded Temperature</h3>
                  <small>
                    Highest among loaded history, live reading,
                    and available stored maximum
                  </small>
                </div>

                <div className="highest-value">
                  {Number.isFinite(highestTemperature)
                    ? highestTemperature.toFixed(2)
                    : "—"}
                  <small> °C</small>
                </div>
              </section>

              <div className="columns">
                <Panel
                  label="OPERATING MODES"
                  title="Select a drying mode"
                >
                  <div className="modes">
                    <button
                      className={`mode auto ${
                        automatic ? "active" : ""
                      }`}
                      onClick={() => navigate("auto")}
                    >
                      <Wind size={22} />
                      <b>Automatic Drying</b>
                      <p>
                        Runs the configured initial, main,
                        and final drying stages.
                      </p>
                      <strong>
                        OPEN AUTOMATIC <ChevronRight size={15} />
                      </strong>
                    </button>

                    <button
                      className={`mode ai ${
                        aiMode ? "active" : ""
                      }`}
                      onClick={() => navigate("ai")}
                    >
                      <Gauge size={22} />
                      <b>AI Adaptive Drying</b>
                      <p>
                        Displays controller-reported moisture
                        prediction and AI status.
                      </p>
                      <strong>
                        OPEN AI MODE <ChevronRight size={15} />
                      </strong>
                    </button>
                  </div>

                  <div className="note">
                    <ShieldCheck size={16} />
                    The ESP32 remains responsible for hardware
                    control and safety.
                  </div>
                </Panel>

                <Panel
                  label="CONTROLLER STATUS"
                  title="Current operation"
                  action={
                    <span
                      className={`tag ${
                        fault
                          ? "danger"
                          : paused
                            ? "warn"
                            : "ok"
                      }`}
                    >
                      {fault
                        ? "SAFETY FAULT"
                        : paused
                          ? "PAUSED"
                          : "NORMAL"}
                    </span>
                  }
                >
                  <StatusRow
                    label="Operating mode"
                    value={mode}
                  />
                  <StatusRow
                    label="Drying stage"
                    value={status.stage}
                  />
                  <StatusRow
                    label="Fan output"
                    value={
                      pwm === null ? "—" : `${pwm}%`
                    }
                  />
                  <StatusRow
                    label="Cool-air fan"
                    value={yes(status.coolFan) ? "ON" : "OFF"}
                  />
                  <StatusRow
                    label="Trial number"
                    value={status.trialNumber}
                  />

                  {fault && (
                    <div className="fault">
                      <AlertTriangle size={16} />
                      {status.safetyFaultReason ||
                        "Safety fault reported by controller."}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="columns">
                <Panel
                  label="DRYING TIME"
                  title="Elapsed and remaining time"
                >
                  <div className="timers">
                    <div>
                      <small>Total elapsed</small>
                      <b>{time(elapsed)}</b>
                    </div>

                    <div>
                      <small>Total remaining</small>
                      <b>{time(remaining)}</b>
                    </div>

                    <div>
                      <small>Stage elapsed</small>
                      <b>{time(stageElapsed)}</b>
                    </div>

                    <div>
                      <small>Stage remaining</small>
                      <b>{time(stageRemaining)}</b>
                    </div>
                  </div>
                </Panel>

                <Panel
                  label="CONNECTION STATUS"
                  title="Device and cloud"
                >
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
                    connected={wifi}
                  />
                  <ConnectionRow
                    label="Device status"
                    connected={online}
                  />
                </Panel>
              </div>
            </>
          )}

          {/* ==========================================
              AUTOMATIC DRYING
          ========================================== */}

          {page === "auto" && (
            <>
              <div className="heading">
                <div>
                  <label>AUTOMATIC MODE</label>
                  <h2>Automatic drying control</h2>
                  <p>
                    The ESP32 controls the drying stages.
                    This website sends commands and displays
                    controller-reported progress.
                  </p>
                </div>
              </div>

              <section className="hero auto-hero">
                <Wind size={30} />

                <div>
                  <label>CURRENT DRYING STAGE</label>
                  <h2>{status.stage || "Waiting for controller"}</h2>
                  <p>
                    {fault
                      ? "Controller reports a safety fault."
                      : paused
                        ? "Drying is paused."
                        : automatic
                          ? "Automatic drying is active."
                          : "Automatic drying is not active."}
                  </p>
                </div>

                <div className="hero-time">
                  <small>TOTAL ELAPSED</small>
                  <b>{time(elapsed)}</b>
                </div>
              </section>

              <div className="metrics compact">
                <MetricCard
                  label="Reactor Temperature"
                  value={fmt(temperature, 2)}
                  unit="°C"
                  icon={Thermometer}
                  color="orange"
                  detail="Live reactor reading"
                />

                <MetricCard
                  label="Air Humidity"
                  value={fmt(humidity)}
                  unit="%"
                  icon={Droplets}
                  color="blue"
                  detail="Live humidity"
                />

                <MetricCard
                  label="Fan Output"
                  value={pwm === null ? "—" : pwm}
                  unit="%"
                  icon={Wind}
                  color="green"
                  detail="Controller-reported PWM"
                />
              </div>

              <Panel
                label="CONTROLLER COMMANDS"
                title="Automatic mode actions"
              >
                {commandButtons}

                {pending && (
                  <p className="feedback">
                    Sending {pending}…
                  </p>
                )}

                {feedback && (
                  <p className="feedback">{feedback}</p>
                )}

                {fault && (
                  <div className="fault">
                    <AlertTriangle size={16} />
                    Start commands are blocked while a safety
                    fault is reported.
                  </div>
                )}
              </Panel>

              <Panel
                label="STAGE PROGRESS"
                title="Controller-reported drying sequence"
              >
                <div className="stages">
                  {STAGES.map((stage, index) => (
                    <div
                      key={stage}
                      className={
                        stageIndex === index
                          ? "current"
                          : index < stageIndex
                            ? "done"
                            : ""
                      }
                    >
                      <span>{index + 1}</span>
                      <b>{stage}</b>
                    </div>
                  ))}
                </div>

                <div className="timers two">
                  <div>
                    <small>Stage elapsed</small>
                    <b>{time(stageElapsed)}</b>
                  </div>

                  <div>
                    <small>Stage remaining</small>
                    <b>{time(stageRemaining)}</b>
                  </div>
                </div>
              </Panel>
            </>
          )}

          {/* ==========================================
              AI ADAPTIVE
          ========================================== */}

          {page === "ai" && (
            <>
              <div className="heading">
                <div>
                  <label>AI ADAPTIVE MODE</label>
                  <h2>AI moisture prediction</h2>
                  <p>
                    Prediction values are read from the ESP32.
                    The website does not run a separate model.
                  </p>
                </div>
              </div>

              <section className="ai-hero">
                <div className="ai-top">
                  <Gauge size={28} />

                  <span
                    className={`tag ${
                      aiMode ? "ok" : "neutral"
                    }`}
                  >
                    {aiMode ? "AI MODE ACTIVE" : "AI MODE INACTIVE"}
                  </span>
                </div>

                <label>PREDICTED MOISTURE CONTENT</label>

                <div className="ai-number">
                  {aiMoisture === null
                    ? "N/A"
                    : aiMoisture.toFixed(2)}

                  <small>
                    {aiMoisture === null ? "" : "%"}
                  </small>
                </div>

                <p>
                  {aiValid
                    ? "The controller reports a valid prediction."
                    : "No valid AI prediction is currently reported."}
                </p>

                <div className="ai-data">
                  <div>
                    <small>Prediction status</small>
                    <b>{aiValid ? "VALID" : "UNAVAILABLE"}</b>
                  </div>

                  <div>
                    <small>Chamber temperature</small>
                    <b>{fmt(temperature, 2)} °C</b>
                  </div>

                  <div>
                    <small>Air humidity</small>
                    <b>{fmt(humidity)} %</b>
                  </div>

                  <div>
                    <small>Elapsed time</small>
                    <b>{time(elapsed)}</b>
                  </div>

                  <div>
                    <small>Target moisture</small>
                    <b>
                      {fmt(
                        status.targetMoisturePercent ??
                          sensors.targetMoisturePercent
                      )}{" "}
                      %
                    </b>
                  </div>
                </div>
              </section>

              <div className="metrics compact">
                <MetricCard
                  label="Estimated Moisture"
                  value={fmt(estimatedMoisture)}
                  unit={estimatedMoisture === null ? "" : "%"}
                  icon={Droplets}
                  color="blue"
                  detail="Reported estimate, if available"
                />

                <MetricCard
                  label="Sample Weight"
                  value={fmt(sampleWeight, 2)}
                  unit="g"
                  icon={Leaf}
                  color="green"
                  detail={
                    loadCellHealthy
                      ? "Load cell available"
                      : "Load cell health not confirmed"
                  }
                />

                <MetricCard
                  label="Endpoint Detection"
                  value={
                    endpointDetected ? "DETECTED" : "NOT DETECTED"
                  }
                  unit=""
                  icon={CheckCircle2}
                  color={endpointDetected ? "green" : "orange"}
                  detail="Controller-reported status"
                />
              </div>

              <Panel
                label="AI MODE ACTIONS"
                title="Start or manage AI drying"
              >
                {commandButtons}

                {pending && (
                  <p className="feedback">
                    Sending {pending}…
                  </p>
                )}

                {feedback && (
                  <p className="feedback">{feedback}</p>
                )}
              </Panel>

              <div className="research-note">
                <ShieldCheck size={18} />

                <div>
                  <b>Research interpretation</b>

                  <p>
                    A predicted moisture value is not proof of
                    prediction accuracy. Independent moisture
                    measurements are needed to validate model
                    performance. Predictions outside the
                    training conditions may be extrapolations.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ==========================================
              ADVANCED MONITORING
          ========================================== */}

          {page === "monitoring" && (
            <>
              <div className="heading">
                <div>
                  <label>SENSOR MONITORING</label>
                  <h2>Live sensor readings</h2>
                  <p>
                    Live device data and saved sensor history.
                  </p>
                </div>

                <button
                  className="export-button"
                  onClick={exportHistory}
                >
                  <Download size={15} />
                  Export CSV
                </button>
              </div>

              <div className="metrics">
                <MetricCard
                  label="Reactor Temperature"
                  value={fmt(temperature, 2)}
                  unit="°C"
                  icon={Thermometer}
                  color="orange"
                  detail="Current chamber reading"
                />

                <MetricCard
                  label="Ambient Temperature"
                  value={fmt(ambientTemperature, 2)}
                  unit="°C"
                  icon={Sun}
                  color="orange"
                  detail="DHT11 temperature, if available"
                />

                <MetricCard
                  label="Air Humidity"
                  value={fmt(humidity)}
                  unit="%"
                  icon={Droplets}
                  color="blue"
                  detail="Current humidity reading"
                />

                <MetricCard
                  label="Sample Weight"
                  value={fmt(sampleWeight, 2)}
                  unit="g"
                  icon={Leaf}
                  color="green"
                  detail="Current load-cell reading"
                />
              </div>

              <Panel
                label="TEMPERATURE TREND"
                title="Reactor chamber history"
              >
                <HistoryChart
                  records={history}
                  field="temperature"
                />
              </Panel>

              <Panel
                label="HUMIDITY TREND"
                title="Air humidity history"
              >
                <HistoryChart
                  records={history}
                  field="humidity"
                />
              </Panel>

              <div className="columns">
                <Panel
                  label="TEMPERATURE RECORD"
                  title="Available temperature extremes"
                >
                  <StatusRow
                    label="Highest available"
                    value={
                      Number.isFinite(highestTemperature)
                        ? `${highestTemperature.toFixed(2)} °C`
                        : "—"
                    }
                  />

                  <StatusRow
                    label="Lowest loaded"
                    value={
                      Number.isFinite(lowestTemperature)
                        ? `${lowestTemperature.toFixed(2)} °C`
                        : "—"
                    }
                  />

                  <StatusRow
                    label="Highest humidity"
                    value={
                      Number.isFinite(highestHumidity)
                        ? `${highestHumidity.toFixed(1)} %`
                        : "—"
                    }
                  />
                </Panel>

                <Panel
                  label="SENSOR HEALTH"
                  title="Measurement availability"
                >
                  <ConnectionRow
                    label="Reactor temperature"
                    connected={temperatureHealthy}
                  />

                  <ConnectionRow
                    label="Humidity sensor"
                    connected={humidityHealthy}
                  />

                  <ConnectionRow
                    label="Load cell"
                    connected={loadCellHealthy}
                  />

                  <ConnectionRow
                    label="HX711 ready"
                    connected={yes(
                      sensors.hx711Ready ?? status.hx711Ready
                    )}
                  />
                </Panel>
              </div>
            </>
          )}

          {/* ==========================================
              TRIAL REPORTS
          ========================================== */}

          {page === "trials" && (
            <>
              <div className="heading">
                <div>
                  <label>RESEARCH DATA MANAGEMENT</label>
                  <h2>Trial management and reports</h2>
                  <p>
                    Record experimental results and compare
                    drying performance.
                  </p>
                </div>

                <button
                  className="export-button"
                  onClick={exportTrials}
                >
                  <Download size={15} />
                  Export trials
                </button>
              </div>

              <div className="metrics compact">
                <MetricCard
                  label="Recorded Trials"
                  value={trials.length}
                  unit=""
                  icon={ClipboardList}
                  color="blue"
                  detail="Entries in this browser session"
                />

                <MetricCard
                  label="Average Weight Reduction"
                  value={
                    trials.length
                      ? (
                          trials.reduce(
                            (sum, trial) =>
                              sum + trial.weightReduction,
                            0
                          ) / trials.length
                        ).toFixed(2)
                      : "—"
                  }
                  unit={trials.length ? "%" : ""}
                  icon={Leaf}
                  color="green"
                  detail="Based on entered trials"
                />

                <MetricCard
                  label="Average Drying Time"
                  value={
                    trials.filter(
                      (trial) => trial.dryingHours !== null
                    ).length
                      ? (
                          trials.reduce(
                            (sum, trial) =>
                              sum + (trial.dryingHours || 0),
                            0
                          ) /
                          trials.filter(
                            (trial) => trial.dryingHours !== null
                          ).length
                        ).toFixed(2)
                      : "—"
                  }
                  unit="hours"
                  icon={Clock3}
                  color="orange"
                  detail="Based on entered trials"
                />
              </div>

              <Panel
                label="NEW RESEARCH RECORD"
                title="Add a drying trial"
              >
                <form className="trial-form" onSubmit={addTrial}>
                  <label>
                    Trial name
                    <input
                      required
                      value={trialForm.name}
                      onChange={(event) =>
                        updateTrialForm("name", event.target.value)
                      }
                      placeholder="Example: Trial 4"
                    />
                  </label>

                  <label>
                    Sample
                    <select
                      value={trialForm.fruit}
                      onChange={(event) =>
                        updateTrialForm("fruit", event.target.value)
                      }
                    >
                      <option>Banana</option>
                      <option>Mango</option>
                      <option>Pineapple</option>
                      <option>Other</option>
                    </select>
                  </label>

                  <label>
                    Drying mode
                    <select
                      value={trialForm.mode}
                      onChange={(event) =>
                        updateTrialForm("mode", event.target.value)
                      }
                    >
                      <option>Automatic</option>
                      <option>AI Adaptive</option>
                      <option>Manual</option>
                    </select>
                  </label>

                  <label>
                    Initial weight (g)
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={trialForm.initialWeight}
                      onChange={(event) =>
                        updateTrialForm(
                          "initialWeight",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Final weight (g)
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={trialForm.finalWeight}
                      onChange={(event) =>
                        updateTrialForm(
                          "finalWeight",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Highest temperature (°C)
                    <input
                      type="number"
                      step="any"
                      value={trialForm.highestTemperature}
                      onChange={(event) =>
                        updateTrialForm(
                          "highestTemperature",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Initial humidity (%)
                    <input
                      type="number"
                      step="any"
                      value={trialForm.initialHumidity}
                      onChange={(event) =>
                        updateTrialForm(
                          "initialHumidity",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Final humidity (%)
                    <input
                      type="number"
                      step="any"
                      value={trialForm.finalHumidity}
                      onChange={(event) =>
                        updateTrialForm(
                          "finalHumidity",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Drying duration (hours)
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={trialForm.dryingHours}
                      onChange={(event) =>
                        updateTrialForm(
                          "dryingHours",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Weather condition
                    <input
                      value={trialForm.weather}
                      onChange={(event) =>
                        updateTrialForm("weather", event.target.value)
                      }
                      placeholder="Sunny, cloudy, rainy..."
                    />
                  </label>

                  <label className="full-field">
                    Observation
                    <textarea
                      rows="3"
                      value={trialForm.notes}
                      onChange={(event) =>
                        updateTrialForm("notes", event.target.value)
                      }
                      placeholder="Record experimental observations..."
                    />
                  </label>

                  <button
                    className="start trial-submit"
                    type="submit"
                  >
                    <Plus size={16} />
                    Add trial record
                  </button>
                </form>

                <p className="form-notice">
                  These entries are stored only in the current
                  browser session. Export them before refreshing
                  or closing the page.
                </p>
              </Panel>

              <Panel
                label="EXPERIMENTAL RESULTS"
                title="Recorded drying trials"
              >
                {trials.length === 0 ? (
                  <EmptyState message="No trial entries yet. Add your first research trial above." />
                ) : (
                  <div className="table-scroll">
                    <table className="trial-table">
                      <thead>
                        <tr>
                          <th>Trial</th>
                          <th>Sample</th>
                          <th>Mode</th>
                          <th>Initial (g)</th>
                          <th>Final (g)</th>
                          <th>Reduction</th>
                          <th>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {trials.map((trial, index) => (
                          <tr key={`${trial.recordedAt}-${index}`}>
                            <td>{trial.name}</td>
                            <td>{trial.fruit}</td>
                            <td>{trial.mode}</td>
                            <td>{trial.initialWeight}</td>
                            <td>{trial.finalWeight}</td>
                            <td>{trial.weightReduction}%</td>
                            <td>
                              <button
                                className="delete-button"
                                aria-label={`Delete ${trial.name}`}
                                onClick={() => removeTrial(index)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          )}

          {/* ==========================================
              SYSTEM LOGS
          ========================================== */}

          {page === "logs" && (
            <>
              <div className="heading">
                <div>
                  <label>SYSTEM DIAGNOSTICS</label>
                  <h2>System logs and event history</h2>
                  <p>
                    Review saved history records and current
                    device connection status.
                  </p>
                </div>

                <button
                  className="export-button"
                  onClick={exportHistory}
                >
                  <Download size={15} />
                  Export logs
                </button>
              </div>

              <div className="metrics">
                <MetricCard
                  label="Device"
                  value={online ? "ONLINE" : "OFFLINE"}
                  unit=""
                  icon={Cpu}
                  color={online ? "green" : "orange"}
                  detail="Controller-reported status"
                />

                <MetricCard
                  label="Wi-Fi"
                  value={wifi ? "CONNECTED" : "OFFLINE"}
                  unit=""
                  icon={Wifi}
                  color="blue"
                  detail="Controller-reported status"
                />

                <MetricCard
                  label="Safety"
                  value={fault ? "FAULT" : "NORMAL"}
                  unit=""
                  icon={ShieldCheck}
                  color={fault ? "orange" : "green"}
                  detail="Controller-reported status"
                />

                <MetricCard
                  label="History Records"
                  value={history.length}
                  unit=""
                  icon={History}
                  color="purple"
                  detail="Latest records loaded"
                />
              </div>

              <div className="columns">
                <Panel
                  label="DEVICE DIAGNOSTICS"
                  title="Connection and sensor health"
                >
                  <ConnectionRow
                    label="Firebase authentication"
                    connected={authOK}
                  />

                  <ConnectionRow
                    label="Realtime database"
                    connected={dbOK}
                  />

                  <ConnectionRow
                    label="ESP32 online"
                    connected={online}
                  />

                  <ConnectionRow
                    label="Wi-Fi connection"
                    connected={wifi}
                  />

                  <ConnectionRow
                    label="Temperature sensor"
                    connected={temperatureHealthy}
                  />

                  <ConnectionRow
                    label="Humidity sensor"
                    connected={humidityHealthy}
                  />

                  <ConnectionRow
                    label="Load cell"
                    connected={loadCellHealthy}
                  />
                </Panel>

                <Panel
                  label="CURRENT CONTROLLER STATE"
                  title="Operating diagnostics"
                >
                  <StatusRow label="Mode" value={mode} />

                  <StatusRow
                    label="Stage"
                    value={status.stage}
                  />

                  <StatusRow
                    label="Fan output"
                    value={
                      pwm === null ? "—" : `${pwm}%`
                    }
                  />

                  <StatusRow
                    label="Elapsed time"
                    value={time(elapsed)}
                  />

                  <StatusRow
                    label="Endpoint detection"
                    value={
                      endpointDetected ? "DETECTED" : "NOT DETECTED"
                    }
                  />

                  <StatusRow
                    label="Safety fault"
                    value={fault ? "ACTIVE" : "NOT REPORTED"}
                  />
                </Panel>
              </div>

              <Panel
                label="SAVED DEVICE HISTORY"
                title="Available event and sensor records"
              >
                {eventRecords.length === 0 ? (
                  <EmptyState message="No history records are currently available." />
                ) : (
                  <div className="event-list">
                    {eventRecords.map((event) => (
                      <article
                        className="event-item"
                        key={event.id}
                      >
                        <div className="event-icon">
                          <Activity size={16} />
                        </div>

                        <div className="event-content">
                          <b>{event.event}</b>

                          <small>{event.time}</small>

                          <p>
                            Mode: {event.mode} · Stage: {event.stage}
                          </p>

                          <p>
                            Temperature: {fmt(event.temperature, 2)} °C
                            {" · "}
                            Humidity: {fmt(event.humidity)} %
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </Panel>

              <div className="research-note">
                <ShieldCheck size={18} />

                <div>
                  <b>Log limitations</b>

                  <p>
                    The event list displays fields found in the
                    existing history records. It does not invent
                    start, pause, fault, or completion events if
                    the ESP32 has not saved them.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ==========================================
              FOOTER
          ========================================== */}

          <footer>
            <span>
              © SINAG-ANI · Solar Food Dryer Research Project
            </span>

            <span>
              Live source: Firebase · devices/device001
            </span>
          </footer>
        </div>
      </main>

      {/* ================================================
          MOBILE NAVIGATION
      ================================================ */}

      <nav className="mobile-nav">
        {PAGES.map(([id, name, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={18} />

            <span>
              {name === "Automatic"
                ? "AUTO"
                : name === "AI Adaptive"
                  ? "AI"
                  : name === "Trial Reports"
                    ? "TRIALS"
                    : name === "System Logs"
                      ? "LOGS"
                      : name}
            </span>
          </button>
        ))}
      </nav>

      {/* Mobile sidebar backdrop */}
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
    </div>
  );
}

export default App;
