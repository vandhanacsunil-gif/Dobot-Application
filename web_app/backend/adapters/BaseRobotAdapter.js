class BaseRobotAdapter {
  constructor(port, config) {
    this.port = port;
    this.config = config;
    this.connected = false;
    this.position = { x: 0, y: 0, z: 0, r: 0, j1: 0, j2: 0, j3: 0, j4: 0 };
  }

  static getName() {
    throw new Error('getName() must be implemented');
  }

  async connect() {
    throw new Error('connect() must be implemented');
  }

  async disconnect() {
    throw new Error('disconnect() must be implemented');
  }

  getStatus() {
    return {
      connected: this.connected,
      position: this.position
    };
  }

  async home() {
    throw new Error('home() must be implemented');
  }

  async moveCartesian(coordinates, speed) {
    throw new Error('moveCartesian() must be implemented');
  }

  async moveJoint(coordinates, speed) {
    throw new Error('moveJoint() must be implemented');
  }

  getCurrentPosition() {
    return this.position;
  }

  async setGripper(state) {
    throw new Error('setGripper() must be implemented');
  }

  updatePosition(newPosition) {
    this.position = { ...this.position, ...newPosition };
  }
}

module.exports = BaseRobotAdapter;