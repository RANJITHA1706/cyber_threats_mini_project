const { ipcRenderer } = require('electron')

/* ---------------- WIFI NAME ---------------- */

ipcRenderer.on('wifi-name', (event, name) => {
  document.getElementById("wifi").innerText = "WiFi: " + name
})

/* ---------------- STATUS UPDATE ---------------- */

ipcRenderer.on('scan-status', (event, data) => {
  document.getElementById("scan").innerText = data.message

  const status = document.getElementById("status")

  if (data.message.includes("Processing")) {
    status.innerText = "Status: Processing..."
    status.className = "status"
    return
  }

  if (data.risk === "HIGH") {
    status.innerText = "Status: Risky"
    status.className = "status risk-high"
  } else if (data.risk === "MEDIUM") {
    status.innerText = "Status: Medium Risk"
    status.className = "status risk-medium"
  } else {
    status.innerText = "Status: Safe"
    status.className = "status risk-low"
  }

  addLog(data)
})

/* ---------------- LIVE TERMINAL ---------------- */

ipcRenderer.on('terminal-live', (event, chunk) => {
  const terminal = document.getElementById("terminal")
  terminal.innerText += chunk
  terminal.scrollTop = terminal.scrollHeight
})

/* ---------------- 🤖 AI RESULT ---------------- */

ipcRenderer.on('ai-result', (event, data) => {
  document.getElementById("ai").innerText = data

  // 🔥 EXTRACT DATA FROM AI OUTPUT
  let deviceMatch = data.match(/Devices Found:\s*(\d+)/i)
  let deviceCount = deviceMatch ? parseInt(deviceMatch[1]) : 0

  let ipMatch = data.match(/Active IPs:\s*(.*)/i)
  let ips = ipMatch ? ipMatch[1].split(",").map(ip => ip.trim()) : []

  let riskMatch = data.match(/Risk Level:\s*(SAFE|MEDIUM|HIGH)/i)
  let risk = riskMatch ? riskMatch[1] : "UNKNOWN"

  /* ---------------- GRAPH ---------------- */

  const canvas = document.getElementById('chart')

  if (canvas) {
    const ctx = canvas.getContext('2d')

    if (window.myChart) window.myChart.destroy()

    window.myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Devices'],
        datasets: [{
          label: 'Connected Devices',
          data: [deviceCount]
        }]
      }
    })
  }

  /* ---------------- TABLE ---------------- */

  const tableBody = document.querySelector("#deviceTable tbody")
  tableBody.innerHTML = ""

  ips.forEach(ip => {
    const row = `<tr>
      <td>${ip}</td>
      <td style="color:${risk === "SAFE" ? "green" : "red"}">${risk}</td>
    </tr>`
    tableBody.innerHTML += row
  })

  /* ---------------- SUMMARY ---------------- */

  const summary = document.getElementById("summary")
  if (summary) {
    summary.innerHTML = `
      <p><b>Devices:</b> ${deviceCount}</p>
      <p><b>Risk:</b> ${risk}</p>
    `
  }

  /* ---------------- 🔥 UPDATE TOP STATUS AFTER AI ---------------- */

  const status = document.getElementById("status")

  if (risk === "HIGH") {
    status.innerText = "Status: Risky"
    status.className = "status risk-high"
  } else if (risk === "MEDIUM") {
    status.innerText = "Status: Medium Risk"
    status.className = "status risk-medium"
  } else if (risk === "SAFE") {
    status.innerText = "Status: Safe"
    status.className = "status risk-low"
  }
})

/* ---------------- LOGS ---------------- */

function addLog(data) {
  const logs = document.getElementById("logs")

  const logEntry = `
  <div>
    <b>${new Date().toLocaleTimeString()}</b> - ${data.risk} - ${data.message}
  </div>
  `

  logs.innerHTML = logEntry + logs.innerHTML
}

/* ---------------- BUTTONS ---------------- */

function manualScan() {
  document.getElementById("terminal").innerText = "[+] Starting new scan...\n"

  document.getElementById("ai").innerText = "Analyzing..."

  const summary = document.getElementById("summary")
  if (summary) summary.innerHTML = ""

  // 🔥 SET STATUS TO PROCESSING
  const status = document.getElementById("status")
  status.innerText = "Status: Processing..."
  status.className = "status"

  ipcRenderer.send("manual-scan")
}

function clearLogs() {
  document.getElementById("logs").innerHTML = "Logs cleared"
}

/* ---------------- 🔥 RISK MODE TOGGLE ---------------- */

function toggleRiskMode() {
  const enabled = document.getElementById("riskToggle").checked
  ipcRenderer.send("toggle-risk-mode", enabled)
}