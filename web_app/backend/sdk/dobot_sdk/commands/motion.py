import struct
import time
from ..communication.protocol import Message
from ..communication import protocol
from ..enums import protocol_ids, ptp_mode, control_values


class MotionCommands:
    def __init__(self, driver):
        self.driver = driver

    # ================================================================
    # INITIALIZATION (Safe setup for Dobot Magician)
    # ================================================================
    def initialize_magician(self):
        print("\n[Init] Initializing Dobot Magician...\n")

        # 1) Clear alarms
        msg = Message(protocol_ids.CLEAR_ALARM, control_values.ZERO, b"")
        self.driver.write(msg.to_bytes())
        time.sleep(0.1)

        # 2) Enable Motors
        msg = Message(protocol_ids.SET_ARM_ENABLED, control_values.ZERO, b"\x01")
        self.driver.write(msg.to_bytes())
        time.sleep(0.1)

        # 3) Set PTP common params (velocity & acceleration)
        self.set_ptp_common_params(velocity=80.0, acceleration=80.0)

        # 4) PTP Coordinate Params
        params = struct.pack('<f', 200.0) + struct.pack('<f', 200.0)
        msg = Message(protocol_ids.SET_PTP_COORDINATE_PARAMS, control_values.ZERO, params)
        self.driver.write(msg.to_bytes())
        time.sleep(0.1)

        # 5) PTP Jump Params
        params = struct.pack('<f', 10.0) + struct.pack('<f', 10.0)
        msg = Message(protocol_ids.SET_PTP_JUMP_PARAMS, control_values.ZERO, params)
        self.driver.write(msg.to_bytes())
        time.sleep(0.1)

        print("[Init] Dobot ready.\n")

    # ================================================================
    # COMMON PTP PARAMS
    # ================================================================
    def set_ptp_common_params(self, velocity=100.0, acceleration=100.0):
        params = struct.pack('<f', velocity) + struct.pack('<f', acceleration)
        msg = Message(protocol_ids.SET_GET_PTP_COMMON_PARAMS, control_values.ZERO, params)
        self.driver.write(msg.to_bytes())
        time.sleep(0.05)

    # ================================================================
    # HOME COMMAND — SAFE CUSTOM HOME
    # ================================================================
    def home(self, wait=True):
        """Moves Dobot to SAFE CUSTOM HOME: X=200, Y=0, Z=120, R=0"""

        # STEP 1 → Move UP first to avoid collisions
        self.move_ptp(200, 0, 140, 0, ptp_mode.MOVL_XYZ, wait=True)

        # STEP 2 → Move to your custom home
        return self.move_ptp(200, 0, 120, 0, ptp_mode.MOVJ_XYZ, wait=wait)

    # ================================================================
    # PTP MOVEMENT
    # ================================================================
    def move_ptp(self, x, y, z, r=0.0, mode=ptp_mode.MOVL_XYZ, wait=True):
        params = (
            bytes([mode]) +
            struct.pack('<f', float(x)) +
            struct.pack('<f', float(y)) +
            struct.pack('<f', float(z)) +
            struct.pack('<f', float(r))
        )

        # ❗ MUST USE control_values.ZERO (queued mode)
        msg = Message(protocol_ids.SET_PTP_CMD, control_values.ZERO, params)
        self.driver.write(msg.to_bytes())

        if wait:
            self._wait_for_motion()
        return True

    # ================================================================
    # CONTINUOUS PATH MOVEMENT
    # ================================================================
    def move_cp(self, x, y, z, wait=True):
        params = (
            b"\x01" +
            struct.pack("<f", float(x)) +
            struct.pack("<f", float(y)) +
            struct.pack("<f", float(z)) +
            b"\x00"
        )

        msg = Message(protocol_ids.SET_CP_CMD, control_values.ZERO, params)
        self.driver.write(msg.to_bytes())

        if wait:
            self._wait_for_motion()
        return True

    # ================================================================
    # JOG MOVEMENT
    # ================================================================
    def jog(self, axis, direction=1, speed=20):
        jog_step = direction * speed
        pose = self._get_pose()

        if pose is None:
            return False

        x, y, z, r = pose[0], pose[1], pose[2], pose[3]

        if axis == "x": x += jog_step
        elif axis == "y": y += jog_step
        elif axis == "z": z += jog_step
        elif axis == "r": r += jog_step

        return self.move_ptp(x, y, z, r, ptp_mode.MOVL_XYZ)

    # ================================================================
    # WAIT FUNCTION
    # ================================================================
    def wait(self, milliseconds):
        msg = Message(110, control_values.ZERO, struct.pack("<I", milliseconds))
        self.driver.write(msg.to_bytes())
        time.sleep(milliseconds / 1000)

    # ================================================================
    # INTERNAL HELPERS
    # ================================================================
    def _wait_for_motion(self):
        last_x = None
        for _ in range(40):
            pose = self._get_pose()
            if pose:
                x_now = pose[0]
                if last_x is not None and abs(x_now - last_x) < 0.05:
                    return True
                last_x = x_now
            time.sleep(0.1)
        return True

    def _get_pose(self):
        request = Message(protocol_ids.GET_POSE, control_values.ZERO, b"")
        self.driver.write(request.to_bytes())
        time.sleep(0.05)

        raw = self.driver.read_all()
        parsed = protocol.parse_message(raw)

        if parsed and len(parsed["params"]) >= 32:
            return struct.unpack_from("<8f", parsed["params"], 0)

        return None
