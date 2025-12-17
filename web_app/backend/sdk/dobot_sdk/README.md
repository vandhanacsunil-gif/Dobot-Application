Dobot SDK (minimal, Python)
==========================

This is a minimal, self-contained Dobot SDK for Dobot Magician-like devices.
It implements a serial driver, protocol packing/unpacking and a few commands:
  - clear_alarms()
  - enable_motors()
  - start_queue()
  - move_ptp()
  - get_pose()

**Requirements**
- Python 3.8+
- pyserial (`pip install pyserial`)

**Usage**
- Install pyserial: pip install pyserial
- Run example: python3 examples/test_move.py (change COM port as needed)
