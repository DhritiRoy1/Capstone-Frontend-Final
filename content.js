// content.js

// --- Messaging Logic (Keep This) ---
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.action === "getTitle") {
            // This is the fallback/initial read
            sendResponse({ title: document.title }); 
            return true; 
        }
    }
);


// --- NEW: Title Watcher Logic ---

function startTitleObserver() {
    // 1. Target the <title> element
    const titleElement = document.querySelector('title');
    if (!titleElement) return;

    // Stores the last sent title to avoid duplicates
    let lastSentTitle = document.title; 

    // 2. Define the observer callback
    const observer = new MutationObserver((mutationsList, observer) => {
        const newTitle = document.title;
        
        // Only proceed if the title has actually changed significantly
        if (newTitle && newTitle !== lastSentTitle && newTitle.length > 10) {
            
            lastSentTitle = newTitle;
            console.log("MUTATION OBSERVER: Detected New Title:", newTitle);

            // 3. Send the new title directly to the background script
            chrome.runtime.sendMessage({ 
                action: "titleUpdated", 
                newTitle: newTitle 
            });
        }
    });

    // 4. Configure and start the observer
    // We observe the <title> element for changes to its children (the text content)
    observer.observe(titleElement, { childList: true, subtree: true, characterData: true });
}

// 5. Start the observer once the content script loads
startTitleObserver();