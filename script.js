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

/**
 * Parses the CSV text into an array of dictionary objects, using normalized keys.
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    const rawHeaders = lines[0].split(',').map(header => header.replace(/"/g, '').trim());
    const headers = rawHeaders.map(normalizeHeader);
    
    // Check for required headers
    if (!headers.includes('fromContent') || !headers.includes('toContent')) {
        console.error("Critical Parsing Error: The script expects 'fromContent' and 'toContent' keys.");
        return [];
    }

    const data = [];
    // Regex to handle CSV values that contain commas inside quotes
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/; 

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(csvRegex); 

        if (values.length === headers.length) {
            let entry = {};
            values.forEach((value, index) => {
                const cleanValue = value.replace(/^"|"$/g, '').trim(); 
                entry[headers[index]] = cleanValue; 
            });
            if (entry.fromContent) { // Validate entry based on the English column
                entry.id = i; 
                data.push(entry);
            }
        }
    }
    return data;
}

// ------------------------------------------
// Theme Functions 
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

function handleWordSelect(entry, selectedRow) {
    const tbody = document.getElementById(TABLE_BODY_ID);
    const backButton = document.getElementById(BACK_BUTTON_ID);
    const tableContainer = document.getElementById('bookTableContainer');

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

    // Use 'fromContent' (English) for the main title
    titleElement.textContent = `📜 ${entry.fromContent}`;
    
    // Use 'toContent' (Malayalam) as the main definition body
    let definition = entry.toContent || "No Malayalam translation available."; 
    definitionElement.textContent = definition;
    
    // Use 'types' as the secondary detail (Example)
    let example = entry.types || ""; 
    if (example) {
        exampleElement.textContent = example;
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
    
    renderTable(lastFilterResults);
}

function renderTable(dataToDisplay) {
    const tableContainer = document.getElementById('bookTableContainer');
    const tbody = document.getElementById(TABLE_BODY_ID);
    const status = document.getElementById(STATUS_MESSAGE_ID);
    
    tbody.innerHTML = ''; 
    document.getElementById(DESCRIPTION_AREA_ID).style.display = 'none'; 
    document.getElementById(BACK_BUTTON_ID).style.display = 'none';

    lastFilterResults = dataToDisplay; 

    if (dataToDisplay.length === 0) {
        tableContainer.style.display = 'none';
        // Updated status message for exact match logic
        status.textContent = "❌ No entries found matching your search term exactly.";
        status.className = 'error';
        return;
    }
    
    tableContainer.style.display = 'block';

    dataToDisplay.forEach(entry => {
        const row = tbody.insertRow();
        row.style.cursor = 'pointer'; 
        
        row.addEventListener('click', () => {
            handleWordSelect(entry, row);
        });

        DISPLAY_COLUMNS.forEach(col => {
            const cell = row.insertCell();
            let value = entry[col.key] || '';
            cell.textContent = value;
        });
    });

    const currentQuery = document.getElementById(SEARCH_INPUT_ID).value.toLowerCase().trim();
    if (currentQuery) {
        status.textContent = `🔎 ${dataToDisplay.length} exact match(es) found. Click a row to view the translation details.`;
        status.className = 'info';
    }
}

/**
 * Filters dictionaryData based on the search query.
 * USES STRICT EQUALITY (===) for exact matching.
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

    const filtered = dictionaryData.filter(entry => {
        // Strict, case-insensitive, exact match on English content
        const fromMatch = entry.fromContent && entry.fromContent.toLowerCase() === queryLower;
        // Strict, case-insensitive, exact match on Malayalam content
        const toMatch = entry.toContent && entry.toContent.toLowerCase() === queryLower;
        
        return fromMatch || toMatch;
    });

    renderTable(filtered);
}


// ------------------------------------------
// Initialization (Main Execution)
// ------------------------------------------

function registerEventListeners() {
    document.getElementById(THEME_TOGGLE_ID).addEventListener('click', toggleTheme);
    document.getElementById(BACK_BUTTON_ID).addEventListener('click', resetTable);
    
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
        document.getElementById(TABLE_BODY_ID).innerHTML = ''; 
        tableContainer.style.display = 'none';

        status.textContent = `Successfully loaded ${dictionaryData.length} entries. Start typing above to search.`;
        status.className = 'info';
    } else {
        status.textContent = `⚠️ Failed to parse dictionary entries. Verify your sheet has 'from_content' and 'to_content' headers.`;
        status.className = 'error';
    }
}

document.addEventListener('DOMContentLoaded', init);
