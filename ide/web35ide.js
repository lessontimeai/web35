// Initialize the editor

let currentFile = null;
let files = {};
let currentpeer = null;
let currentPath = []; // Track current folder path
let expandedFolders = new Set(); // Track which folders are expanded
// Console history variables
let consoleHistory = [];
let historyIndex = -1;
let copyBuffer = null;

// Load files from local storage
// "fs/documents/"
function loadFiles() {
    files = {}; // Reset files structure
    
    // Ensure drawings folder exists
    if (!localStorage.getItem('fs/drawings/')) {
        files.drawings = {};
    }
    
    const keys = Object.keys(localStorage);
    
    // Process all localStorage keys that start with "fs/"
    for (const key of keys) {
        if (key.startsWith("fs/")) {
            // Remove "fs/" prefix and split the remaining path
            const pathWithoutPrefix = key.substring(3); // Remove "fs/"
            if (pathWithoutPrefix) {
                const pathParts = pathWithoutPrefix.split("/");
                const content = localStorage.getItem(key);
                
                // Navigate/create the nested structure
                let currentLevel = files;
                
                // Process all path parts except the last one (which is the filename)
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const folderName = pathParts[i];
                    if (!currentLevel[folderName]) {
                        currentLevel[folderName] = {}; // Create folder if it doesn't exist
                    }
                    currentLevel = currentLevel[folderName];
                }
                
                // Set the file content at the final location
                const fileName = pathParts[pathParts.length - 1];
                try {
                    // Try to parse as JSON first (for image files and other structured data)
                    currentLevel[fileName] = JSON.parse(content);
                } catch (e) {
                    // If not valid JSON, store as plain text
                    currentLevel[fileName] = content;
                }
            }
        }
    }

    
    renderFileIcons();
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
function saveFile(path, content) {
    localStorage.setItem(path, content);
}

// Save the entire files structure to localStorage with proper paths
function saveFiles() {
    // Recursively save all files with their proper paths
    function saveRecursive(obj, currentPath = []) {
        for (const [name, content] of Object.entries(obj)) {
            const fullPath = ['fs', ...currentPath, name].join('/');
            
            if (typeof content === 'object' && content !== null && !content.type) {
                // This is a folder, recurse into it
                saveRecursive(content, [...currentPath, name]);
            } else {
                // This is a file, save it
                if (typeof content === 'object') {
                    // For structured data (like images), save as JSON
                    localStorage.setItem(fullPath, JSON.stringify(content));
                } else {
                    // For plain text files, save as string
                    localStorage.setItem(fullPath, content);
                }
            }
        }
    }
    
    saveRecursive(files);
    
    // Also save the legacy 'fs' key for backward compatibility
    localStorage.setItem('fs', JSON.stringify(files));
}

// Save console history to local storage
function saveConsoleHistory() {
    localStorage.setItem('htmlEditorConsoleHistory', JSON.stringify(consoleHistory));
}

// Check if an object represents a folder
function isFolder(obj) {
    if (typeof obj !== 'object' || obj === null) return false;
    if (obj.type === 'image') return false; // Image files are objects but not folders
    return Object.keys(obj).length > 0;
}

// Get current directory contents based on currentPath
function getCurrentDirectory() {
    let current = files;
    for (const pathSegment of currentPath) {
        if (current[pathSegment] && isFolder(current[pathSegment])) {
            current = current[pathSegment];
        } else {
            // Invalid path, reset to root
            currentPath = [];
            return files;
        }
    }
    return current;
}

// Get full path string for display
function getFullPath(name = '') {
    const subfolder = currentPath.length > 0 ? currentPath.join('/') + '/' : '';
    const pathStr = 'fs/' + subfolder + name;
    return pathStr;
}

// Navigate to a folder
function navigateToFolder(folderName) {
    const currentDir = getCurrentDirectory();
    if (currentDir[folderName] && isFolder(currentDir[folderName])) {
        currentPath.push(folderName);
        renderFileIcons();
    }
}

// Navigate up one level
function navigateUp() {
    if (currentPath.length > 0) {
        currentPath.pop();
        renderFileIcons();
    }
}

// Render file icons in the sidebar
function renderFileIcons() {
    sidebar.innerHTML = '';
    
    // Add navigation breadcrumbs
    const breadcrumbDiv = document.createElement('div');
    breadcrumbDiv.className = 'breadcrumbs';
    breadcrumbDiv.style.cssText = `
        padding: 10px;
        border-bottom: 1px solid #333;
        font-size: 12px;
        color: #888;
        display: flex;
        align-items: center;
        gap: 5px;
    `;
    
    // Add root link
    const rootLink = document.createElement('span');
    rootLink.textContent = 'root';
    rootLink.style.cssText = 'cursor: pointer; color: #4a9eff;';
    rootLink.addEventListener('click', () => {
        currentPath = [];
        renderFileIcons();
    });
    breadcrumbDiv.appendChild(rootLink);
    
    // Add path segments
    for (let i = 0; i < currentPath.length; i++) {
        const separator = document.createElement('span');
        separator.textContent = ' / ';
        breadcrumbDiv.appendChild(separator);
        
        const pathLink = document.createElement('span');
        pathLink.textContent = currentPath[i];
        pathLink.style.cssText = 'cursor: pointer; color: #4a9eff;';
        pathLink.addEventListener('click', () => {
            currentPath = currentPath.slice(0, i + 1);
            renderFileIcons();
        });
        breadcrumbDiv.appendChild(pathLink);
    }
    
    sidebar.appendChild(breadcrumbDiv);
    
    const currentDir = getCurrentDirectory();
    
    for (const fileName in currentDir) {
        const fileData = currentDir[fileName];
        const isImage = fileData && typeof fileData === 'object' && fileData.type === 'image';
        const isFolderItem = isFolder(fileData);
        
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        if (currentFile === getFullPath(fileName)) {
            fileIcon.classList.add('active');
        }
        
        const fileIconImg = document.createElement('div');
        fileIconImg.className = 'file-icon-img';
        
        if (isFolderItem) {
            // Show folder icon
            fileIconImg.textContent = '📁';
            fileIconImg.style.fontSize = '16px';
        } else if (isImage) {
            // Show a small preview of the image
            fileIconImg.innerHTML = `<img src="${fileData.content}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 3px;" alt="${fileName}">`;
        } else {
            // Show text file icon
            fileIconImg.textContent = getFileTypeIcon(fileName);
        }
        
        const fileIconName = document.createElement('div');
        fileIconName.className = 'file-icon-name';
        fileIconName.textContent = fileName;
        
        fileIcon.appendChild(fileIconImg);
        fileIcon.appendChild(fileIconName);
        
        if (isFolderItem) {
            fileIcon.addEventListener('click', () => navigateToFolder(fileName));
        } else {
            fileIcon.addEventListener('click', () => selectFile(fileName));
        }
        
        sidebar.appendChild(fileIcon);
    }
}

// Get appropriate icon text based on file extension
function getFileTypeIcon(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    switch (extension) {
        case 'html':
        case 'htm':
            return 'HTML';
        case 'css':
            return 'CSS';
        case 'js':
        case 'jsx':
            return 'JS';
        case 'json':
            return 'JSON';
        case 'md':
            return 'MD';
        case 'txt':
            return 'TXT';
        case 'xml':
            return 'XML';
        case 'py':
            return 'PY';
        case 'java':
            return 'JAVA';
        case 'cpp':
        case 'c':
            return 'C++';
        default:
            return 'FILE';
    }
}

// Select a file to edit
function selectFile(fileName) {
    const fullPath = getFullPath(fileName);
    currentFile = fullPath;
    
    const currentDir = getCurrentDirectory();
    const fileData = currentDir[fileName];
    
    // Check if this is an image file
    if (fileData && typeof fileData === 'object' && fileData.type === 'image') {
        // Display image instead of text
        displayImage(fileData.content, fileName);
    } else if (fileName.toLowerCase().endsWith('.svg')) {
        // Check if this is an SVG file and render it
        const content = typeof fileData === 'string' ? fileData : fileData.content || '';
        displaySVG(content, fileName);
    } else {
        // Handle regular text files
        const content = typeof fileData === 'string' ? fileData : fileData.content || '';
        editor.value = content;
        editor.style.display = 'block';
        // Hide any existing displays
        const existingImageDisplay = document.getElementById('imageDisplay');
        if (existingImageDisplay) {
            existingImageDisplay.style.display = 'none';
        }
        const existingSVGDisplay = document.getElementById('svgDisplay');
        if (existingSVGDisplay) {
            existingSVGDisplay.style.display = 'none';
        }
    }
    
    renderFileIcons();
}

// Display image in the editor area
function displayImage(dataUrl, fileName) {
    // Hide the text editor
    editor.style.display = 'none';
    
    // Create or update image display
    let imageDisplay = document.getElementById('imageDisplay');
    if (!imageDisplay) {
        imageDisplay = document.createElement('div');
        imageDisplay.id = 'imageDisplay';
        imageDisplay.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background-color: #1e1e1e;
            overflow: auto;
        `;
        
        const editorContainer = document.querySelector('.editor-container');
        editorContainer.appendChild(imageDisplay);
    }
    
    imageDisplay.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #f0f0f0; margin-bottom: 10px;">${fileName}</h3>
            <img src="${dataUrl}" style="max-width: 100%; max-height: 70vh; border: 1px solid #333; border-radius: 5px;" alt="${fileName}">
        </div>
        <div style="color: #888; font-size: 12px; text-align: center;">
            Image files are displayed as images and cannot be edited as text.
        </div>
    `;
    
    imageDisplay.style.display = 'flex';
}

// Display SVG in the editor area
function displaySVG(svgContent, fileName) {
    // Hide the text editor
    editor.style.display = 'none';
    
    // Hide any existing image display
    const existingImageDisplay = document.getElementById('imageDisplay');
    if (existingImageDisplay) {
        existingImageDisplay.style.display = 'none';
    }
    
    // Create or update SVG display
    let svgDisplay = document.getElementById('svgDisplay');
    if (!svgDisplay) {
        svgDisplay = document.createElement('div');
        svgDisplay.id = 'svgDisplay';
        svgDisplay.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background-color: #1e1e1e;
            overflow: auto;
        `;
        
        const editorContainer = document.querySelector('.editor-container');
        editorContainer.appendChild(svgDisplay);
    }
    
    // Create a wrapper for the SVG with better styling
    const svgWrapper = document.createElement('div');
    svgWrapper.style.cssText = `
        background: white;
        border: 1px solid #333;
        border-radius: 5px;
        padding: 20px;
        max-width: 100%;
        max-height: 70vh;
        overflow: auto;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    try {
        // Try to parse and render the SVG
        svgWrapper.innerHTML = svgContent;
        
        // Find the SVG element and ensure it's properly sized
        const svgElement = svgWrapper.querySelector('svg');
        if (svgElement) {
            // Make SVG responsive
            if (!svgElement.getAttribute('width') && !svgElement.getAttribute('height')) {
                svgElement.setAttribute('width', '400');
                svgElement.setAttribute('height', '300');
            }
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
        }
        
        svgDisplay.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="color: #f0f0f0; margin-bottom: 10px;">${fileName}</h3>
            </div>
        `;
        
        svgDisplay.appendChild(svgWrapper);
        
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'color: #888; font-size: 12px; text-align: center; margin-top: 15px;';
        infoDiv.innerHTML = `
            SVG files are displayed as rendered graphics. 
            <button onclick="editSVGAsText('${fileName}')" style="background: #4a9eff; color: white; border: none; padding: 5px 10px; border-radius: 3px; margin-left: 10px; cursor: pointer;">Edit as Text</button>
        `;
        svgDisplay.appendChild(infoDiv);
        
    } catch (error) {
        // If SVG parsing fails, show error message
        svgDisplay.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="color: #f0f0f0; margin-bottom: 10px;">${fileName}</h3>
                <div style="color: #e74c3c; padding: 20px; border: 1px solid #e74c3c; border-radius: 5px; background: rgba(231, 76, 60, 0.1);">
                    Invalid SVG content or parsing error
                </div>
            </div>
            <div style="color: #888; font-size: 12px; text-align: center;">
                <button onclick="editSVGAsText('${fileName}')" style="background: #4a9eff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Edit as Text</button>
            </div>
        `;
    }
    
    svgDisplay.style.display = 'flex';
}

// Edit SVG as text (switch from rendered view to text editor)
function editSVGAsText(fileName) {
    const currentDir = getCurrentDirectory();
    const fileData = currentDir[fileName];
    const content = typeof fileData === 'string' ? fileData : fileData.content || '';
    
    // Hide SVG display
    const svgDisplay = document.getElementById('svgDisplay');
    if (svgDisplay) {
        svgDisplay.style.display = 'none';
    }
    
    // Show text editor with SVG content
    editor.value = content;
    editor.style.display = 'block';
    
    logToConsole(`Switched to text editing mode for ${fileName}`, 'info');
}

// Save the current file
function saveCurrentFile() {
    if (currentFile) {
        const fileName = currentFile.split('/').pop(); // Get just the filename
        const currentDir = getCurrentDirectory();
        const fileData = currentDir[fileName];
        
        // Check if this is an image file
        if (fileData && typeof fileData === 'object' && fileData.type === 'image') {
            logToConsole('Image files cannot be edited and are already saved.', 'info');
            return;
        }
        
        // Check if this is an SVG file being displayed in rendered mode
        if (fileName.toLowerCase().endsWith('.svg') && editor.style.display === 'none') {
            logToConsole('SVG is in preview mode. Click "Edit as Text" to make changes.', 'info');
            return;
        }
        
        // Save text file
        currentDir[fileName] = editor.value;
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
            const fileName = currentFile.split('/').pop(); // Get just the filename
            const currentDir = getCurrentDirectory();
            delete currentDir[fileName];
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
    document.querySelector('.modal-title').textContent = 'Create New File';
    fileNameInput.value = '';
    fileNameInput.placeholder = 'e.g., index.html';
    fileNameInput.focus();
    
    // Set the confirm button behavior
    const confirmBtn = document.getElementById('confirmCreateBtn');
    confirmBtn.onclick = () => createNewFile(fileNameInput.value.trim());
}

// Show the create folder modal (same modal, different handling)
function showCreateFolderModal() {
    createFileModal.style.display = 'flex';
    document.querySelector('.modal-title').textContent = 'Create New Folder';
    fileNameInput.value = '';
    fileNameInput.placeholder = 'e.g., components';
    fileNameInput.focus();
    
    // Set the confirm button behavior
    const confirmBtn = document.getElementById('confirmCreateBtn');
    confirmBtn.onclick = () => createNewFolder(fileNameInput.value.trim());
}

// Hide the create file modal
function hideCreateFileModal() {
    createFileModal.style.display = 'none';
    // Reset to default state
    document.querySelector('.modal-title').textContent = 'Create New File';
    fileNameInput.placeholder = 'e.g., index.html';
    const confirmBtn = document.getElementById('confirmCreateBtn');
    confirmBtn.onclick = () => createNewFile(fileNameInput.value.trim());
}

// Show SVG Editor
function showSVGEditor() {
    const svgModal = document.getElementById('svgEditorModal');
    svgModal.style.display = 'block';
    
    // Listen for SVG save events from the iframe
    window.addEventListener('message', handleSVGMessage);
}

// Hide SVG Editor
function hideSVGEditor() {
    const svgModal = document.getElementById('svgEditorModal');
    svgModal.style.display = 'none';
    
    // Remove the message listener when closing
    window.removeEventListener('message', handleSVGMessage);
    
    // Refresh file icons to show any new drawings
    loadFiles();
}

// Handle messages from SVG editor iframe
function handleSVGMessage(event) {
    if (event.data && event.data.type === 'svgSaved') {
        // The SVG editor saved a file, refresh our file system
        setTimeout(() => {
            loadFiles(); // Refresh to show the new drawing
        }, 100);
    }
}

// Create a new file
function createNewFile(fileName) {
    if (!fileName) {
        alert('Please enter a file name.');
        return;
    }
    
    const currentDir = getCurrentDirectory();
    
    if (currentDir[fileName]) {
        if (!confirm(`File "${fileName}" already exists. Do you want to overwrite it?`)) {
            return;
        }
    }
    
    currentDir[fileName] = '';
    currentFile = getFullPath(fileName);
    editor.value = '';
    renderFileIcons();
    hideCreateFileModal();
    saveFile(currentFile, '');
    logToConsole('New file created: ' + currentFile, 'info');

}

// Create a new folder
function createNewFolder(folderName) {
    if (!folderName) {
        alert('Please enter a folder name.');
        return;
    }
    
    // Validate folder name (no special characters that could break paths)
    if (folderName.includes('/') || folderName.includes('\\')) {
        alert('Folder names cannot contain slashes.');
        return;
    }
    
    const currentDir = getCurrentDirectory();
    
    if (currentDir[folderName]) {
        alert(`"${folderName}" already exists in this directory.`);
        return;
    }
    
    currentDir[folderName] = {}; // Empty object represents a folder
    saveFiles();
    renderFileIcons();
    hideCreateFileModal();
    logToConsole('New folder created: ' + getFullPath(folderName), 'info');
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

// Show import file dialog
function showImportDialog() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();
}

// Handle files selected from import dialog
function handleImportFiles(event) {
    const files = event.target.files;
    if (files.length > 0) {
        handleFiles(files);
        // Reset the file input so the same file can be selected again
        event.target.value = '';
    }
}

// Handle multiple files (shared by drag and drop and file dialog)
function handleFiles(fileList) {
    [...fileList].forEach(uploadFile);
}

// Upload a single file (shared by drag and drop and file dialog)
function uploadFile(file) {
    const reader = new FileReader();
    const fileName = file.name;
    
    // Check if file is an image
    const isImage = file.type.startsWith('image/');
    
    reader.onload = function(e) {
        const content = e.target.result;
        const currentDir = getCurrentDirectory();
        
        // Check if file already exists
        if (currentDir[fileName]) {
            if (!confirm(`File "${fileName}" already exists. Do you want to overwrite it?`)) {
                return;
            }
        }
        
        // Add file to the current directory with metadata
        if (isImage) {
            currentDir[fileName] = {
                type: 'image',
                content: content, // This will be a data URL
                originalName: fileName
            };
        } else {
            currentDir[fileName] = content; // Keep text files as simple strings for backward compatibility
        }
        
        saveFiles();
        renderFileIcons();
        
        // Select the newly imported file
        selectFile(fileName);
        
        const fullPath = getFullPath(fileName);
        logToConsole(`File imported: ${fullPath}${isImage ? ' (image)' : ''}`, 'info');
    };
    
    reader.onerror = function() {
        logToConsole(`Error reading file: ${file.name}`, 'error');
    };
    
    // Read the file differently based on type
    if (isImage) {
        reader.readAsDataURL(file);
    } else {
        reader.readAsText(file);
    }
}

// Handle drag and drop functionality
function handleDragAndDrop() {
    const sidebar = document.getElementById('sidebar');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        sidebar.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        sidebar.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        sidebar.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    sidebar.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        sidebar.classList.add('drag-over');
    }
    
    function unhighlight(e) {
        sidebar.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        handleFiles(files);
    }
}

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
handleDragAndDrop();

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
                    
                    // Navigate to the correct directory or create it if it doesn't exist
                    let targetDir = files;
                    if (file.path && file.path.length > 0) {
                        for (const pathSegment of file.path) {
                            if (!targetDir[pathSegment]) {
                                targetDir[pathSegment] = {}; // Create folder if it doesn't exist
                            }
                            targetDir = targetDir[pathSegment];
                        }
                    }
                    
                    targetDir[file.name] = file.content;
                    saveFiles();
                    renderFileIcons();
                    const fullPath = file.path && file.path.length > 0 ? 
                                    file.path.join('/') + '/' + file.name : file.name;
                    logToConsole(`Received file "${fullPath}" from ${data["peerId"]}`, 'info');
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
    const computersTab = document.getElementById("computersTab");
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
      const fileName = currentFile.split('/').pop(); // Get just the filename
      const currentDir = getCurrentDirectory();
      const fileData = currentDir[fileName];
      
      // Handle both image and text files
      if (fileData && typeof fileData === 'object' && fileData.type === 'image') {
        copyBuffer = { name: fileName, content: fileData, path: currentPath.slice() };
      } else {
        copyBuffer = { name: fileName, content: fileData, path: currentPath.slice() };
      }
      
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
        logToConsole(`Sent "${copyBuffer.name}" to ${currentpeer ? '1 peer' : peers.length + ' peer(s)'}.`, 'info');
      }
    } else {
      logToConsole('Copy buffer is empty. Use Ctrl+C first.', 'error');
    }
  }
});


listeners = {
    "saveBtn" : saveCurrentFile,
    "deleteBtn" : deleteCurrentFile,
    "newFileBtn" : showCreateFileModal,
    "newFolderBtn" : showCreateFolderModal,
    "importBtn" : showImportDialog,
    "cancelCreateBtn" : hideCreateFileModal,
    "clearConsoleBtn" : clearConsole,
    "svgEditorBtn" : showSVGEditor,
    "closeSVGEditorBtn" : hideSVGEditor,
}

for (const [id, listener] of Object.entries(listeners)) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', listener);
    } else {
        console.warn(`Element with ID "${id}" not found.`);
    }
}

// Add file input event listener
const fileInput = document.getElementById('fileInput');
if (fileInput) {
    fileInput.addEventListener('change', handleImportFiles);
}
