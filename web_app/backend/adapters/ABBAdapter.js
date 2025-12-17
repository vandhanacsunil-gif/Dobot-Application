const BaseRobotAdapter = require('./BaseRobotAdapter');
const net = require('net');

class ABBAdapter extends BaseRobotAdapter {
  constructor(port, config) {
    super(port, config);
    this.host = config.host || '192.168.125.1'; // Default ABB robot IP
    this.port = config.port || 5000; // RAPID server port
    this.client = null;
  }

  static getName() {
    return 'ABB Robot (IRC5/OmniCore)';
  }

  static getDescription() {
    return 'ABB industrial robots with RAPID programming language';
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
        console.log(`ABB Robot connected at ${this.host}:${this.port}`);
        resolve();
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`ABB connection error: ${err.message}`));
      });

      this.client.on('data', (data) => {
        console.log('ABB response:', data.toString());
      });

      this.client.on('close', () => {
        console.log('ABB connection closed');
        this.connected = false;
      });
    });
  }

  async disconnect() {
    if (this.client) {
      this.client.destroy();
      this.connected = false;
      console.log('ABB Robot disconnected');
    }
  }

  async home() {
    console.log('Homing ABB robot...');
    // RAPID command to move to home position
    const rapid = 'MoveAbsJ [[0,0,0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]],v1000,fine,tool0;\n';
    await this.sendRAPID(rapid);
    this.updatePosition({ j1: 0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0 });
    await this.wait(3000);
  }

  async moveCartesian({ x, y, z, r }, speed) {
    this.validateCartesianLimits({ x, y, z, r });
    
    console.log(`ABB: Moving to cartesian X${x} Y${y} Z${z}`);
    
    // RAPID MoveL command for linear movement
    // Position in mm, orientation as quaternion
    const rapid = `MoveL [[${x},${y},${z}],[1,0,0,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]],v${speed*10},fine,tool0;\n`;
    
    await this.sendRAPID(rapid);
    this.updatePosition({ x, y, z, r });
    await this.wait(1000);
  }

  async moveJoint({ j1, j2, j3, j4, j5, j6 }, speed) {
    this.validateJointLimits({ j1, j2, j3, j4, j5, j6 });
    
    console.log(`ABB: Moving joints`);
    
    // RAPID MoveAbsJ command for joint movement
    const rapid = `MoveAbsJ [[${j1},${j2},${j3},${j4},${j5},${j6}],[9E9,9E9,9E9,9E9,9E9,9E9]],v${speed*10},fine,tool0;\n`;
    
    await this.sendRAPID(rapid);
    this.updatePosition({ j1, j2, j3, j4, j5, j6 });
    await this.wait(1000);
  }

  async setGripper(state) {
    console.log(`ABB: Setting gripper ${state ? 'closed' : 'open'}`);
    // Use digital output to control gripper
    const rapid = state ? 'SetDO DO10_1, 1;\n' : 'SetDO DO10_1, 0;\n';
    await this.sendRAPID(rapid);
  }

  async emergencyStop() {
    console.log('ABB EMERGENCY STOP');
    const rapid = 'Stop;\n';
    await this.sendRAPID(rapid);
  }

  async sendRAPID(command) {
    if (!this.connected || !this.client) {
      throw new Error('ABB Robot not connected');
    }

    return new Promise((resolve, reject) => {
      this.client.write(command, (err) => {
        if (err) {
          reject(new Error(`RAPID command error: ${err.message}`));
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

module.exports = ABBAdapter;