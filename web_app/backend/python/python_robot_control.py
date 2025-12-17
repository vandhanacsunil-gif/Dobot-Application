import sys
import os
import json
import time

# ---------------------------------------------------------
# FIX PATHS
# ---------------------------------------------------------
CURRENT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.abspath(os.path.join(CURRENT, ".."))
SDK = os.path.join(BACKEND, "sdk")
DOBOT_SDK = os.path.join(SDK, "dobot_sdk")

sys.path.insert(0, DOBOT_SDK)
sys.path.insert(0, SDK)
sys.path.insert(0, BACKEND)

# ---------------------------------------------------------
# SAFE JSON PRINT
# ---------------------------------------------------------
def send(success, msg="", data=None):
    out = {"success": success, "msg": msg}
    if data is not None:
        out["data"] = data
    print(json.dumps(out))
    sys.stdout.flush()

# ---------------------------------------------------------
# IMPORT SDK MODULES
# ---------------------------------------------------------
try:
    from dobot_sdk.communication.serial_driver import SerialDriver
    from dobot_sdk.commands.motion import MotionCommands
    from dobot_sdk.commands.system import SystemCommands
    from dobot_sdk.enums import protocol_ids, ptp_mode
except Exception as e:
    send(False, f"Import error: {str(e)}")
    sys.exit(0)

# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------
try:
    req = json.loads(sys.argv[1])
    command = req.get("command")
    port = req.get("port")

    driver = SerialDriver(port)
    system = SystemCommands(driver)
    motion = MotionCommands(driver)

    # ---------------------------------------------------------
    # INIT
    # ---------------------------------------------------------
    if command == "init":
        try:
            # 1) CLEAR ALARMS
            system.clear_alarms()
            time.sleep(0.1)

            # 2) ENABLE MOTORS
            system.enable_motors()
            time.sleep(0.1)

            # 3) Set common PTP parameters
            motion.set_ptp_common_params(100, 100)

            # 4) Start queued command execution
            system.start_queue()

            send(True, "Dobot initialized")
        except Exception as e:
            send(False, f"Init failure: {str(e)}")
        sys.exit(0)

    # ---------------------------------------------------------
    # HOME
    # ---------------------------------------------------------
    if command == "home":
        motion.move_ptp(200, 0, 150, 0, mode=ptp_mode.MOVJ_XYZ)
        send(True, "Homing complete")
        sys.exit(0)

    # ---------------------------------------------------------
    # MOVE
    # ---------------------------------------------------------
    if command == "move":
        x = req.get("x", 200)
        y = req.get("y", 0)
        z = req.get("z", 150)
        r = req.get("r", 0)
        motion.move_ptp(x, y, z, r)
        send(True, "Movement complete")
        sys.exit(0)

    # ---------------------------------------------------------
    # STOP
    # ---------------------------------------------------------
    if command == "stop":
        system.stop_queue()
        send(True, "Stopped")
        sys.exit(0)

    send(False, "Unknown command")

except Exception as e:
    send(False, f"Runtime error: {str(e)}")
    sys.exit(0)
