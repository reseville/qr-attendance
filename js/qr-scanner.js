document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const preview = document.getElementById('preview');
    const cameraSelect = document.getElementById('camera-select');
    const startScanBtn = document.getElementById('start-scan');
    const stopScanBtn = document.getElementById('stop-scan');
    const manualIdInput = document.getElementById('manual-id');
    const manualSubmitBtn = document.getElementById('manual-submit');
    const feedbackDiv = document.getElementById('feedback');
    const scannedList = document.getElementById('scanned-list');
    const countSpan = document.getElementById('count');
    const clearResultsBtn = document.getElementById('clear-results');
    const downloadCsvBtn = document.getElementById('download-csv');

    // Variables
    let scanner = null;
    let cameras = [];
    let scannedIds = loadFromLocalStorage('scannedIds') || [];

    // Initialize
    initCameras();
    updateScannedList();

    // Event listeners
    startScanBtn.addEventListener('click', startScanning);
    stopScanBtn.addEventListener('click', stopScanning);
    manualSubmitBtn.addEventListener('click', processManualId);
    clearResultsBtn.addEventListener('click', clearResults);
    downloadCsvBtn.addEventListener('click', downloadCsv);
    
    // Initialize camera list
    async function initCameras() {
        try {
            // Request camera permission early
            await navigator.mediaDevices.getUserMedia({ video: true });
            
            Instascan.Camera.getCameras()
                .then(availableCameras => {
                    cameras = availableCameras;
                    
                    if (cameras.length === 0) {
                        showFeedback('No cameras found on this device.', 'error');
                        return;
                    }
                    
                    // Populate camera selection dropdown
                    cameras.forEach((camera, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.text = camera.name || `Camera ${index + 1}`;
                        cameraSelect.appendChild(option);
                    });
                    
                    // Select back camera by default if available
                    const backCameraIndex = cameras.findIndex(camera => 
                        camera.name && camera.name.toLowerCase().includes('back'));
                    
                    if (backCameraIndex >= 0) {
                        cameraSelect.value = backCameraIndex;
                    } else {
                        cameraSelect.value = 0; // Default to first camera
                    }
                    
                    // Enable start button
                    startScanBtn.disabled = false;
                })
                .catch(err => {
                    console.error('Error accessing cameras:', err);
                    showFeedback('Failed to access cameras. Please ensure you have granted camera permissions.', 'error');
                });
        } catch (err) {
            console.error('Error requesting camera permission:', err);
            showFeedback('Camera access denied. Please enable camera permissions in your browser settings.', 'error');
        }
    }
    
    function startScanning() {
        if (scanner) {
            stopScanning();
        }
        
        const cameraIndex = parseInt(cameraSelect.value);
        if (isNaN(cameraIndex) || cameraIndex < 0 || cameraIndex >= cameras.length) {
            showFeedback('Please select a camera.', 'error');
            return;
        }
        
        try {
            scanner = new Instascan.Scanner({ 
                video: preview, 
                mirror: false, 
                backgroundScan: false 
            });
            
            scanner.addListener('scan', processScannedId);
            
            scanner.start(cameras[cameraIndex])
                .then(() => {
                    startScanBtn.disabled = true;
                    stopScanBtn.disabled = false;
                    showFeedback('Scanner started. Point camera at a QR code.', 'success');
                })
                .catch(err => {
                    console.error('Error starting scanner:', err);
                    showFeedback('Failed to start scanner. Try another camera or check permissions.', 'error');
                    scanner = null;
                });
        } catch (err) {
            console.error('Scanner initialization error:', err);
            showFeedback('Failed to initialize scanner.', 'error');
            scanner = null;
        }
    }
    
    function stopScanning() {
        if (scanner) {
            scanner.stop();
            scanner = null;
            startScanBtn.disabled = false;
            stopScanBtn.disabled = true;
            showFeedback('Scanner stopped.', 'success');
        }
    }
    
    function processScannedId(qrData) {
        try {
            const data = JSON.parse(qrData);
            processAttendanceData(data);
        } catch (err) {
            // If not JSON, try to use as plain text ID
            console.warn('QR data is not JSON, treating as plain ID');
            processAttendanceData({ id: qrData });
        }
    }
    
    function processManualId() {
        const idValue = manualIdInput.value.trim();
        if (!idValue) {
            showFeedback('Please enter an ID.', 'error');
            return;
        }
        
        processAttendanceData({ id: idValue });
        manualIdInput.value = '';
    }
    
    function processAttendanceData(data) {
        if (!data || !data.id) {
            showFeedback('Invalid QR code format. Missing ID.', 'error');
            return;
        }
        
        const id = data.id;
        const timestamp = getPHTTimestamp();
        const isDuplicate = scannedIds.some(item => item.id === id);
        
        // Add to scanned list even if duplicate
        const attendanceRecord = {
            id: id,
            name: data.name || 'Unknown',
            timestamp: timestamp,
            duplicate: isDuplicate
        };
        
        scannedIds.unshift(attendanceRecord); // Add to beginning for newest first
        saveToLocalStorage('scannedIds', scannedIds);
        
        // Update UI
        updateScannedList();
        
        if (isDuplicate) {
            showFeedback(`Duplicate scan detected: ${id}`, 'error');
        } else {
            showFeedback(`Successfully scanned: ${id}`, 'success');
            // Submit to server if not a duplicate
            submitAttendanceToServer(attendanceRecord);
        }
    }
    
    function updateScannedList() {
        scannedList.innerHTML = '';
        countSpan.textContent = `(${scannedIds.length})`;
        
        if (scannedIds.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No scanned IDs yet';
            scannedList.appendChild(emptyItem);
            return;
        }
        
        scannedIds.forEach(record => {
            const item = document.createElement('li');
            if (record.duplicate) {
                item.classList.add('duplicate');
            }
            
            const idSpan = document.createElement('span');
            idSpan.textContent = record.name ? `${record.id} (${record.name})` : record.id;
            
            const timeSpan = document.createElement('span');
            timeSpan.textContent = formatTime(record.timestamp);
            
            item.appendChild(idSpan);
            item.appendChild(timeSpan);
            scannedList.appendChild(item);
        });
    }
    
    function clearResults() {
        if (confirm('Are you sure you want to clear all scanned IDs?')) {
            scannedIds = [];
            saveToLocalStorage('scannedIds', scannedIds);
            updateScannedList();
            showFeedback('All scanned IDs have been cleared.', 'success');
        }
    }
    
    function downloadCsv() {
        if (scannedIds.length === 0) {
            showFeedback('No data to download.', 'error');
            return;
        }
        
        const headers = ['ID', 'Name', 'Timestamp', 'Duplicate'];
        const csvContent = [
            headers.join(','),
            ...scannedIds.map(record => [
                record.id,
                record.name || 'Unknown',
                record.timestamp,
                record.duplicate ? 'Yes' : 'No'
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_${formatDateForFilename()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showFeedback('CSV downloaded successfully.', 'success');
    }
    
    function submitAttendanceToServer(record) {
        // Replace with your actual server URL
        const serverUrl = 'https://script.google.com/macros/s/AKfycbyf6Q1HR7hQ-wQDxrbECN3KDBjhiglYA1u7rSb_xYBBWUTuak8PpHFE_xElwu29q97w1A/exe';
        
        fetch(serverUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(record)
        }).catch(err => {
            console.error('Error submitting attendance:', err);
            // Continue even if server submission fails
            // Data is already saved locally
        });
    }
    
    // Helper functions
    function showFeedback(message, type) {
        feedbackDiv.textContent = message;
        feedbackDiv.className = 'feedback';
        if (type) {
            feedbackDiv.classList.add(type);
        }
        
        // Clear feedback after 3 seconds
        setTimeout(() => {
            feedbackDiv.textContent = '';
            feedbackDiv.className = 'feedback';
        }, 3000);
    }
    
    function getPHTTimestamp() {
        const now = new Date();
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            dateStyle: 'medium',
            timeStyle: 'medium'
        }).format(now);
    }
    
    function formatTime(timestamp) {
        return timestamp;
    }
    
    function formatDateForFilename() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    }
    
    function saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (err) {
            console.error('Error saving to localStorage:', err);
        }
    }
    
    function loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Error loading from localStorage:', err);
            return null;
        }
    }
});