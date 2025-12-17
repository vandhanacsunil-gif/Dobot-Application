# Example usage of the SDK
from dobot import Dobot
import time

d = Dobot('COM6', verbose=True)  # change port as needed
print('Initial pose:', d.pose())
d.move_to(240, 0, 150, 0, wait=True)
time.sleep(1)
print('Final pose:', d.pose())
d.close()
