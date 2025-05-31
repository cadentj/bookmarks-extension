let allBookmarks = [];
let flatBookmarks = [];

// Function to get favicon URL
function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        // Try DuckDuckGo's favicon service first (more reliable)
        return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
    } catch {
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ccc"/></svg>';
    }
}

// Function to get domain from URL
function getDomain(url) {
    try {
        const domain = new URL(url).hostname;
        // Remove 'www.' if present
        return domain.replace(/^www\./, '');
    } catch {
        return 'unknown';
    }
}

// Function to recursively get all bookmarks
function getAllBookmarks(bookmarkNodes) {
    let domainGroups = new Map(); // Map to store bookmarks by domain
    let flatList = []; // List for single bookmarks
    
    function processNode(node) {
        if (node.url) {
            // This is a bookmark
            const bookmark = {
                type: 'bookmark',
                title: node.title,
                url: node.url,
                favicon: getFaviconUrl(node.url)
            };
            
            // Add to domain groups
            const domain = getDomain(node.url);
            if (!domainGroups.has(domain)) {
                domainGroups.set(domain, []);
            }
            domainGroups.get(domain).push(bookmark);
        } else if (node.children) {
            // Process children recursively
            for (let child of node.children) {
                processNode(child);
            }
        }
    }
    
    // Process all bookmark nodes
    for (let node of bookmarkNodes) {
        processNode(node);
    }
    
    // Split bookmarks between flat list and groups
    let groupedBookmarks = [];
    for (let [domain, domainBookmarks] of domainGroups) {
        if (domainBookmarks.length >= 2) {
            // If 2 or more bookmarks, add to grouped list
            groupedBookmarks.push({
                type: 'folder',
                title: domain,
                bookmarks: domainBookmarks
            });
        } else {
            // If only 1 bookmark, add to flat list
            flatList.push(domainBookmarks[0]);
        }
    }
    
    return { flatList, groupedBookmarks };
}

// Function to render flat bookmarks list
function renderFlatBookmarks(bookmarks) {
    const container = document.getElementById('allBookmarksList');
    const loadingMessage = document.getElementById('loadingMessage');
    const noBookmarksMessage = document.getElementById('noBookmarks');
    
    if (bookmarks.length === 0) {
        container.style.display = 'none';
        loadingMessage.style.display = 'none';
        noBookmarksMessage.style.display = 'block';
        return;
    }

    container.innerHTML = '';
    
    // Sort bookmarks: priority first, then alphabetically
    bookmarks.sort((a, b) => {
        const aIsPriority = a.title.startsWith('[P]');
        const bIsPriority = b.title.startsWith('[P]');
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return a.title.localeCompare(b.title);
    });
    
    bookmarks.forEach(bookmark => {
        const bookmarkItem = document.createElement('div');
        bookmarkItem.className = 'bookmark-item';
        
        const link = document.createElement('a');
        link.href = bookmark.url;
        link.className = 'bookmark-link';
        
        const favicon = document.createElement('img');
        favicon.src = bookmark.favicon;
        favicon.className = 'bookmark-favicon';
        favicon.onerror = function() {
            // If DuckDuckGo fails, try Google's service
            if (this.src.includes('duckduckgo')) {
                try {
                    const domain = new URL(bookmark.url).hostname;
                    this.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
                } catch {
                    // If both services fail, show a generic bookmark icon
                    this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M2 2v12l6-3 6 3V2H2z" fill="%23ccc"/></svg>';
                }
            } else {
                // If Google's service fails, show a generic bookmark icon
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M2 2v12l6-3 6 3V2H2z" fill="%23ccc"/></svg>';
            }
        };
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'bookmark-title';
        if (bookmark.title.startsWith('[P]')) {
            titleSpan.classList.add('priority-bookmark');
            titleSpan.textContent = bookmark.title.substring(3);
        } else {
            titleSpan.textContent = bookmark.title;
        }
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '🗑️';
        deleteButton.title = 'Delete bookmark';
        deleteButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this bookmark?')) {
                chrome.bookmarks.search({ url: bookmark.url }, (results) => {
                    if (results.length > 0) {
                        chrome.bookmarks.remove(results[0].id, () => {
                            // Remove the bookmark from the UI
                            bookmarkItem.remove();
                            // Update the bookmarks list
                            const index = flatBookmarks.findIndex(b => b.url === bookmark.url);
                            if (index !== -1) {
                                flatBookmarks.splice(index, 1);
                            }
                            // Show no bookmarks message if list is empty
                            if (flatBookmarks.length === 0) {
                                container.style.display = 'none';
                                noBookmarksMessage.style.display = 'block';
                            }
                        });
                    }
                });
            }
        };
        
        link.appendChild(favicon);
        link.appendChild(titleSpan);
        bookmarkItem.appendChild(link);
        bookmarkItem.appendChild(deleteButton);
        container.appendChild(bookmarkItem);
    });
    
    loadingMessage.style.display = 'none';
    container.style.display = 'block';
}

// Function to render grouped bookmarks
function renderGroupedBookmarks(bookmarks) {
    const container = document.getElementById('groupedBookmarksList');
    
    if (bookmarks.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    
    // Sort bookmarks by domain name
    bookmarks.sort((a, b) => a.title.localeCompare(b.title));
    
    bookmarks.forEach(item => {
        if (item.type === 'folder') {
            // Create folder header
            const folderHeader = document.createElement('div');
            folderHeader.className = 'folder-header';
            folderHeader.textContent = item.title;
            container.appendChild(folderHeader);
            
            // Sort bookmarks within folder: priority first, then alphabetically
            item.bookmarks.sort((a, b) => {
                const aIsPriority = a.title.startsWith('[P]');
                const bIsPriority = b.title.startsWith('[P]');
                if (aIsPriority && !bIsPriority) return -1;
                if (!aIsPriority && bIsPriority) return 1;
                return a.title.localeCompare(b.title);
            });
            
            // Create bookmarks list
            item.bookmarks.forEach(bookmark => {
                if (bookmark.type === 'bookmark') {
                    const bookmarkItem = document.createElement('div');
                    bookmarkItem.className = 'bookmark-item';
                    
                    const link = document.createElement('a');
                    link.href = bookmark.url;
                    link.className = 'bookmark-link';
                    
                    const favicon = document.createElement('img');
                    favicon.src = bookmark.favicon;
                    favicon.className = 'bookmark-favicon';
                    favicon.onerror = function() {
                        // If DuckDuckGo fails, try Google's service
                        if (this.src.includes('duckduckgo')) {
                            try {
                                const domain = new URL(bookmark.url).hostname;
                                this.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
                            } catch {
                                // If both services fail, show a generic bookmark icon
                                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M2 2v12l6-3 6 3V2H2z" fill="%23ccc"/></svg>';
                            }
                        } else {
                            // If Google's service fails, show a generic bookmark icon
                            this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M2 2v12l6-3 6 3V2H2z" fill="%23ccc"/></svg>';
                        }
                    };
                    
                    const titleSpan = document.createElement('span');
                    titleSpan.className = 'bookmark-title';
                    if (bookmark.title.startsWith('[P]')) {
                        titleSpan.classList.add('priority-bookmark');
                        titleSpan.textContent = bookmark.title.substring(3);
                    } else {
                        titleSpan.textContent = bookmark.title;
                    }
                    
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'delete-button';
                    deleteButton.textContent = '🗑️';
                    deleteButton.title = 'Delete bookmark';
                    deleteButton.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this bookmark?')) {
                            chrome.bookmarks.search({ url: bookmark.url }, (results) => {
                                if (results.length > 0) {
                                    chrome.bookmarks.remove(results[0].id, () => {
                                        // Remove the bookmark from the UI
                                        bookmarkItem.remove();
                                        // Update the bookmarks list
                                        const folderIndex = allBookmarks.findIndex(f => f.title === item.title);
                                        if (folderIndex !== -1) {
                                            const bookmarkIndex = allBookmarks[folderIndex].bookmarks.findIndex(b => b.url === bookmark.url);
                                            if (bookmarkIndex !== -1) {
                                                allBookmarks[folderIndex].bookmarks.splice(bookmarkIndex, 1);
                                                // If folder is empty, remove it
                                                if (allBookmarks[folderIndex].bookmarks.length === 0) {
                                                    allBookmarks.splice(folderIndex, 1);
                                                    folderHeader.remove();
                                                }
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    };
                    
                    link.appendChild(favicon);
                    link.appendChild(titleSpan);
                    bookmarkItem.appendChild(link);
                    bookmarkItem.appendChild(deleteButton);
                    container.appendChild(bookmarkItem);
                }
            });
        }
    });
    
    container.style.display = 'block';
}

// Load bookmarks when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up edit mode toggle
    const editCheckbox = document.getElementById('editCheckbox');
    editCheckbox.addEventListener('change', () => {
        const deleteButtons = document.querySelectorAll('.delete-button');
        deleteButtons.forEach(button => {
            button.classList.toggle('visible', editCheckbox.checked);
        });
    });

    chrome.bookmarks.getTree(function(bookmarkTreeNodes) {
        const { flatList, groupedBookmarks } = getAllBookmarks(bookmarkTreeNodes);
        flatBookmarks = flatList;
        allBookmarks = groupedBookmarks;
        renderFlatBookmarks(flatBookmarks);
        renderGroupedBookmarks(allBookmarks);
    });
});