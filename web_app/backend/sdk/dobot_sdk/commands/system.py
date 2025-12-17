from ..communication.protocol import Message
from ..enums import protocol_ids, control_values
import time


class SystemCommands:
    def __init__(self, driver):
        self.driver = driver

    def clear_alarms(self):
        msg = Message(protocol_ids.CLEAR_ALARM, control_values.ONE, b"")
        self.driver.write(msg.to_bytes())
        time.sleep(0.05)
        return True

    def enable_motors(self):
        msg = Message(protocol_ids.SET_ARM_ENABLED, control_values.ONE, b"\x01")
        self.driver.write(msg.to_bytes())
        time.sleep(0.05)
        return True

    def stop_queue(self):
        msg = Message(protocol_ids.SET_QUEUED_CMD_STOP_EXEC, control_values.ONE, b"")
        self.driver.write(msg.to_bytes())
        return True

    def start_queue(self):
        msg = Message(protocol_ids.SET_QUEUED_CMD_START_EXEC, control_values.ONE, b"")
        self.driver.write(msg.to_bytes())
        return True
