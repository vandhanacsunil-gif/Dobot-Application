import struct

class Message:
    HEADER = b'\xAA\xAA'

    def __init__(self, id=None, ctrl=0x00, params=b''):
        self.header = Message.HEADER
        self.id = id if id is not None else 0
        self.ctrl = ctrl
        self.params = params if isinstance(params, (bytes, bytearray)) else bytes(params)

    @staticmethod
    def compute_checksum(id_val, ctrl, params_bytes):
        s = id_val + ctrl + sum(params_bytes)
        s = s & 0xFF
        checksum = (-s) & 0xFF  # 256 - s mod 256
        return checksum

    def to_bytes(self):
        params = bytes(self.params)
        length = 2 + len(params)  # id + ctrl + params
        chk = Message.compute_checksum(self.id, self.ctrl, params)
        return Message.HEADER + bytes([length, self.id, self.ctrl]) + params + bytes([chk])

    @staticmethod
    def parse(raw: bytes):
        # minimal parsing of a single message in raw bytes
        if len(raw) < 6:
            return None
        # find header
        idx = raw.find(Message.HEADER)
        if idx == -1:
            return None
        if idx + 3 >= len(raw):
            return None
        length = raw[idx+2]
        end = idx + 3 + length  # header(2) + len(1) + length bytes (id+ctrl+params+checksum)
        if end > len(raw):
            return None
        # slice message
        msg = raw[idx:end]
        id_val = msg[3]
        ctrl = msg[4]
        params = msg[5:-1]
        checksum = msg[-1]
        # verify checksum
        expected = Message.compute_checksum(id_val, ctrl, params)
        if checksum != expected:
            # checksum mismatch -> still return message object but mark invalid by returning None
            return None
        m = Message(id=id_val, ctrl=ctrl, params=bytes(params))
        return m
