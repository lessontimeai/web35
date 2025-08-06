class SVGEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.textInput = document.getElementById('textInput');
        this.currentTool = 'select';
        this.isDrawing = false;
        this.isDragging = false;
        this.startPoint = null;
        this.dragOffset = null;
        this.currentElement = null;
        this.selectedElement = null;
        this.pathData = '';

        this.setupEventListeners();
        this.updateStrokeWidthDisplay();
    }

    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTool = e.target.id.replace('Tool', '');
                this.clearSelection();
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));

        // Text input
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.finalizeText();
            }
        });

        this.textInput.addEventListener('blur', () => {
            this.finalizeText();
        });

        // Controls
        document.getElementById('clearCanvas').addEventListener('click', () => {
            this.canvas.innerHTML = '';
            this.clearSelection();
        });

        document.getElementById('saveToStorage').addEventListener('click', () => {
            this.saveToLocalStorage();
        });

        document.getElementById('loadFromStorage').addEventListener('click', () => {
            this.loadFromLocalStorage();
        });

        document.getElementById('downloadSVG').addEventListener('click', () => {
            this.downloadSVG();
        });

        document.getElementById('deleteSelected').addEventListener('click', () => {
            if (this.selectedElement) {
                this.selectedElement.remove();
                this.clearSelection();
            }
        });

        // Stroke width display
        document.getElementById('strokeWidth').addEventListener('input', () => {
            this.updateStrokeWidthDisplay();
        });
    }

    updateStrokeWidthDisplay() {
        const value = document.getElementById('strokeWidth').value;
        document.getElementById('strokeWidthValue').textContent = value;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    getStyles() {
        return {
            fill: document.getElementById('fillColor').value,
            stroke: document.getElementById('strokeColor').value,
            strokeWidth: document.getElementById('strokeWidth').value
        };
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);

        if (this.currentTool === 'select') {
            if (e.target !== this.canvas && e.target !== this.selectedElement) {
                this.selectElement(e.target);
            }
            
            // Start dragging if clicking on selected element
            if (this.selectedElement && e.target === this.selectedElement) {
                this.isDragging = true;
                this.dragOffset = this.calculateDragOffset(pos, this.selectedElement);
                e.preventDefault();
            }
            return;
        }

        if (this.currentTool === 'text') return;

        this.startPoint = pos;
        this.isDrawing = true;

        if (this.currentTool === 'path') {
            this.pathData = `M ${pos.x} ${pos.y}`;
            this.currentElement = this.createPath();
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);

        // Handle dragging selected elements
        if (this.isDragging && this.selectedElement) {
            this.moveElement(this.selectedElement, pos);
            return;
        }

        if (!this.isDrawing || this.currentTool === 'text') return;

        switch (this.currentTool) {
            case 'rect':
                this.updateRectangle(pos);
                break;
            case 'circle':
                this.updateCircle(pos);
                break;
            case 'line':
                this.updateLine(pos);
                break;
            case 'polygon':
                this.updateTriangle(pos);
                break;
            case 'path':
                this.updatePath(pos);
                break;
        }
    }

    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragOffset = null;
        }

        if (this.isDrawing) {
            this.isDrawing = false;
            this.currentElement = null;
            this.startPoint = null;
        }
    }

    handleClick(e) {
        if (this.currentTool === 'text') {
            const pos = this.getMousePos(e);
            this.showTextInput(pos);
        }
    }

    showTextInput(pos) {
        this.textInput.style.display = 'block';
        this.textInput.style.left = (pos.x + this.canvas.getBoundingClientRect().left) + 'px';
        this.textInput.style.top = (pos.y + this.canvas.getBoundingClientRect().top) + 'px';
        this.textInput.value = '';
        this.textInput.focus();
        this.textInputPos = pos;
    }

    finalizeText() {
        if (this.textInput.value.trim()) {
            this.createText(this.textInputPos, this.textInput.value);
        }
        this.textInput.style.display = 'none';
    }

    createText(pos, text) {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', pos.x);
        textElement.setAttribute('y', pos.y);
        textElement.setAttribute('fill', document.getElementById('fillColor').value);
        textElement.setAttribute('font-size', document.getElementById('fontSize').value);
        textElement.setAttribute('font-family', 'Arial, sans-serif');
        textElement.textContent = text;
        textElement.style.cursor = 'pointer';
        this.canvas.appendChild(textElement);
    }

    updateRectangle(pos) {
        if (!this.currentElement) {
            this.currentElement = this.createRectangle();
        }

        const x = Math.min(this.startPoint.x, pos.x);
        const y = Math.min(this.startPoint.y, pos.y);
        const width = Math.abs(pos.x - this.startPoint.x);
        const height = Math.abs(pos.y - this.startPoint.y);

        this.currentElement.setAttribute('x', x);
        this.currentElement.setAttribute('y', y);
        this.currentElement.setAttribute('width', width);
        this.currentElement.setAttribute('height', height);
    }

    updateCircle(pos) {
        if (!this.currentElement) {
            this.currentElement = this.createCircle();
        }

        const cx = this.startPoint.x;
        const cy = this.startPoint.y;
        const rx = Math.abs(pos.x - this.startPoint.x);
        const ry = Math.abs(pos.y - this.startPoint.y);

        this.currentElement.setAttribute('cx', cx);
        this.currentElement.setAttribute('cy', cy);
        this.currentElement.setAttribute('rx', rx);
        this.currentElement.setAttribute('ry', ry);
    }

    updateLine(pos) {
        if (!this.currentElement) {
            this.currentElement = this.createLine();
        }

        this.currentElement.setAttribute('x1', this.startPoint.x);
        this.currentElement.setAttribute('y1', this.startPoint.y);
        this.currentElement.setAttribute('x2', pos.x);
        this.currentElement.setAttribute('y2', pos.y);
    }

    updateTriangle(pos) {
        if (!this.currentElement) {
            this.currentElement = this.createTriangle();
        }

        const x1 = this.startPoint.x;
        const y1 = this.startPoint.y;
        const x2 = pos.x;
        const y2 = pos.y;
        
        // Create triangle points
        const topX = (x1 + x2) / 2;
        const topY = Math.min(y1, y2);
        const leftX = Math.min(x1, x2);
        const leftY = Math.max(y1, y2);
        const rightX = Math.max(x1, x2);
        const rightY = Math.max(y1, y2);

        const points = `${topX},${topY} ${leftX},${leftY} ${rightX},${rightY}`;
        this.currentElement.setAttribute('points', points);
    }

    updatePath(pos) {
        this.pathData += ` L ${pos.x} ${pos.y}`;
        this.currentElement.setAttribute('d', this.pathData);
    }

    createRectangle() {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const styles = this.getStyles();
        Object.entries(styles).forEach(([key, value]) => {
            rect.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
        });
        rect.style.cursor = 'pointer';
        this.canvas.appendChild(rect);
        return rect;
    }

    createCircle() {
        const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        const styles = this.getStyles();
        Object.entries(styles).forEach(([key, value]) => {
            ellipse.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
        });
        ellipse.style.cursor = 'pointer';
        this.canvas.appendChild(ellipse);
        return ellipse;
    }

    createLine() {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('stroke', document.getElementById('strokeColor').value);
        line.setAttribute('stroke-width', document.getElementById('strokeWidth').value);
        line.setAttribute('fill', 'none');
        line.style.cursor = 'pointer';
        this.canvas.appendChild(line);
        return line;
    }

    createTriangle() {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const styles = this.getStyles();
        Object.entries(styles).forEach(([key, value]) => {
            polygon.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
        });
        polygon.style.cursor = 'pointer';
        this.canvas.appendChild(polygon);
        return polygon;
    }

    createPath() {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke', document.getElementById('strokeColor').value);
        path.setAttribute('stroke-width', document.getElementById('strokeWidth').value);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.style.cursor = 'pointer';
        this.canvas.appendChild(path);
        return path;
    }

    selectElement(element) {
        this.clearSelection();
        if (element !== this.canvas) {
            this.selectedElement = element;
            element.style.filter = 'drop-shadow(0 0 5px #e74c3c)';
            element.style.cursor = 'move';
        }
    }

    clearSelection() {
        if (this.selectedElement) {
            this.selectedElement.style.filter = '';
            this.selectedElement.style.cursor = 'pointer';
            this.selectedElement = null;
        }
    }

    calculateDragOffset(mousePos, element) {
        const tagName = element.tagName.toLowerCase();
        
        switch (tagName) {
            case 'text':
            case 'rect':
                return {
                    x: mousePos.x - parseFloat(element.getAttribute('x') || 0),
                    y: mousePos.y - parseFloat(element.getAttribute('y') || 0)
                };
            case 'ellipse':
                return {
                    x: mousePos.x - parseFloat(element.getAttribute('cx') || 0),
                    y: mousePos.y - parseFloat(element.getAttribute('cy') || 0)
                };
            case 'line':
                const x1 = parseFloat(element.getAttribute('x1') || 0);
                const y1 = parseFloat(element.getAttribute('y1') || 0);
                return {
                    x: mousePos.x - x1,
                    y: mousePos.y - y1
                };
            case 'polygon':
                // Calculate center of polygon for dragging reference
                const points = element.getAttribute('points').split(' ');
                let centerX = 0, centerY = 0;
                points.forEach(point => {
                    const [x, y] = point.split(',').map(Number);
                    centerX += x;
                    centerY += y;
                });
                centerX /= points.length;
                centerY /= points.length;
                return {
                    x: mousePos.x - centerX,
                    y: mousePos.y - centerY
                };
            case 'path':
                // Find the first move command in the path
                const pathData = element.getAttribute('d');
                const match = pathData.match(/M\s*([\d.]+)\s*([\d.]+)/);
                if (match) {
                    return {
                        x: mousePos.x - parseFloat(match[1]),
                        y: mousePos.y - parseFloat(match[2])
                    };
                }
                return { x: 0, y: 0 };
            default:
                return { x: 0, y: 0 };
        }
    }

    moveElement(element, mousePos) {
        const tagName = element.tagName.toLowerCase();
        const newX = mousePos.x - this.dragOffset.x;
        const newY = mousePos.y - this.dragOffset.y;

        switch (tagName) {
            case 'text':
            case 'rect':
                element.setAttribute('x', newX);
                element.setAttribute('y', newY);
                break;
            case 'ellipse':
                element.setAttribute('cx', newX);
                element.setAttribute('cy', newY);
                break;
            case 'line': {
                const oldX1 = parseFloat(element.getAttribute('x1'));
                const oldY1 = parseFloat(element.getAttribute('y1'));
                const oldX2 = parseFloat(element.getAttribute('x2'));
                const oldY2 = parseFloat(element.getAttribute('y2'));
                
                const deltaX = newX - oldX1;
                const deltaY = newY - oldY1;
                
                element.setAttribute('x1', newX);
                element.setAttribute('y1', newY);
                element.setAttribute('x2', oldX2 + deltaX);
                element.setAttribute('y2', oldY2 + deltaY);
                break;
            }
            case 'polygon': {
                const points = element.getAttribute('points').split(' ');
                // Calculate current center
                let centerX = 0, centerY = 0;
                const pointCoords = points.map(point => {
                    const [x, y] = point.split(',').map(Number);
                    centerX += x;
                    centerY += y;
                    return { x, y };
                });
                centerX /= pointCoords.length;
                centerY /= pointCoords.length;
                
                // Calculate offset and move all points
                const deltaX = newX - centerX;
                const deltaY = newY - centerY;
                
                const newPoints = pointCoords.map(point => 
                    `${point.x + deltaX},${point.y + deltaY}`
                ).join(' ');
                
                element.setAttribute('points', newPoints);
                break;
            }
            case 'path': {
                // Move path by updating all coordinates
                const pathData = element.getAttribute('d');
                const commands = pathData.match(/[ML]\s*[\d.]+\s*[\d.]+/g);
                
                if (commands && commands.length > 0) {
                    const firstCommand = commands[0];
                    const match = firstCommand.match(/[ML]\s*([\d.]+)\s*([\d.]+)/);
                    if (match) {
                        const oldStartX = parseFloat(match[1]);
                        const oldStartY = parseFloat(match[2]);
                        const deltaX = newX - oldStartX;
                        const deltaY = newY - oldStartY;
                        
                        let newPathData = pathData.replace(/([ML])\s*([\d.]+)\s*([\d.]+)/g, 
                            (match, command, x, y) => {
                                const newX = parseFloat(x) + deltaX;
                                const newY = parseFloat(y) + deltaY;
                                return `${command} ${newX} ${newY}`;
                            }
                        );
                        
                        element.setAttribute('d', newPathData);
                    }
                }
                break;
            }
        }
    }

    saveToLocalStorage() {
        const svgData = new XMLSerializer().serializeToString(this.canvas);
        const timestamp = new Date().toISOString();
        const fileName = prompt('Enter a name for your drawing:', `drawing_${timestamp.split('T')[0]}`);
        
        if (fileName) {
            const storageKey = `fs/drawings/${fileName}.svg`;
            localStorage.setItem(storageKey, svgData);
            alert(`Drawing saved as ${fileName}.svg`);
            
            // Dispatch event to notify IDE if it's listening
            window.dispatchEvent(new CustomEvent('svgSaved', {
                detail: { fileName: `${fileName}.svg`, path: storageKey, svgData }
            }));
            
            // Also send postMessage for iframe communication
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'svgSaved',
                    fileName: `${fileName}.svg`,
                    path: storageKey,
                    svgData: svgData
                }, '*');
            }
        }
    }

    loadFromLocalStorage() {
        // Get all SVG files from localStorage
        const svgFiles = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('fs/drawings/') && key.endsWith('.svg')) {
                const fileName = key.replace('fs/drawings/', '');
                svgFiles.push({ key, fileName });
            }
        }

        if (svgFiles.length === 0) {
            alert('No saved drawings found.');
            return;
        }

        // Create a simple selection dialog
        const fileList = svgFiles.map((file, index) => `${index + 1}. ${file.fileName}`).join('\n');
        const selection = prompt(`Select a drawing to load:\n${fileList}\n\nEnter the number:`);
        
        if (selection) {
            const index = parseInt(selection) - 1;
            if (index >= 0 && index < svgFiles.length) {
                const svgData = localStorage.getItem(svgFiles[index].key);
                if (svgData) {
                    // Parse and load the SVG
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
                    const loadedSvg = svgDoc.documentElement;
                    
                    // Clear current canvas and copy loaded content
                    this.canvas.innerHTML = '';
                    while (loadedSvg.firstChild) {
                        if (loadedSvg.firstChild.tagName !== 'defs') { // Skip defs elements
                            this.canvas.appendChild(loadedSvg.firstChild);
                        } else {
                            loadedSvg.removeChild(loadedSvg.firstChild);
                        }
                    }
                    
                    alert(`Drawing ${svgFiles[index].fileName} loaded successfully!`);
                }
            } else {
                alert('Invalid selection.');
            }
        }
    }

    downloadSVG() {
        const svgData = new XMLSerializer().serializeToString(this.canvas);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drawing.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the SVG Editor
new SVGEditor();