from .communication.serial_driver import SerialDriver
from .commands.motion import MotionCommands
from .commands.system import SystemCommands
from .communication.protocol import Message
from .enums import protocol_ids
import struct
import time

class Dobot:
    def __init__(self, port, verbose=False):
        self.verbose = verbose
        self.driver = SerialDriver(port)
        self.motion = MotionCommands(self.driver)
        self.system = SystemCommands(self.driver)

        # initialize robot safely
        try:
            if self.verbose:
                print('Initializing Dobot...')
            
            self.system.clear_alarms()
            time.sleep(0.1)
            
            self.system.enable_motors()
            time.sleep(0.2)
            
            # Set default motion parameters
            self.motion.set_ptp_common_params(velocity=100.0, acceleration=100.0)
            time.sleep(0.1)
            
            self.system.start_queue()
            time.sleep(0.2)
            
            if self.verbose:
                print('Dobot initialized successfully!')
                
        except Exception as e:
            if self.verbose:
                print(f'Warning during initialization: {e}')

    def move_to(self, x, y, z, r=0.0, wait=True):
        """Move to specified coordinates"""
        if self.verbose:
            print(f'Dobot.move_to -> X:{x}, Y:{y}, Z:{z}, R:{r}')
        return self.motion.move_ptp(x, y, z, r, wait=wait)

    def pose(self):
        """Get current robot pose (x, y, z, r, j1, j2, j3, j4)"""
        self.driver.write(Message(id=protocol_ids.GET_POSE, ctrl=0x00, params=b'').to_bytes())
        time.sleep(0.1)
        raw = self.driver.read_all()
        
        parsed = Message.parse(raw)
        if not parsed:
            if self.verbose:
                print('Failed to parse pose response')
            return None
            
        params = parsed.params
        if len(params) >= 32:
            vals = struct.unpack_from('<8f', params, 0)
            return vals  # x, y, z, r, j1, j2, j3, j4
        return None

    def close(self):
        """Close serial connection"""
        if self.verbose:
            print('Closing Dobot connection...')
        self.driver.close()