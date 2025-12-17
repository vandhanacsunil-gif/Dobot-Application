const BaseRobotAdapter = require('./BaseRobotAdapter');
const net = require('net');

class UniversalRobotsAdapter extends BaseRobotAdapter {
  static getName() {
    return 'Universal Robots';
  }

  async connect() {
    this.client = new net.Socket();
    
    return new Promise((resolve, reject) => {
      this.client.connect(this.config.port || 30002, this.config.host || '192.168.1.1', () => {
        this.connected = true;
        console.log('Universal Robot connected');
        resolve();
      });

      this.client.on('error', (err) => {
        reject(err);
      });

      this.client.on('data', (data) => {
        this.handleResponse(data);
      });
    });
  }

  async disconnect() {
    if (this.client) {
      this.client.destroy();
      this.connected = false;
    }
  }

  async home() {
    return this.sendURScript('movej([0, -1.57, 0, -1.57, 0, 0], a=1.2, v=0.25)');
  }

  async moveCartesian({ x, y, z, r }, speed) {
    const pose = `p[${x/1000}, ${y/1000}, ${z/1000}, ${r}, 0, 0]`;
    await this.sendURScript(`movel(${pose}, a=1.2, v=${speed/100})`);
    this.updatePosition({ x, y, z, r });
  }

  async moveJoint({ j1, j2, j3, j4, j5, j6 }, speed) {
    const joints = `[${j1}, ${j2}, ${j3}, ${j4}, ${j5 || 0}, ${j6 || 0}]`;
    await this.sendURScript(`movej(${joints}, a=1.2, v=${speed/100})`);
    this.updatePosition({ j1, j2, j3, j4 });
  }

  async setGripper(state) {
    // Implement gripper control based on your gripper type
    const command = state ? 'set_digital_out(0, True)' : 'set_digital_out(0, False)';
    return this.sendURScript(command);
  }

  sendURScript(script) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Robot not connected'));
        return;
      }

      this.client.write(script + '\n', (err) => {
        if (err) {
          reject(err);
        } else {
          setTimeout(resolve, 100);
        }
      });
    });
  }

  handleResponse(data) {
    // Parse robot feedback
    console.log('Robot response:', data.toString());
  }
}

module.exports = UniversalRobotsAdapter;