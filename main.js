const { app, BrowserWindow, Notification, ipcMain } = require('electron')
const { exec, spawn } = require('child_process')

const OpenAI = require("openai").default

// 🔥 GROQ SETUP
const openai = new OpenAI({
  apiKey: "secret api key",
  baseURL: "https://api.groq.com/openai/v1"
})

let win
let lastWiFiName = ""
let riskTestMode = false

/* ---------------- CREATE WINDOW ---------------- */

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')

  win.webContents.on('did-finish-load', () => {
    getWiFiName((name) => {
      lastWiFiName = name
      win.webContents.send('wifi-name', name)
    })
  })
}

/* ---------------- RISK MODE ---------------- */

ipcMain.on("toggle-risk-mode", (event, value) => {
  riskTestMode = value
  console.log("⚠️ Risk Test Mode:", riskTestMode)
})

/* ---------------- WIFI NAME ---------------- */

function getWiFiName(callback) {
  exec('netsh wlan show interfaces', (err, stdout) => {
    if (err || !stdout) return callback("Not Connected")

    const match = stdout.match(/SSID\s*:\s(.*)/)
    callback(match && match[1] ? match[1].trim() : "Not Connected")
  })
}

/* ---------------- NETWORK RANGE ---------------- */

function getNetworkRange(callback) {
  exec('ipconfig', (err, stdout) => {
    if (err || !stdout) return callback("192.168.1.0/24")

    const match = stdout.match(/IPv4 Address[.\s]*:\s([\d.]+)/)

    if (match) {
      const parts = match[1].split('.')
      callback(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`)
    } else {
      callback("192.168.1.0/24")
    }
  })
}

/* ---------------- WIFI MONITOR ---------------- */

function monitorWiFi() {
  setInterval(() => {
    getWiFiName((name) => {

      if (name !== lastWiFiName) {

        if (win) {
          win.webContents.send('wifi-name', name)
          win.webContents.send('terminal-live', "\n[+] New WiFi detected → Auto scan starting...\n")
        }

        lastWiFiName = name
        runScan()
      }

    })
  }, 5000)
}

/* ---------------- RUN SCAN ---------------- */

function runScan() {

  let scanCompleted = false // 🔥 IMPORTANT LOCK

  getNetworkRange((network) => {

    if (win) {
      win.webContents.send('terminal-live', "\n--- New Scan ---\n")
      win.webContents.send('terminal-live', `[+] Network: ${network}\n`)

      win.webContents.send('scan-status', {
        risk: "LOW",
        message: "Processing... (Scanning + AI Analysis)"
      })

      win.webContents.send('ai-result', "🔍 AI is analyzing full scan output...")
    }

    const command = `
echo "[+] Running Nmap..."
nmap -F -T5 ${network}
echo "[+] Running Netdiscover..."
echo "kali123" | sudo -S netdiscover -r ${network} -P -c 3
`

    const kali = spawn('wsl', [
      '-d',
      'kali-linux',
      '--',
      'bash',
      '-c',
      command
    ])

    let output = ""

    kali.stdout.on('data', (data) => {
      const text = data.toString()
      output += text

      if (win) {
        win.webContents.send('terminal-live', text)
      }
    })

    kali.stderr.on('data', (err) => {
      if (win) {
        win.webContents.send('terminal-live', "\n[ERROR] " + err.toString())
      }
    })

    kali.on('close', async () => {

      if (scanCompleted) return // 🔥 PREVENT DOUBLE EXECUTION
      scanCompleted = true

      console.log("Scan finished → Starting AI...")

      const ai = await analyzeWithAI(output)

      if (win) {
        win.webContents.send('ai-result', ai)
      }

      // 🔥 ONLY PLACE WHERE DECISION HAPPENS
      handleFinalDecision(ai)
    })
  })
}

/* ---------------- AI FUNCTION ---------------- */

async function analyzeWithAI(output) {
  try {
    const trimmed = output.slice(-6000)

    const res = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity expert."
        },
        {
          role: "user",
          content: `
Analyze this scan:

${trimmed}

Give:

Devices Found:
Active IPs:
Open Ports:

Risk Level: SAFE / MEDIUM / HIGH

Explanation:
Why safe or risky
`
        }
      ]
    })

    return res.choices[0].message.content

  } catch (err) {
    return "AI ERROR: " + err.message
  }
}

/* ---------------- FINAL DECISION ---------------- */

function handleFinalDecision(aiText) {

  let risk = "LOW"

  if (riskTestMode) {
    risk = "HIGH"
  } else {
    if (aiText.includes("HIGH")) risk = "HIGH"
    else if (aiText.includes("MEDIUM")) risk = "MEDIUM"
  }

  if (win) {
    win.webContents.send('scan-status', {
      risk,
      message:
        risk === "HIGH"
          ? "⚠️ Harmful network detected"
          : risk === "MEDIUM"
          ? "⚠️ Medium risk network"
          : "✅ Network is safe"
    })
  }

  // 🔥 ONLY AFTER AI → ALERT + DISCONNECT
  if (risk !== "LOW") {

    new Notification({
      title: "Cyber Threat Alert",
      body: "⚠️ Harmful connection detected! WiFi disconnected."
    }).show()

    exec('netsh wlan disconnect')

  } else {

    new Notification({
      title: "Cyber Threat Monitor",
      body: "✅ Your network is safe"
    }).show()
  }
}

/* ---------------- BUTTON ---------------- */

ipcMain.on("manual-scan", () => {
  runScan()
})

/* ---------------- START ---------------- */

app.whenReady().then(() => {
  createWindow()
  monitorWiFi()
})
