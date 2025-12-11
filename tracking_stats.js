document.addEventListener("DOMContentLoaded", function() {
    const urlTableBody = document.getElementById("urlTableBody");
    
    function formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    function getUrlClassification(url) {
        // This is a placeholder classification logic
        // Replace with your actual classification model later
        const productiveUrls = ['github.com', 'stackoverflow.com', 'docs.microsoft.com', 'developer.mozilla.org'];
        const unproductiveUrls = ['facebook.com', 'twitter.com', 'instagram.com', 'reddit.com'];
        
        const domain = new URL(url).hostname.replace('www.', '');
        
        if (productiveUrls.some(u => domain.includes(u))) return 'productive';
        if (unproductiveUrls.some(u => domain.includes(u))) return 'unproductive';
        return 'neutral';
    }

    function updateTable(trackingData) {
        urlTableBody.innerHTML = ''; // Clear existing content
        
        const entries = Object.entries(trackingData.timeDictionary || {});
        
        // Sort by time spent (descending)
        entries.sort((a, b) => b[1] - a[1]);
        
        entries.forEach(([url, timeSpent]) => {
            const row = document.createElement('tr');
            
            // URL cell
            const urlCell = document.createElement('td');
            urlCell.textContent = url;
            
            // Time spent cell
            const timeCell = document.createElement('td');
            timeCell.textContent = formatTime(timeSpent);
            
            // Classification cell
            const classCell = document.createElement('td');
            const classification = getUrlClassification(url);
            classCell.textContent = classification;
            classCell.classList.add(classification);
            
            row.appendChild(urlCell);
            row.appendChild(timeCell);
            row.appendChild(classCell);
            urlTableBody.appendChild(row);
        });
    }

    // Initial data load
    chrome.storage.local.get(['trackingState'], function(result) {
        if (result.trackingState) {
            updateTable(result.trackingState);
        }
    });

    // Listen for updates
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if(changes.trackingState.newValue){
            document.getElementById("url_display").textContent="value exists";
        }
        else{
            document.getElementById("url_display").textContent="no new value exists";
        }
        if (namespace === 'local' && changes.trackingState) {
            updateTable(changes.trackingState.newValue);
        }
    });
});