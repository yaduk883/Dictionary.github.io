// ------------------------------------------
// Configuration
// ------------------------------------------
// **** CORRECT PUBLIC CSV LINK ****
const GOOGLE_SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR1yXM-26NcSPpkrOMGFgvCRwYcFfzcaSSYGiD8mztHs_tJjUXLoFf7F-J2kwEWEw/pub?output=csv";

const TABLE_BODY_ID = 'bookTableBody';
const SEARCH_INPUT_ID = 'searchInput';
const STATUS_MESSAGE_ID = 'statusMessage';
const DESCRIPTION_AREA_ID = 'descriptionArea';
const DESCRIPTION_TITLE_ID = 'descriptionTitle';
const DEFINITION_TEXT_ID = 'definitionText';
const EXAMPLE_TEXT_ID = 'exampleText';
const THEME_TOGGLE_ID = 'themeToggle';
const BACK_BUTTON_ID = 'backButton';
const THEME_STORAGE_KEY = 'dictionaryTheme'; 

// Displayed columns and their labels
const DISPLAY_COLUMNS = [
    { key: 'fromContent', label: 'English' }, 
    { key: 'toContent', label: 'Malayalam' }, 
];

let dictionaryData = []; 
let lastFilterResults = []; 
let groupedDictionaryData = {}; // New object for grouped data

// ------------------------------------------
// Utility Functions
// ------------------------------------------

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Normalizes sheet headers (e.g., "from_content" -> "fromContent").
 */
function normalizeHeader(header) {
    if (!header) return '';
    let normalized = header
        .replace(/"/g, '')
        .replace(/[^a-zA-Z0-9_\s]/g, '')
        .trim()
        .toLowerCase();
    normalized = normalized.replace(/(_\w)|(\s\w)/g, (match) => {
        return match.toUpperCase().replace(/[_ ]/g, '');
    });
    return normalized;
}

/**
 * Groups raw dictionary data by the English word ('fromContent').
 * The result is an object where keys are English words, and values are arrays of entries.
 */
function groupDataByEnglishWord(data) {
    const grouped = {};
    data.forEach(entry => {
        const key = entry.fromContent;
        if (key) {
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(entry);
        }
    });
    return grouped;
}

/**
 * Copies the given text to the clipboard.
 */
function copyWord(word) {
    navigator.clipboard.writeText(word)
        .then(() => {
            alert(`"${word}" copied to clipboard!`);
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            alert('Failed to copy text.');
        });
}


// ------------------------------------------
// Data Fetching and Parsing Functions
// ------------------------------------------

async function fetchCSVData() {
    const status = document.getElementById(STATUS_MESSAGE_ID);
    try {
        const response = await fetch(GOOGLE_SHEET_CSV); 
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        status.textContent = `⚠️ Failed to load data. Ensure your Google Sheet is published to the web as CSV. ${error.message}`;
        status.className = 'error';
        console.error("Fetch Error:", error);
        return null;
    }
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    const rawHeaders = lines[0].split(',').map(header => header.replace(/"/g, '').trim());
    const headers = rawHeaders.map(normalizeHeader);
    
    if (!headers.includes('fromContent') || !headers.includes('toContent')) {
        console.error("Critical Parsing Error: The script expects 'fromContent' and 'toContent' keys.");
        return [];
    }

    const data = [];
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(csvRegex); 

        if (values.length === headers.length) {
            let entry = {};
            values.forEach((value, index) => {
                const cleanValue = value.replace(/^"|"$/g, '').trim(); 
                entry[headers[index]] = cleanValue; 
            });
            if (entry.fromContent) {
                entry.id = i; 
                data.push(entry);
            }
        }
    }
    return data;
}

// ------------------------------------------
// Theme Functions (UNCHANGED)
// ------------------------------------------

function toggleTheme() {
    const body = document.body;
    const button = document.getElementById(THEME_TOGGLE_ID);
    
    const isDark = body.classList.toggle('dark-theme');

    if (isDark) {
        button.innerHTML = '🌙 Switch to Light';
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
        button.innerHTML = '☀️ Switch to Dark';
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const button = document.getElementById(THEME_TOGGLE_ID);
    const body = document.body;

    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        button.innerHTML = '🌙 Switch to Light';
    } else {
        body.classList.remove('dark-theme');
        button.innerHTML = '☀️ Switch to Dark';
    }
}


// ------------------------------------------
// Table & Description Management
// ------------------------------------------

/**
 * Handles selection of a grouped English word.
 * @param {Array} groupedEntries - Array of all sheet entries for the selected word.
 * @param {HTMLElement} selectedRow - The table row element that was clicked.
 */
function handleWordSelect(groupedEntries, selectedRow) {
    const tbody = document.getElementById(TABLE_BODY_ID);
    const backButton = document.getElementById(BACK_BUTTON_ID);
    const tableContainer = document.getElementById('bookTableContainer');

    // Hide all rows except the selected one
    Array.from(tbody.children).forEach(row => {
        row.classList.remove('selected-row');
        if (row !== selectedRow) {
            row.classList.add('hidden-row');
        } else {
            row.classList.remove('hidden-row');
            row.classList.add('selected-row');
        }
    });

    tableContainer.style.display = 'none';

    const titleElement = document.getElementById(DESCRIPTION_TITLE_ID);
    const definitionElement = document.getElementById(DEFINITION_TEXT_ID);
    const exampleElement = document.getElementById(EXAMPLE_TEXT_ID); 
    const area = document.getElementById(DESCRIPTION_AREA_ID);

    const mainWord = groupedEntries[0].fromContent;
    titleElement.innerHTML = `📜 ${mainWord} <button class="copy-button" onclick="copyWord('${mainWord}')">Copy</button>`;
    
    // Aggregate all Malayalam meanings and types
    let allMeanings = [];
    let allTypes = [];
    
    groupedEntries.forEach(entry => {
        if (entry.toContent) {
            allMeanings.push(entry.toContent);
        }
        if (entry.types) {
            allTypes.push(entry.types);
        }
    });

    // Display all meanings in an unordered list
    definitionElement.innerHTML = allMeanings.length > 0
        ? `<ul><li>${allMeanings.join('</li><li>')}</li></ul>`
        : "No Malayalam translations available.";
    
    // Display all unique types/details
    const uniqueTypes = [...new Set(allTypes)].join(', ') || "N/A";

    if (uniqueTypes !== "N/A") {
        exampleElement.textContent = uniqueTypes;
        exampleElement.style.display = 'block';
    } else {
        exampleElement.style.display = 'none';
    }

    area.style.display = 'block';
    backButton.style.display = 'inline-block'; 

    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetTable() {
    const tableContainer = document.getElementById('bookTableContainer');
    const tbody = document.getElementById(TABLE_BODY_ID);
    const area = document.getElementById(DESCRIPTION_AREA_ID);
    const backButton = document.getElementById(BACK_BUTTON_ID);

    tableContainer.style.display = 'block';

    Array.from(tbody.children).forEach(row => {
        row.classList.remove('hidden-row');
        row.classList.remove('selected-row');
    });

    area.style.display = 'none';
    backButton.style.display = 'none';
    
    // Render the last search results (which are grouped keys)
    renderTable(lastFilterResults);
}

/**
 * Renders the table using grouped English words.
 * @param {Array} keysToDisplay - An array of English word strings (the keys of groupedDictionaryData).
 */
function renderTable(keysToDisplay) {
    const tableContainer = document.getElementById('bookTableContainer');
    const tbody = document.getElementById(TABLE_BODY_ID);
    const status = document.getElementById(STATUS_MESSAGE_ID);
    
    tbody.innerHTML = ''; 
    document.getElementById(DESCRIPTION_AREA_ID).style.display = 'none'; 
    document.getElementById(BACK_BUTTON_ID).style.display = 'none';

    lastFilterResults = keysToDisplay; 

    if (keysToDisplay.length === 0) {
        tableContainer.style.display = 'none';
        status.textContent = "❌ No entries found matching your search term exactly.";
        status.className = 'error';
        return;
    }
    
    tableContainer.style.display = 'block';

    keysToDisplay.forEach(englishWord => {
        const entryGroup = groupedDictionaryData[englishWord];
        if (!entryGroup) return; // Skip if the group is somehow missing

        const row = tbody.insertRow();
        row.style.cursor = 'pointer'; 
        
        // Use an anonymous function to ensure 'entryGroup' is correctly captured
        row.addEventListener('click', () => {
            handleWordSelect(entryGroup, row);
        });

        // 1. English Word (fromContent)
        const englishCell = row.insertCell();
        englishCell.textContent = englishWord;

        // 2. Malayalam Meanings (Combined)
        const malayalamCell = row.insertCell();
        // Create a summary of the Malayalam meanings for the table view
        const meanings = entryGroup.map(e => e.toContent).filter(m => m).join(' / ');
        malayalamCell.textContent = meanings;
    });

    const currentQuery = document.getElementById(SEARCH_INPUT_ID).value.toLowerCase().trim();
    if (currentQuery) {
        status.textContent = `🔎 ${keysToDisplay.length} exact match(es) found. Click a row for all meanings.`;
        status.className = 'info';
    }
}

/**
 * Filters dictionaryData based on the search query using EXACT MATCHING.
 */
function filterData(query) {
    const queryLower = query.toLowerCase().trim();
    const status = document.getElementById(STATUS_MESSAGE_ID);
    const tableContainer = document.getElementById('bookTableContainer');

    document.getElementById(DESCRIPTION_AREA_ID).style.display = 'none';
    document.getElementById(BACK_BUTTON_ID).style.display = 'none';

    if (!queryLower) {
        document.getElementById(TABLE_BODY_ID).innerHTML = '';
        tableContainer.style.display = 'none';
        status.textContent = "Start typing above to search for a word.";
        status.className = 'info';
        lastFilterResults = [];
        return;
    }

    // Find the English word keys that match the search query exactly
    const filteredKeys = Object.keys(groupedDictionaryData).filter(englishWord => {
        // Strict, case-insensitive, exact match on English word
        if (englishWord.toLowerCase() === queryLower) {
            return true;
        }

        // If not matched in English, check if the query matches any Malayalam meaning exactly
        const entries = groupedDictionaryData[englishWord];
        const malayalamMatch = entries.some(entry => {
            return entry.toContent && entry.toContent.toLowerCase() === queryLower;
        });

        return malayalamMatch;
    });

    renderTable(filteredKeys);
}


// ------------------------------------------
// Initialization (Main Execution)
// ------------------------------------------

function registerEventListeners() {
    document.getElementById(THEME_TOGGLE_ID).addEventListener('click', toggleTheme);
    document.getElementById(BACK_BUTTON_ID).addEventListener('click', resetTable);
    
    // Make copyWord function globally available for use in the HTML string inside handleWordSelect
    window.copyWord = copyWord; 
    
    const searchInput = document.getElementById(SEARCH_INPUT_ID);
    searchInput.addEventListener('input', debounce((e) => {
        filterData(e.target.value);
    }, 300));
}

async function init() {
    loadTheme();
    registerEventListeners();
    
    const status = document.getElementById(STATUS_MESSAGE_ID);
    const tableContainer = document.getElementById('bookTableContainer');
    
    status.textContent = 'Loading dictionary data...';

    const csvText = await fetchCSVData();
    if (!csvText) {
        status.textContent = `❌ Data load failed. Check the browser console (F12) for network errors.`;
        status.className = 'error';
        return;
    }

    dictionaryData = parseCSV(csvText); 
    
    if (dictionaryData.length > 0) {
        // ** NEW STEP: Group data immediately after parsing **
        groupedDictionaryData = groupDataByEnglishWord(dictionaryData);
        
        document.getElementById(TABLE_BODY_ID).innerHTML = ''; 
        tableContainer.style.display = 'none';

        status.textContent = `Successfully loaded ${Object.keys(groupedDictionaryData).length} unique English words. Start typing above to search.`;
        status.className = 'info';
    } else {
        status.textContent = `⚠️ Failed to parse dictionary entries. Verify your sheet has 'from_content' and 'to_content' headers.`;
        status.className = 'error';
    }
}

document.addEventListener('DOMContentLoaded', init);
