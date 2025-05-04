 
 // Get room ID from URL or use default
 function getRoomIdFromUrl() {
   const params = new URLSearchParams(window.location.search);
   return params.get('room') || 'default-room';
 }
 
 // Create network with callbacks
 const network = new PeerNetwork({
   roomId: getRoomIdFromUrl(),
   prefix: 'myapp-',
   peerConfig: {
     host: 'my-server.com',
     port: 443,
     path: '/peerjs',
     secure: true,
     key: "my-key-here"
   },
   onOpen: (id, roomId) => {
     console.log(`Connected with ID: ${id} in room: ${roomId}`);
     displayShareLink(network.getRoomLink());
     
     // List all peers in the room
     network.refreshPeers((peers) => {
       console.log('All peers in the room:', peers);
     });
   },
   onConnection: (conn) => {
     console.log(`New peer connected: ${conn.peer}`);
     updatePeerCount(network.getConnectionCount());
     
     // Send a welcome message to the new peer
     network.sendTo(conn.peer, {
       type: 'welcome',
       message: 'Welcome to the room!'
     });
   },
   onData: (data, fromPeerId) => {
     console.log(`Received data from ${fromPeerId}:`, data);
     if (data.type === 'position') {
       updatePeerPosition(fromPeerId, data.x, data.y);
     }
   },
   onClose: (peerId) => {
     console.log(`Peer disconnected: ${peerId}`);
     removePeer(peerId);
     updatePeerCount(network.getConnectionCount());
   },
   onError: (err) => {
     console.error('Network error:', err);
     displayErrorMessage(err.message);
   }
 });
 
 // Send position data to all peers
 function sendPosition(x, y) {
   network.broadcast({
     type: 'position',
     x: x,
     y: y
   });
 }
 
 // Send a private message to a specific peer
 function sendPrivateMessage(peerId, message) {
   network.sendTo(peerId, {
     type: 'private-message',
     message: message
   });
 }
 
 // Get a list of all peers and display them
 function displayPeerList() {
   network.refreshPeers((peers) => {
     const connectedPeers = network.getConnectedPeers();
     
     // Display all peers with connection status
     peers.forEach(peerId => {
       const isConnected = connectedPeers.includes(peerId);
       displayPeer(peerId, isConnected);
     });
   });
 }
 
 // Clean up on page unload
 window.addEventListener('beforeunload', () => {
   network.disconnect();
 });
