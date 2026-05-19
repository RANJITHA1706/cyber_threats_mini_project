from flask import Flask, jsonify
import subprocess

app = Flask(__name__)

@app.route('/scan', methods=['GET'])
def scan_network():
    try:
        target = "192.168.1.0/24"

        # 🔥 Run NMAP
        nmap_result = subprocess.getoutput(f"nmap -F {target}")

        # 🔥 Simulate netdiscover (Windows alternative)
        arp_result = subprocess.getoutput("arp -a")

        return jsonify({
            "status": "success",
            "target": target,
            "nmap": nmap_result,
            "netdiscover": arp_result
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)