const { spawn } = require("child_process");
const path = require("path");

class DobotAdapter {
  constructor(port) {
    if (!port) throw new Error("Port is required for DobotAdapter");

    this.portName = port;
    this.connected = false;

    console.log(`DobotAdapter created on port: ${port}`);
  }

  static getName() {
    return "Dobot Magician";
  }

  static getDescription() {
    return "Dobot Magician robotic arm adapter (Python-SDK bridge)";
  }

  // ---------------------------------------------------------
  // PYTHON BRIDGE (CORRECT JSON + UTF8)
  // ---------------------------------------------------------
  runPython(command, extraParams = {}) {
    return new Promise((resolve, reject) => {
      const script = path.join(
        __dirname,
        "..",
        "python",
        "python_robot_control.py"
      );

      // Build JSON payload
      const payload = JSON.stringify({
        command,
        port: this.portName,
        ...extraParams,
      });

      // Spawn Python with JSON argument
      const py = spawn("python", [
        "-X",
        "utf8",
        script,
        payload,
      ]);

      let output = "";
      let errorOutput = "";

      py.stdout.on("data", (data) => (output += data.toString()));
      py.stderr.on("data", (data) => (errorOutput += data.toString()));

      py.on("close", () => {
        if (!output) {
          return reject("Python returned empty output: " + errorOutput);
        }

        try {
          const json = JSON.parse(output);
          resolve(json);
        } catch (e) {
          reject("Invalid JSON from Python: " + output);
        }
      });
    });
  }

  // ---------------------------------------------------------
  // CONNECT
  // ---------------------------------------------------------
  async connect() {
    console.log("Connecting Dobot via Python SDK...");

    try {
      const res = await this.runPython("init");

      if (!res.success) {
        console.error("Dobot init failed:", res.msg);
        this.connected = false;
        return { success: false, error: res.msg };
      }

      console.log("Dobot initialized:", res.msg);
      this.connected = true;
      return { success: true };

    } catch (error) {
      console.error("Python init error:", error);
      this.connected = false;
      return { success: false, error };
    }
  }

  // ---------------------------------------------------------
  // DISCONNECT
  // ---------------------------------------------------------
  async disconnect() {
    console.log("Disconnect called");
    this.connected = false;
    return { success: true };
  }

  // ---------------------------------------------------------
  // HOME
  // ---------------------------------------------------------
  async home() {
    if (!this.connected) return { success: false, error: "Not connected" };
    return this.runPython("home");
  }

  // ---------------------------------------------------------
  // MOVE CARTESIAN
  // ---------------------------------------------------------
  async moveCartesian({ x, y, z, r }) {
    if (!this.connected) return { success: false, error: "Not connected" };

    return this.runPython("move", { x, y, z, r });
  }

  // ---------------------------------------------------------
  // STOP
  // ---------------------------------------------------------
  async emergencyStop() {
    if (!this.connected) return { success: false, error: "Not connected" };
    return this.runPython("stop");
  }

  // ---------------------------------------------------------
  // STATUS
  // ---------------------------------------------------------
  getStatus() {
    return {
      connected: this.connected,
      port: this.portName,
    };
  }
}

module.exports = DobotAdapter;
