/*
chrome.webRequest.onBeforeRequest.addListener(
    function(details){
        // 1. chrome.runtime.sendMessage is now given an anonymous callback function.        chrome.runtime.sendMessage({
            type: "URL_UPDATE",
            url: details.url
        }, () => {
             // 2. The error check MUST go inside this callback.
             if (chrome.runtime.lastError) {
                 // This block handles the "Receiving end does not exist" error silently.
                 // This is the expected behavior when the popup is closed.
                 console.log("No open listener for URL_UPDATE:", chrome.runtime.lastError.message);
                 return;
             }
             // Optional: Handle the response from the popup here if you need one
        });
        
        // 3. The check here is removed, as it executes too early.
    },
    {urls: ["<all_urls>"]},
    []
);
*/
// Global declaration (must be 'let' to be reassigned)
let trackingState = {};

// Re-enable URL update notifications
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        chrome.runtime.sendMessage({
            type: "URL_UPDATE",
            url: details.url
        }, () => {
            if (chrome.runtime.lastError) {
                // This is expected when popup is closed
                return;
            }
        });
    },
    {urls: ["<all_urls>"]},
    []
);
(async () => {
    // 1. Await the storage retrieval and declare the 'stored' variable (Fix A)
    const stored = await chrome.storage.local.get(['trackingState']); 

    // 2. Initialize the global trackingState object (Fix B)
    trackingState = stored.trackingState || {
        timeDictionary: {},
        lastActiveUrl: null,
        lastActiveTime: Date.now(),
        pageTitles: {}
    };
    
    // 3. Save the initial state back to storage if it was just created (Fix C)
    // This is necessary to ensure the initial current time is persistent.
    await chrome.storage.local.set({ 
        "trackingState": trackingState 
    });

    // 4. Log the result
})();
function getDomain(url) {
    try {
        return url.replace(/^(?:https?:\/\/)?(?:www\.)?([^\/]+).*$/, '$1');
    } catch (e) {
        return url;
    }
}

async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
        // Add the time spent on the PREVIOUS tab to its total.
        // time_spent is the duration the tab was active before the switch.
    const stored = await chrome.storage.local.get('trackingState');
    const trackingState = stored.trackingState; // Get the object
    const data = trackingState.lastActiveTime;
    const dictionary = trackingState.timeDictionary;
    const old_url = trackingState.lastActiveUrl;
    const time_spent = Date.now() - data;
    let page_title = null
    if (old_url && trackingState?.pageTitles?.[old_url]) {
        page_title = trackingState.pageTitles[old_url];
    }
    if (tab && tab.url && old_url!= null) {
        const domain = getDomain(old_url);
        if (page_title){
            if(dictionary[domain + page_title] === undefined){
                dictionary[domain + page_title] = 0
            }
            dictionary[domain + page_title] += time_spent;
        }
        else{
            if(dictionary[domain] === undefined){
                dictionary[domain] = 0
            }
            dictionary[domain] += time_spent;
        }
        
    }
    
    trackingState.lastActiveTime = Date.now();
    trackingState.lastActiveUrl = tab?.url;
    chrome.storage.local.set({ 
        "trackingState": trackingState 
    });
    console.log(dictionary);
    await fetch("http://127.0.0.1:5000/api/recieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trackingState.timeDictionary)
    });
}

async function send_pageTitle_tobackend(){
    const stored = await chrome.storage.local.get('trackingState');
    const trackingState = stored.trackingState;
    fetch("http://127.0.0.1:5000/page-title", {
        method: "POST", 
        headers: {
            "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
            title: trackingState.pageTitles 
        })
    });
    console.log(trackingState.pageTitles);
}
        
            
            // Reset the timer and the instance tracking (or simplify as in the full solution

        
       

chrome.tabs.onActivated.addListener(async (activeInfo)=>{
    await send_pageTitle_tobackend();
    await getCurrentTab();
})
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    
    // We only care about active, valid tabs.
    if (!tab.active || !tab.url || !tab.url.startsWith('http')) {
        return; 
    }

    // Check 1: Full page load is complete (e.g., hard refresh, or new tab)
    const isFullLoad = changeInfo.status === 'complete';
    
    // Check 2: URL has changed (e.g., clicking a new YouTube video link)
    const isUrlChange = !!changeInfo.url;
    
    // Only proceed if a full load is done OR the URL has changed (YouTube video navigation)
    if (isFullLoad || isUrlChange) {
        
        // This is a crucial check specific to YouTube video changes:
        if (tab.url.includes('youtube.com/watch')) {
            // Give YouTube's dynamic script a moment to update the title
            // This small delay (200ms) often solves the race condition you mentioned earlier.
            await new Promise(resolve => setTimeout(resolve, 200)); 
        }

        // --- Message Sending Logic ---
        chrome.tabs.sendMessage(tabId, { action: "getTitle" }, async (response) => {

            if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                return;
            }
        
            let pageTitle = "None";
            if (response && response.title) {
                pageTitle = response.title;
                console.log(`Tracked Title for Tab ${tabId}: ${pageTitle}`);
            }
        
            // 1. Get the current storage
            const stored = await chrome.storage.local.get('trackingState');
            
            // 2. Handle 'undefined' scenarios safely
            // If trackingState doesn't exist yet, create an empty object
            const trackingState = stored.trackingState || {}; 
            
            // If pageTitle array doesn't exist inside it yet, create an empty array
            if (!trackingState.pageTitles) {
                trackingState.pageTitles = {};
                trackingState.pageTitles[tab.url] = "None"
                console.log("tracking state dict is",trackingState.pageTitles)
            }
            else{
                trackingState.pageTitles[tab.url] = pageTitle;
                console.log("Updated Array:", trackingState.pageTitles);
            }
            // 3. Push the new title (Fixed typo: pageTitile -> pageTitle)
            
        
            // 4. IMPORTANT: You must save the updated object back to storage!
            await chrome.storage.local.set({ trackingState: trackingState });
        });
        await getCurrentTab();
        await send_pageTitle_tobackend();
    }
});

