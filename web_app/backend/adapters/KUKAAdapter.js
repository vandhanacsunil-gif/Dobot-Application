const BaseRobotAdapter = require('./BaseRobotAdapter');
const net = require('net');

class KUKAAdapter extends BaseRobotAdapter {
  constructor(port, config) {
    super(port, config);
    this.host = config.host || '192.168.1.1'; // Default KUKA IP
    this.port = config.port || 59152; // KUKAVARPROXY port
    this.client = null;
  }

  static getName() {
    return 'KUKA Robot (KR/iiwa)';
  }

  static getDescription() {
    return 'KUKA industrial robots with KRL programming';
  }

  async connect() {
    this.client = new net.Socket();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.client.connect(this.port, this.host, () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log(`KUKA Robot connected at ${this.host}:${this.port}`);
        resolve();
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`KUKA connection error: ${err.message}`));
      });

      this.client.on('data', (data) => {
        console.log('KUKA response:', data.toString());
      });

      this.client.on('close', () => {
        console.log('KUKA connection closed');
        this.connected = false;
      });
    });
  }

  async disconnect() {
    if (this.client) {
      this.client.destroy();
      this.connected = false;
      console.log('KUKA Robot disconnected');
    }
  }

  async home() {
    console.log('Homing KUKA robot...');
    // KRL command for home position
    const krl = 'PTP {A1 0, A2 -90, A3 90, A4 0, A5 90, A6 0}\n';
    await this.sendKRL(krl);
    this.updatePosition({ j1: 0, j2: -90, j3: 90, j4: 0, j5: 90, j6: 0 });
    await this.wait(3000);
  }

  async moveCartesian({ x, y, z, r }, speed) {
    this.validateCartesianLimits({ x, y, z, r });
    
    console.log(`KUKA: Moving to cartesian X${x} Y${y} Z${z}`);
    
    // KRL LIN command for linear movement
    const krl = `LIN {X ${x}, Y ${y}, Z ${z}, A 0, B 0, C ${r}}\n`;
    
    await this.sendKRL(krl);
    this.updatePosition({ x, y, z, r });
    await this.wait(1000);
  }

  async moveJoint({ j1, j2, j3, j4, j5, j6 }, speed) {
    this.validateJointLimits({ j1, j2, j3, j4, j5, j6 });
    
    console.log(`KUKA: Moving joints`);
    
    // KRL PTP command for point-to-point movement
    const krl = `PTP {A1 ${j1}, A2 ${j2}, A3 ${j3}, A4 ${j4}, A5 ${j5}, A6 ${j6}}\n`;
    
    await this.sendKRL(krl);
    this.updatePosition({ j1, j2, j3, j4, j5, j6 });
    await this.wait(1000);
  }

  async setGripper(state) {
    console.log(`KUKA: Setting gripper ${state ? 'closed' : 'open'}`);
    // Use digital output
    const krl = state ? '$OUT[1]=TRUE\n' : '$OUT[1]=FALSE\n';
    await this.sendKRL(krl);
  }

  async emergencyStop() {
    console.log('KUKA EMERGENCY STOP');
    const krl = 'HALT\n';
    await this.sendKRL(krl);
  }

  async sendKRL(command) {
    if (!this.connected || !this.client) {
      throw new Error('KUKA Robot not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.write(command, (err) => {
        if (err) {
          reject(new Error(`KRL command error: ${err.message}`));
        } else {
          setTimeout(resolve, 100);
        }
      });
    });
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = KUKAAdapter;
