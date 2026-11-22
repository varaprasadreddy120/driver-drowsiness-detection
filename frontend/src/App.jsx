

import { useRef, useState, useEffect } from "react";
import "./App.css";

function App() {

const videoRef = useRef(null);
const streamRef = useRef(null);
const monitoringRef = useRef(false);
const closedSinceRef = useRef(null);
const audioContextRef = useRef(null);
const oscillatorRef = useRef(null);

const [alarmOn, setAlarmOn] = useState(false);
const [detectionHistory, setDetectionHistory] = useState([]);

const [isMonitoring, setIsMonitoring] = useState(false);

const [detectionStats, setDetectionStats] = useState({
  eyesOpen: 0,
  eyesClosed: 0,
  drowsinessAlerts: 0
});

const lastRecordedStatusRef = useRef(null);
const [cameraOn, setCameraOn] = useState(false);
const [cameraError, setCameraError] = useState("");

const [eyeStatus, setEyeStatus] = useState("Not Monitoring");
const [ear, setEar] = useState("--");
const [detectionError, setDetectionError] = useState("");


  // 1. TEST EYE DETECTION
  const testDetection = async () => {
    if (!videoRef.current || !streamRef.current) {
      setDetectionError("Start the camera first.");
      return;
    }

    try {
      setDetectionError("");

      const video = videoRef.current;

      if (video.readyState < 2) {
        throw new Error("Camera video is not ready.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;

      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, 320, 240);

      const image = canvas.toDataURL("image/jpeg", 0.8);

      const response = await fetch(
        "http://127.0.0.1:8000/detect",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ image })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Backend error: ${response.status}`
        );
      }

      const result = await response.json();

     
setEyeStatus(result.state);
setEar(result.ear);

if (
  monitoringRef.current &&
  result.state !== lastRecordedStatusRef.current
) {
  lastRecordedStatusRef.current = result.state;

if (result.state === "EYES OPEN") {
  setDetectionStats((previous) => ({
    ...previous,
    eyesOpen: previous.eyesOpen + 1
  }));
}

if (result.state === "EYES CLOSED") {
  setDetectionStats((previous) => ({
    ...previous,
    eyesClosed: previous.eyesClosed + 1
  }));
}


  const newEvent = {
    id: Date.now(),
    time: new Date().toLocaleTimeString(),
    status: result.state,
    alarm: result.state === "EYES CLOSED"
      ? "Checking"
      : "OFF"
  };

  setDetectionHistory((previous) =>
    [newEvent, ...previous].slice(0, 20)
  );
}


if (monitoringRef.current) {
  if (result.state === "EYES CLOSED") {
    if (closedSinceRef.current === null) {
      closedSinceRef.current = Date.now();
    }

    const closedDuration =
      (Date.now() - closedSinceRef.current) / 1000;

    if (closedDuration >= 1.5) {
      startAlarm();
    }
  } else {
    closedSinceRef.current = null;
    stopAlarm();
  }
}

console.log("MediaPipe result:", result);


    } catch (error) {
      setDetectionError(error.message);
    }
  };


  // 2. START CONTINUOUS MONITORING
  const startMonitoring = async () => {
    if (
      !videoRef.current ||
      !cameraOn ||
      monitoringRef.current
    ) {
      return;
    }

   
try {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    throw new Error("Browser audio is not supported.");
  }

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioContextClass();
  }

  await audioContextRef.current.resume();

  closedSinceRef.current = null;
  monitoringRef.current = true;

setIsMonitoring(true);

  setDetectionError("");

} catch (error) {
  setDetectionError("Audio setup failed: " + error.message);
  return;
}


    while (monitoringRef.current) {
      await testDetection();

      if (!monitoringRef.current) {
        break;
      }

      await new Promise(resolve =>
        setTimeout(resolve, 300)
      );
    }
  };


  // 3. STOP CONTINUOUS MONITORING
 
const stopMonitoring = () => {
  monitoringRef.current = false;

setIsMonitoring(false);

  closedSinceRef.current = null;

  stopAlarm();

  setEyeStatus("Not Monitoring");
  setEar("--");
};

const downloadHistory = () => {
  if (detectionHistory.length === 0) {
    alert("No detection history available.");
    return;
  }

  const headers = ["Time", "Eye Status", "Alarm"];

  const rows = detectionHistory.map((event) => [
    event.time,
    event.status,
    event.alarm
  ]);

  const escapeCSV = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n");

  const blob = new Blob(
    [csvContent],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "detection_history.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};


const startAlarm = () => {
  if (oscillatorRef.current) return;

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    setDetectionError("Audio is not supported.");
    return;
  }

  try {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const context = audioContextRef.current;

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.12;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();

    oscillatorRef.current = oscillator;
    setAlarmOn(true);

setDetectionStats((previous) => ({
  ...previous,
  drowsinessAlerts: previous.drowsinessAlerts + 1
}));


setDetectionHistory((previous) => [
  {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString(),
    status: "DROWSINESS DETECTED",
    alarm: "ON"
  },
  ...previous
].slice(0, 20));

  } catch (error) {
    setDetectionError(error.message);
  }
};

const stopAlarm = () => {
  if (oscillatorRef.current) {
    try {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
    } catch (error) {
      console.error(error);
    }

    oscillatorRef.current = null;
  }

  setAlarmOn(false);
};


const startCamera = async () => {
  try {
    setCameraError("");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    setCameraOn(true);
  } catch (error) {
    setCameraError(error.message);
    setCameraOn(false);
  }
};

const stopCamera = () => {
  monitoringRef.current = false;
closedSinceRef.current = null;
stopAlarm();

setEyeStatus("Not Monitoring");
setEar("--");
  if (streamRef.current) {
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }

  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }

  setCameraOn(false);
};

useEffect(() => {
  return () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };
}, []);

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <h1>Driver Drowsiness Detection</h1>
          <p>AI-Powered Driver Monitoring System</p>
        </div>
        <span className="system-badge">System Ready</span>
      </header>

      <main className="content">
        <section className="camera-panel">
          <h2>Live Camera Monitoring</h2>

          
<div className="camera-placeholder">
  <video
    ref={videoRef}
    autoPlay
    muted
    playsInline
    style={{
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: cameraOn ? "block" : "none"
    }}
  />


  {!cameraOn && (
    <div>
      <h3>Camera Preview</h3>
      <p>Click Start Camera to begin monitoring</p>
    </div>
  )}
</div>

{cameraError && (
  <p style={{ color: "#f87171" }}>
    Camera error: {cameraError}
  </p>
)}


          
<div className="camera-controls">
  <button onClick={startCamera} disabled={cameraOn}>
    Start Camera
  </button>

  <button
    className="stop-button"
    onClick={stopCamera}
    disabled={!cameraOn}
  >
    Stop Camera
  </button>
  <button onClick={testDetection} disabled={!cameraOn}>
  Test Eye Detection
</button>

<button onClick={startMonitoring} disabled={!cameraOn}>
  Start Monitoring
</button>

<button onClick={stopMonitoring}>
  Stop Monitoring
</button>

</div>

{detectionError && (
  <p style={{ color: "#f87171" }}>
    Detection error: {detectionError}
  </p>
)}

        </section>

        <section className="status-panel">
          <h2>Detection Status</h2>

          <div className="status-card">
            <p>Eye Status</p>
            <h3>{eyeStatus}</h3>
          </div>

          <div className="status-card">
            <p>Eye Aspect Ratio (EAR)</p>
            <h3>{ear}</h3>
          </div>

          <div className="status-card">
           <p>Alarm Status</p>
<h3 style={{ color: alarmOn ? "#ef4444" : "#22c55e" }}>
  {alarmOn ? "ON - DROWSINESS ALERT" : "OFF"}
</h3>
          </div>
        </section>
      </main>

      <section className="analytics">
        <h2>Model Performance</h2>

        <div className="analytics-grid">
          <div className="metric-card">
            <p>CNN Validation Accuracy</p>
            <h2>95.63%</h2>
          </div>

          <div className="metric-card">
            <p>Balanced Accuracy</p>
            <h2>95.92%</h2>
          </div>

          <div className="metric-card">
            <p>Correct Predictions</p>
            <h2>175 / 183</h2>
          </div>

<div className="metric-card">
  <p>Training Loss</p>
  <h2>0.1188</h2>
</div>

<div className="metric-card">
  <p>Validation Loss</p>
  <h2>0.1757</h2>
</div>

        </div>
        
      </section>

<section className="analytics-section">
  <h2>CNN Model Performance Analysis</h2>

  <p>
    Training and Validation Accuracy & Loss
  </p>

  <img
    src="/analytics/accuracy.png"
    alt="CNN Training Accuracy and Loss Graphs"
    style={{
      width: "100%",
      maxWidth: "1000px",
      height: "auto",
      borderRadius: "12px",
      marginTop: "20px"
    }}
  />

<h2 style={{ marginTop: "35px" }}>
  CNN Confusion Matrix
</h2>

<p>
  Validation Results - Sub1 and Sub2 Dataset
</p>

<img
  src="/analytics/confusion_matrix.png"
  alt="CNN Confusion Matrix"
  style={{
    width: "100%",
    maxWidth: "650px",
    height: "auto",
    borderRadius: "12px",
    marginTop: "20px"
  }}
/>

<section className="analytics-section">
  <h2>System Monitoring Status</h2>

  <div className="metric-card">
    <p>Current Monitoring Status</p>

    <h2
      style={{
        color: isMonitoring ? "#22c55e" : "#ef4444"
      }}
    >
      {isMonitoring
        ? "🟢 Monitoring Active"
        : "🔴 Monitoring Stopped"}
    </h2>
  </div>
</section>

<section className="analytics-section">
  <h2>Live Detection Statistics</h2>

<button
  type="button"
  onClick={() => {
    setDetectionStats({
      eyesOpen: 0,
      eyesClosed: 0,
      drowsinessAlerts: 0
    });
  }}
  style={{
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "10px",
    marginBottom: "15px",
    fontWeight: "bold"
  }}
>
  Reset Statistics
</button>


  <p>Detection events recorded during the current session</p>

  <div className="metrics-grid">
    <div className="metric-card">
      <p>Eyes Open Events</p>
      <h2>{detectionStats.eyesOpen}</h2>
    </div>

    <div className="metric-card">
      <p>Eyes Closed Events</p>
      <h2>{detectionStats.eyesClosed}</h2>
    </div>

    <div className="metric-card">
      <p>Drowsiness Alerts</p>
      <h2>{detectionStats.drowsinessAlerts}</h2>
    </div>
  </div>
</section>


</section>

<section className="analytics-section">
  <h2>Live Detection History</h2>

<button
  type="button"
  onClick={() => {
    setDetectionHistory([]);
    lastRecordedStatusRef.current = null;
  }}
  style={{
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "10px",
    marginBottom: "15px",
    fontWeight: "bold"
  }}
>
  Clear History
</button>

<button
  type="button"
  onClick={downloadHistory}
  style={{
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    marginLeft: "10px",
    marginBottom: "15px",
    fontWeight: "bold"
  }}
>
  Download History (CSV)
</button>



  <p>Recent eye detection events during monitoring</p>

  <div style={{ overflowX: "auto", marginTop: "20px" }}>
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        textAlign: "center"
      }}
    >
      <thead>
        <tr>
          <th style={{ padding: "12px" }}>Time</th>
          <th style={{ padding: "12px" }}>Eye Status</th>
          <th style={{ padding: "12px" }}>Alarm</th>
        </tr>
      </thead>

      <tbody>
        {detectionHistory.length === 0 ? (
          <tr>
            <td colSpan="3" style={{ padding: "20px" }}>
              No detection events recorded yet.
            </td>
          </tr>
        ) : (
          detectionHistory.map((event) => (
            <tr key={event.id}>
              <td style={{ padding: "12px" }}>
                {event.time}
              </td>

              
<td style={{ padding: "12px" }}>
  <span
    className={
      event.status === "EYES OPEN"
        ? "status-open"
        : event.status === "EYES CLOSED"
        ? "status-closed"
        : event.status === "DROWSINESS DETECTED"
        ? "status-danger"
        : ""
    }
  >
    {event.status}
  </span>
</td>


              <td style={{ padding: "12px" }}>
                {event.alarm}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
</section>


    </div>
  );
}

export default App;
