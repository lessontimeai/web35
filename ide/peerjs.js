class PeerNetwork {
  constructor(options = {}) {
    // Default options
    this.options = {
      roomId: options.roomId || this._generateRoomId(),
      prefix: options.prefix || 'computer-',
      peerConfig: options.peerConfig || {
        host: LESSONTIME_HOST,
        port: LESSONTIME_PORT,
        path: '/peers',
        secure: true,
        key: `.${LESSONTIME_KEY}.`
      },
      onOpen: options.onOpen || (() => {}),
      onConnection: options.onConnection || (() => {}),
      onData: options.onData || (() => {}),
      onClose: options.onClose || (() => {}),
      onError: options.onError || ((err) => { console.error(err); })
    };

    this.fullPrefix = `${this.options.prefix}${this.options.roomId}`;
    this.peerId = this._getOrCreatePeerId();

    this.connections = new Set();
    this.allPeers = new Set();
    this.isInitialized = false;

    this._initializePeer();
  }

  _initializePeer() {
    this.peer = new Peer(this.peerId, this.options.peerConfig);

    this.peer.on('open', (id) => {
      this.isInitialized = true;
      this._connectToRoomPeers();
      this.options.onOpen(id, this.options.roomId);
    });

    this.peer.on('connection', (conn) => {
      this._setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      this.options.onError(err);
    });
  }

  _connectToRoomPeers() {
    this.listAllPeers((roomPeers) => {
      roomPeers.forEach((pid) => {
        if (pid !== this.peer.id) {
          const conn = this.peer.connect(pid);
          this._setupConnection(conn);
        }
      });
    });
  }

  _setupConnection(conn) {
    conn.on('open', () => {
      this.connections.add(conn);
      this.allPeers.add(conn.peer);
      this.options.onConnection(conn);

      conn.on('close', () => {
        this.connections.delete(conn);
        this.options.onClose(conn.peer);
      });

      conn.on('error', (err) => {
        this.options.onError(err);
      });
    });

    conn.on('data', (data) => {
      this.options.onData(data, conn.peer);
    });
  }

  listAllPeers(callback) {
    this.peer.listAllPeers((allPeers) => {
      const roomPeers = allPeers.filter(pid => pid.startsWith(this.fullPrefix));
      this.allPeers = new Set([...this.allPeers, ...roomPeers]);
      callback(roomPeers);
    });
  }

  getAllDiscoveredPeers() {
    return Array.from(this.allPeers);
  }

  broadcast(data) {
    if (!this.isInitialized) {
      this.options.onError(new Error('Cannot broadcast: peer not initialized'));
      return false;
    }
    this.connections.forEach(conn => conn.send(data));
    return true;
  }

  sendTo(peerId, data) {
    if (!this.isInitialized) {
      this.options.onError(new Error('Cannot send: peer not initialized'));
      return false;
    }
    for (const conn of this.connections) {
      if (conn.peer === peerId) {
        conn.send(data);
        return true;
      }
    }
    if (this.allPeers.has(peerId)) {
      const conn = this.peer.connect(peerId);
      conn.on('open', () => {
        conn.send(data);
        this._setupConnection(conn);
      });
      return true;
    }
    return false;
  }

  getConnectedPeers() {
    return Array.from(this.connections).map(conn => conn.peer);
  }

  getConnectionCount() {
    return this.connections.size;
  }

  getRoomLink() {
    return `${window.location.origin}${window.location.pathname}?room=${this.options.roomId}`;
  }

  refreshPeers(callback) {
    this.listAllPeers((peers) => {
      if (callback) callback(peers);
    });
  }

  isPeerConnected(peerId) {
    for (const conn of this.connections) {
      if (conn.peer === peerId) return true;
    }
    return false;
  }

  disconnect() {
    this.connections.forEach(conn => {
      conn.close();
    });
    this.peer.destroy();
    this.isInitialized = false;
  }

  _generateRoomId() {
    return Math.random().toString(36).substr(2, 5);
  }

  _generateRandomString() {
    return Math.random().toString(36).substr(2, 5);
  }

  _getOrCreatePeerId() {
    const key = `peerId-${this.fullPrefix}`;
    let storedId = localStorage.getItem(key);
    if (!storedId) {
      storedId = `${this.fullPrefix}-${this._generateRandomString()}`;
      localStorage.setItem(key, storedId);
    }
    return storedId;
  }
}
