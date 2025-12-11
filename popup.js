document.addEventListener('DOMContentLoaded', function() {
    const urlTableBody = document.getElementById('urlTableBody');

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

   function getDomain(url) {
    try {
        // 1. Attempt to create a standard URL object.
        const urlObject = new URL(url);

        // 2. Return the hostname (e.g., 'www.google.com').
        //    Then, strip the 'www.'
        // prefix if it exists.
        let hostname = urlObject.hostname;
        console.log("inside get domain function",hostname);
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        return hostname;
    } catch (e) {
        // 3. Handle non-standard URLs like 'chrome:' or 'file:'
        if (url.startsWith('chrome:')) {
            // Return 'chrome:' as the domain for grouping (matches your table data)
            return 'chrome:';
        }
        if (url.startsWith('file:')) {
            // Return 'file:' as the domain for grouping (matches your table data)
            return 'file:';
        }

        // 4. Fallback for any other errors (e.g., completely invalid strings)
        return 'unknown';
    }
}

    async function getClassification(url) {
       const data = await fetch("http://127.0.0.1:5000/api/recieve/productivity-scores").then(response=>response.json()).then(data =>{
        return data[url]
       });
       //console.log(typeof (data));
       return data;
       //console.log(data);
        // let h = 0;
        // for (let i = 0; i < url.length; i++) {
        //     h = ((h << 5) - h) + url.charCodeAt(i);
        //     h |= 0;
        // }
        // const idx = Math.abs(h) % 3;
        // return ['productive', 'unproductive', 'neutral'][idx];
    }

    async function renderStackedChart(entries) {
        // Lightweight canvas-based stacked bar chart (no Chart.js dependency)
        const canvas = document.getElementById('stackedChart');
        if (!canvas) {
            console.error('Could not find chart canvas');
            return;
        }

        const ctx = canvas.getContext('2d');
        // Prepare data structures similar to previous implementation
        const domainTotals = {};
        // domain -> {productive, unproductive, neutral}
        const representativeUrl = {};
        // domain -> {url, timeSpent}

        for (const [url, timeSpent] of entries) {
            //const domain = getDomain(url);
            const cls = await getClassification(url);
            if (!representativeUrl[url] || timeSpent > representativeUrl[url].timeSpent) {
                
                representativeUrl[url] = {url, timeSpent};
            }
            if (!domainTotals[url]) domainTotals[url] = {productive: 0, neutral: 0, unproductive: 0};
            //console.log("cls",cls);
            if (cls === 'productive') domainTotals[url]["productive"] += timeSpent;
            else if (cls === 'unproductive') domainTotals[url]["unproductive"] += timeSpent;
            else if (cls === 'neutral') domainTotals[url]["neutral"] += timeSpent;
            //console.log("inside for each loop",url)
        }
        console.log(domainTotals);
        const domains = Object.keys(domainTotals);
        console.log(domains.length)
        if (domains.length === 0) {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        // Colors per domain
        function colorForIndex(i) {
            const palette = ['#3366CC','#DC3912','#FF9900','#109618','#990099','#3B3EAC','#0099C6','#DD4477','#66AA00','#B82E2E'];
            return palette[i % palette.length];
        }

        const categories = ['productive','unproductive'];
        // compute totals per category (sum across domains) to scale
        const categoryTotals = categories.map(cat => domains.reduce((s,d) => s + (domainTotals[d][cat] || 0), 0));
        const maxTotal = Math.max(...categoryTotals, 1);

        // Resize canvas to desired display size (CSS width/height handled in HTML)
        const DPR = window.devicePixelRatio ||
        1;
        const width = canvas.clientWidth || 380;
        const height = canvas.clientHeight || 220;
        canvas.width = Math.floor(width * DPR);
        canvas.height = Math.floor(height * DPR);
        ctx.scale(DPR, DPR);
        ctx.clearRect(0, 0, width, height);
        // Layout
        const padding = {top: 20, right: 12, bottom: 40, left: 12};
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const barWidth = Math.min(80, chartWidth / (categories.length * 2));
        const gap = (chartWidth - (barWidth * categories.length)) / (categories.length + 1);
        // We'll store segment metadata for click handling
        const segments = [];
        // Draw each category as a stacked vertical bar
        categories.forEach((cat, ci) => {
            const x = padding.left + gap + ci * (barWidth + gap);
            let y = padding.top + chartHeight; // start at bottom
            // For consistent stacking order, iterate domains in same order
            domains.forEach((d, di) => {
 
                try {
                    const value = domainTotals[d][cat] || 0;
                    const h = (value / maxTotal) * chartHeight;
                    if (h <= 0) return;
        
                    y -= h;
                    ctx.fillStyle = colorForIndex(di);
                    ctx.fillRect(x, y, barWidth, h);
                    // Safely build segment object and push
               
                    const seg = { x, y, w: barWidth, h, domain: d, url: (representativeUrl[d] && representativeUrl[d].url) || null, category: cat, value };
                    segments.push(seg);
                } catch (e) {
                    console.error('Error drawing segment for domain', d, { domainTotals, cat, maxTotal, chartHeight, x, y, barWidth }, e);
                }
            });
            // draw label under bar
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(cat.charAt(0).toUpperCase() + cat.slice(1), x + barWidth/2, padding.top + chartHeight + 18);
            // draw total above 
            const total = categoryTotals[ci] ||
            0;
            ctx.fillText(formatTime(total), x + barWidth/2, padding.top - 4);
        });

        // Add click handler to open representative URL of clicked segment
        // Remove previous listener if exists
        if (canvas._clickHandler) canvas.removeEventListener('click', canvas._clickHandler);
        canvas._clickHandler = function(evt) {
            const rect = canvas.getBoundingClientRect();
            const cx = (evt.clientX - rect.left);
            const cy = (evt.clientY - rect.top);
            // Find segment containing point (note canvas scaled via DPR but we used client coords)
            for (let seg of segments) {
                if (cx >= seg.x && cx <= seg.x + seg.w && cy >= seg.y && cy <= seg.y + seg.h) {
                    if (seg.url) {
           
                        try { chrome.tabs.create({ url: seg.url });
                        }
                        catch (e) { window.open(seg.url, '_blank');
                        }
                    }
                    return;
                }
            }
        };
        canvas.addEventListener('click', canvas._clickHandler);
    }

    async function updateTable(trackingData) {
        try {
            //console.log('updateTable called', { trackingData });
            if (!urlTableBody) {
                console.error('Could not find urlTableBody element');
                return;
            }

            urlTableBody.innerHTML = '';
            if (!trackingData || !trackingData.timeDictionary) {
                console.log('No tracking data available');
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 3;
                cell.textContent = 'No data available yet';
                cell.style.textAlign = 'center';
                row.appendChild(cell);
                urlTableBody.appendChild(row);
                return;
            }


            const entries = Object.entries(trackingData.timeDictionary)
    .sort((a, b) => b[1] - a[1]);

            if (entries.length === 0) {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 3;
                cell.textContent = 'No active tabs being tracked';
                cell.style.textAlign = 'center';
                row.appendChild(cell);
                urlTableBody.appendChild(row);
                return;
            }

            // Render chart first (defensive: don't let chart errors break table)
            try {
                renderStackedChart(entries);
            } catch (err) {
                console.error('Error rendering stacked chart:', err);
            }

            // Then populate table
            entries.forEach(async ([url, timeSpent]) =>{
                const row = document.createElement('tr');
                
                const urlCell = document.createElement('td');
                
                const domain = getDomain(url);
                // Create clickable link that opens the URL in a new tab
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = url; // show full URL so user can see which tab is open
   
                link.title = url;
                link.style.color = '#0366d6';
                link.style.textDecoration = 'none';
                link.addEventListener('click', (e) => {
                    e.preventDefault();
          
                    try {
                        chrome.tabs.create({ url });
                    } catch (err) {
                        // Fallback: open in same window if chrome API unavailable
       
                        window.open(url, '_blank');
                    }
                });
                urlCell.appendChild(link);
                const timeCell = document.createElement('td');
                timeCell.textContent = formatTime(timeSpent);
                
                const classCell = document.createElement('td');
                const classification = await getClassification(url);
                //console.log(classification);
                classCell.textContent = classification;
                classCell.classList.add(classification);
                
                row.appendChild(urlCell);
                row.appendChild(timeCell);
                row.appendChild(classCell);
                urlTableBody.appendChild(row);
            });
        } catch (err) {
            console.error('updateTable error:', err);
            const display = document.getElementById('url_display');
            if (display) display.textContent = 'Error rendering popup: ' + (err && err.message ? err.message : String(err));
        }
    }

    // Load initial data
    chrome.storage.local.get(['trackingState'], async function(result) {
        if (chrome.runtime.lastError) {
            console.error('Error accessing storage:', chrome.runtime.lastError);
            return;
        }
        await updateTable(result.trackingState);
    });

    // FIX: Changed from chrome.tabs.onUpdated to the correct chrome.storage.onChanged listener.
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local' && changes.trackingState) {
            updateTable(changes.trackingState.newValue).catch(console.error);
        }
    });

    // Update every 5 seconds
    setInterval(() => {
        chrome.storage.local.get(['trackingState'], function(result) {
            if (result.trackingState) {
                updateTable(result.trackingState).catch(console.error);
            }
        });
    }, 5000);
});