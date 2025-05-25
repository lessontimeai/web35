// Initialize the editor
const editor = document.getElementById('editor');
const sidebar = document.getElementById('sidebar');
const consoleContent = document.getElementById('console-content');
const consoleInput = document.getElementById('console-input');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const newFileBtn = document.getElementById('new-file-btn');
const clearConsoleBtn = document.getElementById('clear-console-btn');
const createFileModal = document.getElementById('create-file-modal');
const fileNameInput = document.getElementById('file-name');
const confirmCreateBtn = document.getElementById('confirm-create');
const cancelCreateBtn = document.getElementById('cancel-create');
const resizer = document.getElementById('resizer');

let currentFile = null;
let files = {};
let currentpeer = null;
// Console history variables
let consoleHistory = [];
let historyIndex = -1;
let copyBuffer = null;


async function llm_response(prompt){
    const generator = await pipeline('text-generation', 'Xenova/distilgpt2');
    const output = await generator(prompt);
    return output[0].generated_text;
}





// Load files from local storage
function loadFiles() {
    const storedFiles = localStorage.getItem('fs');
    if (storedFiles) {
        files = JSON.parse(storedFiles);
        renderFileIcons();
    }
}

// Load console history from local storage
function loadConsoleHistory() {
    const storedHistory = localStorage.getItem('htmlEditorConsoleHistory');
    if (storedHistory) {
        try {
            consoleHistory = JSON.parse(storedHistory);
            // Limit history size to prevent excessive storage
            if (consoleHistory.length > 100) {
                consoleHistory = consoleHistory.slice(-100);
            }
            historyIndex = consoleHistory.length;
        } catch (e) {
            consoleHistory = [];
            historyIndex = -1;
        }
    }
}

// Save files to local storage
function saveFiles() {
    localStorage.setItem('fs', JSON.stringify(files));
}

// Save console history to local storage
function saveConsoleHistory() {
    localStorage.setItem('htmlEditorConsoleHistory', JSON.stringify(consoleHistory));
}

// Render file icons in the sidebar
function renderFileIcons() {
    sidebar.innerHTML = '';
    
    for (const fileName in files) {
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        if (currentFile === fileName) {
            fileIcon.classList.add('active');
        }
        
        const fileIconImg = document.createElement('div');
        fileIconImg.className = 'file-icon-img';
        fileIconImg.textContent = 'HTML';
        
        const fileIconName = document.createElement('div');
        fileIconName.className = 'file-icon-name';
        fileIconName.textContent = fileName;
        
        fileIcon.appendChild(fileIconImg);
        fileIcon.appendChild(fileIconName);
        
        fileIcon.addEventListener('click', () => selectFile(fileName));
        
        sidebar.appendChild(fileIcon);
    }
}

// Select a file to edit
function selectFile(fileName) {
    currentFile = fileName;
    editor.value = files[fileName];
    renderFileIcons();
}

// Save the current file
function saveCurrentFile() {
    if (currentFile) {
        files[currentFile] = editor.value;
        saveFiles();
        logToConsole('File saved: ' + currentFile, 'info');
    } else {
        logToConsole('No file selected to save.', 'error');
    }
}

// Delete the current file
function deleteCurrentFile() {
    if (currentFile) {
        if (confirm(`Are you sure you want to delete "${currentFile}"?`)) {
            delete files[currentFile];
            saveFiles();
            editor.value = '';
            currentFile = null;
            renderFileIcons();
            logToConsole('File deleted successfully.', 'info');
        }
    } else {
        logToConsole('No file selected to delete.', 'error');
    }
}

// Show the create file modal
function showCreateFileModal() {
    createFileModal.style.display = 'flex';
    fileNameInput.value = '';
    fileNameInput.focus();
}

// Hide the create file modal
function hideCreateFileModal() {
    createFileModal.style.display = 'none';
}

// Create a new file
function createNewFile(fileName) {
    
    if (!fileName) {
        alert('Please enter a file name.');
        return;
    }
    
    if (files[fileName]) {
        if (!confirm(`File "${fileName}" already exists. Do you want to overwrite it?`)) {
            return;
        }
    }
    
    files[fileName] = '';
    saveFiles();
    currentFile = fileName;
    editor.value = '';
    renderFileIcons();
    hideCreateFileModal();
    logToConsole('New file created: ' + fileName, 'info');
}

// Log message to the console
function logToConsole(message, type = '') {
    const logElement = document.createElement('div');
    logElement.className = 'log';
    
    if (type === 'error') {
        logElement.classList.add('log-error');
        message = 'Error: ' + message;
    } else if (type === 'info') {
        logElement.classList.add('log-info');
        message = 'Info: ' + message;
    }
    
    logElement.textContent = message;
    consoleContent.appendChild(logElement);
    consoleContent.scrollTop = consoleContent.scrollHeight;
}

// Execute JavaScript in the console
function executeConsoleCode(code) {
    const logElement = document.createElement('div');
    logElement.className = 'log';
    logElement.textContent = '> ' + code;
    consoleContent.appendChild(logElement);
    
    // Add command to history (only if it's not empty and not a duplicate of the most recent command)
    if (code.trim() !== '' && (consoleHistory.length === 0 || consoleHistory[consoleHistory.length - 1] !== code)) {
        consoleHistory.push(code);
        saveConsoleHistory();
    }
    // Reset history index to point to end of history
    historyIndex = consoleHistory.length;
    
    try {
        // Create a custom console.log function
        const originalConsoleLog = console.log;
        const originalConsoleError = console.error;
        const originalConsoleInfo = console.info;
        
        console.log = function(...args) {
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');
            logToConsole(message);
        };
        
        console.error = function(...args) {
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');
            logToConsole(message, 'error');
        };
        
        console.info = function(...args) {
            const message = args.map(arg => {
                if (typeof arg === 'object') {
                    return JSON.stringify(arg, null, 2);
                }
                return String(arg);
            }).join(' ');
            logToConsole(message, 'info');
        };
        
        // Execute the code
        const result = eval(code);
        
        // Restore original console functions
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.info = originalConsoleInfo;
        
        // Log the result if it's not undefined
        if (result !== undefined) {
            logToConsole('← ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : result));
        }
    } catch (error) {
        logToConsole(error.message, 'error');
    }
    
    consoleContent.scrollTop = consoleContent.scrollHeight;
}

// Clear the console
function clearConsole() {
    consoleContent.innerHTML = '';
}

// Resize the console
function makeResizable() {
    let startY, startHeight;
    
    resizer.addEventListener('mousedown', (e) => {
        startY = e.clientY;
        const consoleContainer = document.querySelector('.console-container');
        startHeight = parseInt(window.getComputedStyle(consoleContainer).height, 10);
        
        document.documentElement.addEventListener('mousemove', doDrag);
        document.documentElement.addEventListener('mouseup', stopDrag);
    });
    
    function doDrag(e) {
        const consoleContainer = document.querySelector('.console-container');
        consoleContainer.style.height = (startHeight - (e.clientY - startY)) + 'px';
    }
    
    function stopDrag() {
        document.documentElement.removeEventListener('mousemove', doDrag);
        document.documentElement.removeEventListener('mouseup', stopDrag);
    }
}

// Event listeners
saveBtn.addEventListener('click', saveCurrentFile);
deleteBtn.addEventListener('click', deleteCurrentFile);
newFileBtn.addEventListener('click', showCreateFileModal);
confirmCreateBtn.addEventListener('click', () => createNewFile(fileNameInput.value.trim()));
cancelCreateBtn.addEventListener('click', hideCreateFileModal);
clearConsoleBtn.addEventListener('click', clearConsole);

// Console input event listener with history navigation
consoleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const code = consoleInput.value;
        consoleInput.value = '';
        executeConsoleCode(code);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault(); // Prevent cursor from moving to the beginning of the input
        
        // Go back in history if possible
        if (historyIndex > 0) {
            historyIndex--;
            consoleInput.value = consoleHistory[historyIndex];
            
            // Move cursor to the end of the input text
            setTimeout(() => {
                consoleInput.selectionStart = consoleInput.selectionEnd = consoleInput.value.length;
            }, 0);
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault(); // Prevent cursor from moving to the end of the input
        
        // Go forward in history or clear if at the end
        if (historyIndex < consoleHistory.length - 1) {
            historyIndex++;
            consoleInput.value = consoleHistory[historyIndex];
            
            // Move cursor to the end of the input text
            setTimeout(() => {
                consoleInput.selectionStart = consoleInput.selectionEnd = consoleInput.value.length;
            }, 0);
        } else if (historyIndex === consoleHistory.length - 1) {
            // At the end of history, clear the input
            historyIndex = consoleHistory.length;
            consoleInput.value = '';
        }
    }
});

// Prevent modal from closing when clicking inside the modal content
document.querySelector('.modal-content').addEventListener('click', (e) => {
    e.stopPropagation();
});

// Close modal when clicking outside the modal content
createFileModal.addEventListener('click', hideCreateFileModal);

// Allow pressing Enter in the file name input to create a file
fileNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        createNewFile(fileNameInput.value.trim());
    }
});

// Save history when page is about to unload
window.addEventListener('beforeunload', () => {
    saveConsoleHistory();
});

// Initialize
loadFiles();
loadConsoleHistory();
makeResizable();

// Welcome messages
logToConsole('Welcome to Web3.5 IDE!', 'info');
logToConsole('Create a new file or select an existing one to start editing.', 'info');
logToConsole('Use this console to execute JavaScript code.', 'info');
logToConsole('Use up and down arrow keys to navigate through command history!', 'info');

var network = null;
document.addEventListener("DOMContentLoaded", () => {
    network = new PeerNetwork({"roomId": "web35",
        "onData" : (data) => {
            console.log("Received data from peer: ", data);
            if (data["command"] != null){
                if (data["command"]=="ls"){
                    console.log("Received ls command from peer: ", data);
                    const storedFiles = localStorage.getItem('fs');
                    network.sendTo(data["peerId"], {"files": storedFiles});
                }
                if (data["command"]=="paste"){
                    console.log("Received file command from peer: ", data);
                    const file = JSON.parse(data["file"]);
                    files[file.name] = file.content;
                    saveFiles();
                    logToConsole(`Received file "${file.name}" from ${data["peerId"]}`, 'info');
                }
                if (data["command"]=="generate"){
                    console.log("Received generate command from peer: ", data);
                    const prompt = data["prompt"];
                    llm_response(prompt).then(response => {
                        network.sendTo(data["peerId"], {"response": response});
                    });
                }
            }
            if (data["files"] != null){
                console.log("Received files from peer: ", data);
                files = data["files"];
                files = JSON.parse(files);
                renderFileIcons();
            }
            if (data["response"] != null){
                const response = data["response"];
                logToConsole(`Received response from ${data["peerId"]}: ${response}`, 'info');
            }
        }
    });
    // Iterate through the Set and create a button for each peer
});

function createTopTabButton(name, callback) {
    const button = document.createElement("button");
    button.id = name;
    button.classList.add("btn", "btngray");
    button.textContent = name;
    button.onclick = callback;
    return button;
}

function updateComputersTab() {
    const computersTab = document.getElementById("computers-tab");
    computersTab.innerHTML = '';

    // Add the home button
    computersTab.appendChild(createTopTabButton(`home-${network.peerId}`, loadFiles));

    // Add buttons for connected peers
    const peers = network.getConnectedPeers();
    peers.forEach(peer => {
        const callback = () => {
            console.log("Clicked on peer:", peer);
            currentpeer = peer;
            network.sendTo(peer, { command: "ls", peerId: network.peerId });
        };
        computersTab.appendChild(createTopTabButton(`peer-${peer}`, callback));
    });
}

function sendGeneratetoCurrentPeer(prompt){
    if (currentpeer != null){
        network.sendTo(currentpeer, { command: "generate", prompt: prompt, peerId: network.peerId });
    } else {
        logToConsole('No peer selected to send the prompt.', 'error');
    }
}


// Update the computers tab every 2 seconds
setInterval(updateComputersTab, 2000);


// Handle Ctrl+S: copy current file into buffer
document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault();
    if (currentFile) {
      copyBuffer = { name: currentFile, content: files[currentFile] };
      logToConsole(`Copied "${currentFile}" to buffer. Press Ctrl+V to send.`, 'info');
    } else {
      logToConsole('No file selected to copy.', 'error');
    }
  }
  // Handle Ctrl+V: send buffer to peers
  if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault();
    if (copyBuffer) {
      const peers = network.getConnectedPeers();
      if (peers.length === 0) {
        logToConsole('No peers connected.', 'error');
      } else {
        network.sendTo(currentpeer, { command: "paste", 
                                file: JSON.stringify(copyBuffer),  // Send the file as a string 
                                peerId: network.peerId });
        logToConsole(`Sent "${copyBuffer.name}" to ${peers.length} peer(s).`, 'info');
      }
    } else {
      logToConsole('Copy buffer is empty. Use Ctrl+S first.', 'error');
    }
  }
});