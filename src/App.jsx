
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
  Droplets,
  Gauge,
  Home,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Sun,
  Thermometer,
  Wind,
  Zap,
  Wifi,
  WifiOff,
  Scale,
  BrainCircuit,
  Menu,
  X
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
  onAuthStateChanged
} from "./firebase/firebaseConfig";

const BASE = "devices/device001";
const COMMAND_PATH = `${BASE}/control/mode`;

const PAGES = [
  ["overview", "Overview", Home],
  ["auto", "Automatic", Wind],
  ["ai", "AI Adaptive", BrainCircuit],
  ["monitoring", "Monitoring", BarChart3]
];

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
  return result === null ? "—" : result.toFixed(decimals);
};

const formatTime = (seconds) => {
  const value = numberValue(seconds);

  if (value === null || value < 0) return "--:--:--";

  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  return [hours, minutes, secs]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const getHistoryTimestamp = (record) => {
  const value =
    record.timestamp ??
    record.time ??
    record.createdAt ??
    record.epoch ??
    null;

  const parsed = numberValue(value);

  if (parsed !== null) {
    return new Date(parsed < 1000000000000 ? parsed * 1000 : parsed);
  }

  return null;
};

function MetricCard({
  label,
  value,
  unit,
  Icon,
  color,
  detail
}) {
  return (
    <article className={`metric-card ${color || ""}`}>
      <div className="metric-heading">
        <span className="metric-icon">
          <Icon size={19} />
        </span>
        <span>{label}</span>
      </div>

      <div className="metric-reading">
        {value}
        {unit && <small>{unit}</small>}
      </div>

      {detail && <p className="metric-detail">{detail}</p>}
    </article>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function ConnectionRow({ label, connected }) {
  return (
    <div className="connection-row">
      <span>{label}</span>
      <strong className={connected ? "connected" : "disconnected"}>
        <i />
        {connected ? "Connected" : "Unavailable"}
      </strong>
    </div>
  );
}

function HistoryChart({
  title,
  subtitle,
  data,
  color,
  unit,
  decimals = 1,
  Icon,
  emptyMessage
}) {
  const validData = data.filter(
    (item) => numberValue(item.value) !== null
  );

  if (!validData.length) {
    return (
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">HISTORICAL DATA</span>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <Icon size={21} />
        </div>

        <div className="chart-empty">
          <BarChart3 size={30} />
          <strong>No historical readings available</strong>
          <p>{emptyMessage}</p>
        </div>
      </section>
    );
  }

  const values = validData.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const padding = Math.max((max - min) * 0.2, unit === "°C" ? 1 : 2);
  const lower = min - padding;
  const upper = max + padding;
  const range = upper - lower || 1;

  const width = 720;
  const height = 260;
  const left = 58;
  const right = 20;
  const top = 20;
  const bottom = 42;
  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const points = validData.map((item, index) => {
    const x =
      left +
      (index / Math.max(validData.length - 1, 1)) * graphWidth;

    const y =
      top +
      ((upper - item.value) / range) * graphHeight;

    return { x, y, ...item };
  });

  const path = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath = [
    path,
    `L ${points[points.length - 1].x} ${height - bottom}`,
    `L ${points[0].x} ${height - bottom}`,
    "Z"
  ].join(" ");

  const gridValues = [0, 1, 2, 3, 4].map(
    (index) => upper - (range * index) / 4
  );

  const latest = validData[validData.length - 1].value;

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">HISTORICAL DATA</span>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <Icon size={21} />
      </div>

      <div className="chart-summary">
        <div>
          <span>Latest reading</span>
          <strong>
            {latest.toFixed(decimals)}
            {unit}
          </strong>
        </div>

        <div>
          <span>Highest</span>
          <strong>
            {max.toFixed(decimals)}
            {unit}
          </strong>
        </div>

        <div>
          <span>Lowest</span>
          <strong>
            {min.toFixed(decimals)}
            {unit}
          </strong>
        </div>
      </div>

      <div className="chart-scroll">
        <svg
          className="history-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} history chart`}
        >
          {gridValues.map((value, index) => {
            const y = top + (index / 4) * graphHeight;

            return (
              <g key={index}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  className="chart-grid-line"
                />
                <text
                  x={left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="chart-axis-label"
                >
                  {value.toFixed(decimals)}
                </text>
              </g>
            );
          })}

          <path
            d={areaPath}
            fill={color}
            opacity="0.10"
          />

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
              r={validData.length > 30 ? 2.5 : 4}
              fill={color}
              stroke="#101b2a"
              strokeWidth="2"
            >
              <title>
                {point.label || `Reading ${index + 1}`}:{" "}
                {point.value.toFixed(decimals)}
                {unit}
              </title>
            </circle>
          ))}

          <text
            x={left}
            y={height - 12}
            className="chart-axis-label"
          >
            Older readings
          </text>

          <text
            x={width - right}
            y={height - 12}
            textAnchor="end"
            className="chart-axis-label"
          >
            Latest readings
          </text>
        </svg>
      </div>

      <div className="chart-footer">
        <span>
          <i style={{ background: color }} />
          {title}
        </span>
        <span>{validData.length} saved readings</span>
      </div>
    </section>
  );
}

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

  // Firebase authentication and database listeners
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
            ref(database, `${BASE}/history`),
            limitToLast(60)
          ),
          (snapshot) => {
            if (disposed) return;

            const records = snapshot.val() || {};

            const rows = Object.entries(records).map(
              ([key, value]) => ({
                key,
                ...(value || {})
              })
            );

            setHistory(rows);
          },
          (firebaseError) => {
            if (!disposed) {
              console.warn(
                "History listener failed:",
                firebaseError.message
              );
            }
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

  // Send command to the main ESP32 through Firebase
  const sendCommand = async (command) => {
    setPending(command);
    setFeedback("");

    try {
      await set(ref(database, COMMAND_PATH), command);

      setFeedback(
        `${command} command sent to Firebase. Waiting for controller status.`
      );
    } catch (commandError) {
      setFeedback(
        `Command failed: ${commandError.message}`
      );
    } finally {
      setPending("");
    }
  };

  const sensors = device.sensors || {};
  const status = device.status || {};

  const mode = String(status.mode || "IDLE").toUpperCase();

  const paused = isTrue(status.paused);

  const automatic =
    isTrue(status.automatic) ||
    mode === "AUTO" ||
    mode === "AUTOMATIC";

  const aiMode = [
    "AI",
    "AI_ADAPTIVE",
    "AI ADAPTIVE"
  ].includes(mode);

  const safetyFault = isTrue(status.safetyFault);

  const temperature = numberValue(
    sensors.storageChamberTemperature ?? sensors.temp1
  );

  const humidity = numberValue(sensors.humidity);

  const ambientTemperature = numberValue(
    sensors.dht11Temperature ?? sensors.dhtTemperature
  );

  const weight = numberValue(sensors.sampleWeightGrams);

  const aiValid = isTrue(sensors.aiPredictionValid);

  const aiMoisture = aiValid
    ? numberValue(sensors.aiPredictedMoisturePercent)
    : null;

  const estimatedMoisture = numberValue(
    sensors.estimatedMoisturePercent ??
    status.estimatedMoisturePercent
  );

  const pwm = numberValue(status.pwm);

  const elapsed = numberValue(status.totalElapsedSeconds);
  const remaining = numberValue(status.totalRemainingSeconds);
  const stageElapsed = numberValue(status.stageElapsedSeconds);
  const stageRemaining = numberValue(status.stageRemainingSeconds);

  const endpointDetected = isTrue(
    sensors.endpointDetected ?? status.endpointDetected
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
    sensors.humidityHealthy ?? status.humidityHealthy
  );

  const weightHealthy = isTrue(
    sensors.loadCellHealthy ?? status.loadCellHealthy
  );

  const stage = String(status.stage || "Waiting for controller");

  const title =
    PAGES.find((item) => item[0] === page)?.[1] || "Overview";

  // Prepare temperature and humidity chart records
  const temperatureHistory = useMemo(
    () =>
      history
        .map((record, index) => ({
          value: numberValue(
            record.storageChamberTemperature ??
            record.temp1 ??
            record.temperature ??
            record.temp
          ),
          label: record.key || `Reading ${index + 1}`,
          timestamp: getHistoryTimestamp(record)
        }))
        .filter((record) => record.value !== null),
    [history]
  );

  const humidityHistory = useMemo(
    () =>
      history
        .map((record, index) => ({
          value: numberValue(
            record.humidity ??
            record.relativeHumidity ??
            record.humidityPercent
          ),
          label: record.key || `Reading ${index + 1}`,
          timestamp: getHistoryTimestamp(record)
        }))
        .filter((record) => record.value !== null),
    [history]
  );

  const highestTemperature = useMemo(() => {
    const values = temperatureHistory.map((item) => item.value);

    if (temperature !== null) values.push(temperature);

    return values.length ? Math.max(...values) : null;
  }, [temperatureHistory, temperature]);

  const command = (value) => {
    if (safetyFault && value !== "STOP") {
      setFeedback(
        "Command blocked because a safety fault is active."
      );
      return;
    }

    sendCommand(value);
  };

  const actionButtons = (
    <div className="action-buttons">
      <button
        className="button button-primary"
        disabled={!!pending || safetyFault}
        onClick={() => command("AUTO")}
      >
        <Zap size={17} />
        Start AUTO
      </button>

      <button
        className="button button-warning"
        disabled={!!pending || paused}
        onClick={() => command("PAUSE")}
      >
        <Activity size={17} />
        Pause
      </button>

      <button
        className="button button-secondary"
        disabled={!!pending || !paused}
        onClick={() => command("RESUME")}
      >
        <RefreshCw size={17} />
        Resume
      </button>

      <button
        className="button button-danger"
        disabled={!!pending}
        onClick={() => command("STOP")}
      >
        <span className="stop-square" />
        Stop
      </button>
    </div>
  );

  const aiActionButtons = (
    <div className="action-buttons">
      <button
        className="button button-ai"
        disabled={!!pending || safetyFault}
        onClick={() => command("AI")}
      >
        <BrainCircuit size={17} />
        Start AI
      </button>

      <button
        className="button button-warning"
        disabled={!!pending || paused}
        onClick={() => command("PAUSE")}
      >
        <Activity size={17} />
        Pause
      </button>

      <button
        className="button button-secondary"
        disabled={!!pending || !paused}
        onClick={() => command("RESUME")}
      >
        <RefreshCw size={17} />
        Resume
      </button>

      <button
        className="button button-danger"
        disabled={!!pending}
        onClick={() => command("STOP")}
      >
        <span className="stop-square" />
        Stop
      </button>
    </div>
  );

  const showFeedback = (
    <>
      {pending && (
        <p className="command-feedback">
          Sending {pending} command...
        </p>
      )}

      {feedback && (
        <p className="command-feedback">
          {feedback}
        </p>
      )}
    </>
  );

  const selectPage = (nextPage) => {
    setPage(nextPage);
    setMobileMenu(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <Sun size={23} />
            <Leaf size={12} />
          </div>

          <div>
            <strong>SINAG-ANI</strong>
            <small>SOLAR FOOD DRYER</small>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={21} />
          </button>
        </div>

        <div className="sidebar-label">SYSTEM MENU</div>

        <nav className="sidebar-navigation">
          {PAGES.map(([id, name, Icon]) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => selectPage(id)}
            >
              <Icon size={19} />
              <span>{name}</span>

              {page === id && <i className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-device">
          <div className="device-icon">
            <Zap size={18} />
          </div>

          <div>
            <strong>ESP32 Controller</strong>
            <small>Device ID: device001</small>
          </div>
        </div>

        <div className="sidebar-connection">
          <span className={`connection-dot ${cloudConnected ? "online" : ""}`} />
          <span>
            {cloudConnected
              ? "Firebase connected"
              : "Connecting to Firebase"}
          </span>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenu(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={15} />
            <strong>{title}</strong>
          </div>

          <div className={`top-connection ${cloudConnected ? "connected" : ""}`}>
            {cloudConnected
              ? <Cloud size={16} />
              : <CloudOff size={16} />}

            {cloudConnected
              ? "CLOUD CONNECTED"
              : "CLOUD DISCONNECTED"}
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">SINAG-ANI RESEARCH SYSTEM</span>
              <h1>
                SINAG-ANI <span>IoT Monitoring</span>
              </h1>
              <p>
                Solar food dryer · Live monitoring and adaptive drying
              </p>
            </div>

            <div className={`device-status ${online ? "online" : ""}`}>
              <i />
              {online ? "DEVICE ONLINE" : "DEVICE OFFLINE"}
            </div>
          </section>

          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {safetyFault && (
            <div className="fault-banner">
              <AlertTriangle size={19} />
              <div>
                <strong>Safety fault reported by controller</strong>
                <p>
                  {status.safetyFaultReason ||
                    "Check the drying system before restarting."}
                </p>
              </div>
            </div>
          )}

          {/* OVERVIEW PAGE */}
          {page === "overview" && (
            <>
              <section className="section-heading">
                <div>
                  <span className="eyebrow">LIVE SYSTEM OVERVIEW</span>
                  <h2>Drying system at a glance</h2>
                  <p>
                    Reactor chamber conditions, drying progress,
                    and controller status.
                  </p>
                </div>

                <span className="live-indicator">
                  <i />
                  LIVE FIREBASE DATA
                </span>
              </section>

              <div className="metrics-grid">
                <MetricCard
                  label="Reactor Temperature"
                  value={formatNumber(temperature)}
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
                  value={formatNumber(weight)}
                  unit="g"
                  Icon={Scale}
                  color="green"
                  detail={
                    weightHealthy
                      ? "Load cell available"
                      : "Load cell unavailable"
                  }
                />
              </div>

              <div className="content-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">OPERATING MODES</span>
                      <h3>Drying system operation</h3>
                    </div>
                    <span className="panel-caption">
                      Manual mode excluded
                    </span>
                  </div>

                  <div className="mode-grid">
                    <button
                      className="mode-card mode-auto"
                      onClick={() => selectPage("auto")}
                    >
                      <Wind size={25} />
                      <strong>Automatic Drying</strong>
                      <p>
                        Runs the configured initial, main,
                        and final drying stages.
                      </p>
                      <span>
                        OPEN AUTOMATIC <ChevronRight size={15} />
                      </span>
                    </button>

                    <button
                      className="mode-card mode-ai"
                      onClick={() => selectPage("ai")}
                    >
                      <BrainCircuit size={25} />
                      <strong>AI Adaptive Drying</strong>
                      <p>
                        Displays moisture prediction and
                        AI controller status.
                      </p>
                      <span>
                        OPEN AI MODE <ChevronRight size={15} />
                      </span>
                    </button>
                  </div>

                  <div className="information-note">
                    <ShieldCheck size={17} />
                    The main ESP32 remains responsible for fan
                    control, timing, and hardware safety.
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">CONTROLLER STATUS</span>
                      <h3>Current operation</h3>
                    </div>

                    <span className={`status-tag ${
                      safetyFault ? "tag-danger" :
                      paused ? "tag-warning" : "tag-success"
                    }`}>
                      {safetyFault
                        ? "SAFETY FAULT"
                        : paused
                          ? "PAUSED"
                          : "NORMAL"}
                    </span>
                  </div>

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

                  <StatusRow label="Drying stage" value={stage} />

                  <StatusRow
                    label="Fan output"
                    value={pwm === null ? "—" : `${pwm}%`}
                  />

                  <StatusRow
                    label="Cool-air fan"
                    value={isTrue(status.coolFan) ? "ON" : "OFF"}
                  />

                  <StatusRow
                    label="Trial number"
                    value={numberValue(status.trialNumber) ?? "—"}
                  />
                </section>
              </div>

              <div className="content-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">DRYING TIME</span>
                      <h3>Elapsed and remaining time</h3>
                    </div>
                    <Clock3 size={20} />
                  </div>

                  <div className="timer-grid">
                    <div className="timer-card">
                      <span>Total elapsed</span>
                      <strong>{formatTime(elapsed)}</strong>
                    </div>

                    <div className="timer-card">
                      <span>Total remaining</span>
                      <strong>{formatTime(remaining)}</strong>
                    </div>

                    <div className="timer-card">
                      <span>Stage elapsed</span>
                      <strong>{formatTime(stageElapsed)}</strong>
                    </div>

                    <div className="timer-card">
                      <span>Stage remaining</span>
                      <strong>{formatTime(stageRemaining)}</strong>
                    </div>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">CONNECTION STATUS</span>
                      <h3>Device and cloud</h3>
                    </div>
                    <Cloud size={20} />
                  </div>

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
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">TEMPERATURE SUMMARY</span>
                    <h3>Reactor chamber performance</h3>
                  </div>
                  <Thermometer size={20} />
                </div>

                <div className="summary-grid">
                  <div>
                    <span>Current temperature</span>
                    <strong>
                      {formatNumber(temperature)}°C
                    </strong>
                  </div>

                  <div>
                    <span>Highest saved temperature</span>
                    <strong>
                      {formatNumber(highestTemperature)}°C
                    </strong>
                  </div>

                  <div>
                    <span>Current humidity</span>
                    <strong>
                      {formatNumber(humidity)}%
                    </strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* AUTOMATIC PAGE */}
          {page === "auto" && (
            <>
              <section className="section-heading">
                <div>
                  <span className="eyebrow">AUTOMATIC MODE</span>
                  <h2>Automatic drying control</h2>
                  <p>
                    The main ESP32 controls the drying stages.
                    This website sends commands and displays reported progress.
                  </p>
                </div>
              </section>

              <section className="hero-panel auto-hero">
                <div className="hero-icon">
                  <Wind size={30} />
                </div>

                <div className="hero-description">
                  <span className="eyebrow">CURRENT DRYING STAGE</span>
                  <h2>{stage}</h2>
                  <p>
                    {paused
                      ? "Drying is paused."
                      : automatic
                        ? "Automatic drying is active."
                        : "Automatic drying is not active."}
                  </p>
                </div>

                <div className="hero-timer">
                  <span>TOTAL ELAPSED</span>
                  <strong>{formatTime(elapsed)}</strong>
                </div>
              </section>

              <div className="metrics-grid three-columns">
                <MetricCard
                  label="Reactor Temperature"
                  value={formatNumber(temperature)}
                  unit="°C"
                  Icon={Thermometer}
                  color="orange"
                  detail="Live chamber temperature"
                />

                <MetricCard
                  label="Air Humidity"
                  value={formatNumber(humidity)}
                  unit="%"
                  Icon={Droplets}
                  color="blue"
                  detail="Live humidity"
                />

                <MetricCard
                  label="Sample Weight"
                  value={formatNumber(weight)}
                  unit="g"
                  Icon={Scale}
                  color="green"
                  detail="Load-cell reading"
                />
              </div>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">CONTROLLER COMMANDS</span>
                    <h3>Automatic mode actions</h3>
                  </div>
                  <span className="panel-caption">
                    Firebase → ESP32
                  </span>
                </div>

                {actionButtons}
                {showFeedback}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">DRYING STAGE PROGRESS</span>
                    <h3>Controller-reported sequence</h3>
                  </div>
                </div>

                <div className="stage-timeline">
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
                          className={`stage-item ${
                            activeIndex === index
                              ? "current"
                              : activeIndex > index
                                ? "completed"
                                : ""
                          }`}
                        >
                          <span>{index + 1}</span>
                          <strong>{item}</strong>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="timer-grid two-columns">
                  <div className="timer-card">
                    <span>Stage elapsed</span>
                    <strong>{formatTime(stageElapsed)}</strong>
                  </div>

                  <div className="timer-card">
                    <span>Stage remaining</span>
                    <strong>{formatTime(stageRemaining)}</strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* AI PAGE */}
          {page === "ai" && (
            <>
              <section className="section-heading">
                <div>
                  <span className="eyebrow">AI ADAPTIVE MODE</span>
                  <h2>AI moisture prediction</h2>
                  <p>
                    Prediction and validity are read from the main ESP32.
                    The website does not run a separate model.
                  </p>
                </div>
              </section>

              <section className="ai-prediction-panel">
                <div className="ai-panel-top">
                  <div className="ai-heading-icon">
                    <BrainCircuit size={27} />
                  </div>

                  <span className={`status-tag ${
                    aiMode ? "tag-success" : "tag-neutral"
                  }`}>
                    {aiMode ? "AI MODE ACTIVE" : "AI MODE INACTIVE"}
                  </span>
                </div>

                <span className="eyebrow">
                  PREDICTED MOISTURE CONTENT
                </span>

                <div className="ai-number">
                  {aiMoisture === null
                    ? "N/A"
                    : formatNumber(aiMoisture)}
                  {aiMoisture !== null && <small>%</small>}
                </div>

                <p>
                  {aiValid
                    ? "The controller reports a valid model output."
                    : "The controller has not reported a valid prediction for the current inputs."}
                </p>

                <div className="ai-information-grid">
                  <div>
                    <span>Prediction status</span>
                    <strong>
                      {aiValid ? "VALID OUTPUT" : "NOT AVAILABLE"}
                    </strong>
                  </div>

                  <div>
                    <span>Chamber temperature</span>
                    <strong>{formatNumber(temperature, 2)} °C</strong>
                  </div>

                  <div>
                    <span>Air humidity</span>
                    <strong>{formatNumber(humidity)} %</strong>
                  </div>

                  <div>
                    <span>Elapsed time</span>
                    <strong>{formatTime(elapsed)}</strong>
                  </div>

                  <div>
                    <span>Target moisture</span>
                    <strong>
                      {formatNumber(
                        status.targetMoisturePercent ??
                        sensors.targetMoisturePercent
                      )} %
                    </strong>
                  </div>

                  <div>
                    <span>Endpoint detection</span>
                    <strong>
                      {endpointDetected ? "DETECTED" : "NOT DETECTED"}
                    </strong>
                  </div>
                </div>
              </section>

              <div className="metrics-grid three-columns">
                <MetricCard
                  label="Measured Moisture Estimate"
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
                  unit=""
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
                  value={endpointDetected ? "DETECTED" : "NOT DETECTED"}
                  unit=""
                  Icon={CheckCircle2}
                  color={endpointDetected ? "green" : "orange"}
                  detail="Controller-reported status"
                />
              </div>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">AI MODE ACTIONS</span>
                    <h3>Start or manage AI drying</h3>
                  </div>

                  <span className="panel-caption">
                    ESP32 remains in control
                  </span>
                </div>

                {aiActionButtons}
                {showFeedback}
              </section>

              <div className="research-note">
                <ShieldCheck size={20} />
                <div>
                  <strong>Research interpretation</strong>
                  <p>
                    Predictions outside the source dataset's measured
                    conditions are experimental extrapolations.
                    A displayed estimate is not proof of accuracy;
                    independent moisture measurements are required
                    for validation.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* MONITORING PAGE */}
          {page === "monitoring" && (
            <>
              <section className="section-heading">
                <div>
                  <span className="eyebrow">SENSOR MONITORING</span>
                  <h2>Live sensor readings</h2>
                  <p>
                    Readings are taken from the SINAG-ANI device
                    node in Firebase Realtime Database.
                  </p>
                </div>

                <span className="live-indicator">
                  <i />
                  LIVE DATA
                </span>
              </section>

              <div className="metrics-grid">
                <MetricCard
                  label="Reactor Chamber Temperature"
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
                  label="DHT11 Air Temperature"
                  value={formatNumber(ambientTemperature)}
                  unit="°C"
                  Icon={Sun}
                  color="orange"
                  detail="Ambient air temperature"
                />

                <MetricCard
                  label="Air Humidity"
                  value={formatNumber(humidity)}
                  unit="%"
                  Icon={Droplets}
                  color="blue"
                  detail={
                    humidityHealthy
                      ? "Sensor healthy"
                      : "Sensor unavailable"
                  }
                />

                <MetricCard
                  label="Sample Weight"
                  value={formatNumber(weight, 2)}
                  unit="g"
                  Icon={Scale}
                  color="green"
                  detail={
                    weightHealthy
                      ? "Load cell healthy"
                      : "Load cell unavailable"
                  }
                />
              </div>

              <HistoryChart
                title="Reactor Chamber Temperature"
                subtitle="Temperature changes throughout the drying process"
                data={temperatureHistory}
                color="#F59E0B"
                unit="°C"
                decimals={1}
                Icon={Thermometer}
                emptyMessage="No supported temperature history field was found. Check the fields saved by your ESP32 history function."
              />

              <HistoryChart
                title="Relative Humidity"
                subtitle="Humidity changes throughout the drying process"
                data={humidityHistory}
                color="#38BDF8"
                unit="%"
                decimals={1}
                Icon={Droplets}
                emptyMessage="No supported humidity history field was found. Check whether your ESP32 saves humidity in each history record."
              />

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">SENSOR HEALTH</span>
                    <h3>Measurement availability</h3>
                  </div>

                  <ShieldCheck size={21} />
                </div>

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

          <footer className="footer">
            <span>© SINAG-ANI · Solar Food Dryer Research Project</span>
            <span>Live source: Firebase · devices/device001</span>
          </footer>
        </div>
      </main>

      <nav className="mobile-navigation">
        {PAGES.map(([id, name, Icon]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => selectPage(id)}
          >
            <Icon size={19} />
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


