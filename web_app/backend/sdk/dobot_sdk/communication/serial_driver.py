import serial
import time


class SerialDriver:
    """
    Serial communication driver for Dobot robot
    Handles low-level serial port communication
    """
    
    def __init__(self, port, baudrate=115200, timeout=0.5):
        """
        Initialize serial connection
        
        Parameters:
        - port: Serial port name (e.g., 'COM3', '/dev/ttyUSB0')
        - baudrate: Communication speed (default: 115200)
        - timeout: Read timeout in seconds
        """
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        
        try:
            self.ser = serial.Serial(
                port=port,
                baudrate=baudrate,
                timeout=timeout,
                write_timeout=1.0,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
            
            # Clear any existing data in buffers
            time.sleep(0.1)
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()
            
        except serial.SerialException as e:
            raise Exception(f"Failed to open serial port {port}: {e}")

    def write(self, data: bytes):
        """
        Write data to serial port
        
        Parameters:
        - data: Bytes to send
        """
        if not self.ser.is_open:
            raise Exception("Serial port is not open")
        
        self.ser.write(data)
        time.sleep(0.02)  # Give device time to process

    def read_all(self):
        """
        Read all available data from serial buffer
        
        Returns:
        - Bytes read from buffer, or empty bytes if nothing available
        """
        if not self.ser.is_open:
            return b''
        
        try:
            data = self.ser.read_all()
            return data if data else b''
        except Exception as e:
            print(f"Read error: {e}")
            return b''

    def read(self, size=1):
        """
        Read specified number of bytes
        
        Parameters:
        - size: Number of bytes to read
        
        Returns:
        - Bytes read
        """
        if not self.ser.is_open:
            return b''
        
        try:
            return self.ser.read(size)
        except Exception as e:
            print(f"Read error: {e}")
            return b''

    def in_waiting(self):
        """
        Get number of bytes waiting in input buffer
        
        Returns:
        - Number of bytes available
        """
        try:
            if self.ser.is_open:
                return self.ser.in_waiting
        except Exception:
            pass
        return 0

    def flush(self):
        """Flush input and output buffers"""
        if self.ser.is_open:
            self.ser.reset_input_buffer()
            self.ser.reset_output_buffer()

    def close(self):
        """Close serial connection"""
        if self.ser and self.ser.is_open:
            self.ser.close()

    def is_open(self):
        """Check if serial port is open"""
        return self.ser and self.ser.is_open

    def __del__(self):
        """Cleanup on deletion"""
        try:
            self.close()
        except:
            pass