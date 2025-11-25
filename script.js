// ------------------------------------------
// Configuration
// ------------------------------------------
// **** NEW GOOGLE SHEET URL ****
// NOTE: Sheet ID is extracted from your shared link, but you MUST ensure the sheet 
// is publicly shared and the URL format is correct for CSV export.
const SHEET_ID = "1vujnZVEBTGzsRctZ5rhevnsqdEPMlfdS";
const GOOGLE_SHEET_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

const TABLE_BODY_ID = 'bookTableBody';
const SEARCH_INPUT_ID = 'searchInput';
const STATUS_MESSAGE_ID = 'statusMessage';
const DESCRIPTION_AREA_ID = 'descriptionArea';
const DESCRIPTION_TITLE_ID = 'descriptionTitle';
const DEFINITION_TEXT_ID = 'definitionText'; // Renamed element
const EXAMPLE_TEXT_ID = 'exampleText';      // New element
const THEME_TOGGLE_ID = 'themeToggle';
const BACK_BUTTON_ID = 'backButton';
const THEME_STORAGE_KEY = 'dictionaryTheme'; 

// Define standardized display columns (uses normalized keys)
// These keys must match the normalized headers in your sheet (word, synonyms, language)
const DISPLAY_COLUMNS = [
    { key: 'word', label: 'Word' },
    { key: 'synonyms', label: 'Synonyms (Preview)' },
    { key: 'language', label: 'Language' },
];

let dictionaryData = []; // Renamed from bookData
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
 * Normalizes a header string into camelCase for reliable object keys.
 */
function normalizeHeader(header) {
    if (!header) return '';
    return header
        .replace(/[.\/]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s(.)/g, (match, char) => char.toUpperCase());
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
        status.textContent = `⚠️ Failed to load data. Check your Google Sheet URL or network: ${error.message}`;
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
            // Ensure we only include entries that have a 'word'
            if (entry.word) {
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

    // 1. Hide all rows except the selected one
    Array.from(tbody.children).forEach(row => {
        row.classList.remove('selected-row');
        if (row !== selectedRow) {
            row.classList.add('hidden-row');
        } else {
            row.classList.remove('hidden-row');
            row.classList.add('selected-row');
        }
    });

    // 2. Hide the entire table container
    tableContainer.style.display = 'none';

    // 3. Display the definition area
    const titleElement = document.getElementById(DESCRIPTION_TITLE_ID);
    const definitionElement = document.getElementById(DEFINITION_TEXT_ID);
    const exampleElement = document.getElementById(EXAMPLE_TEXT_ID); 
    const area = document.getElementById(DESCRIPTION_AREA_ID);

    titleElement.textContent = `📜 ${entry.word}`;
    
    let definition = entry.definition || "No definition available."; 
    definitionElement.textContent = definition;
    
    let example = entry.example || "";
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

    // 1. Show the table container
    tableContainer.style.display = 'block';

    // 2. Restore all rows 
    Array.from(tbody.children).forEach(row => {
        row.classList.remove('hidden-row');
        row.classList.remove('selected-row');
    });

    // 3. Hide definition area
    area.style.display = 'none';
    backButton.style.display = 'none';
    
    // 4. Re-render the last search result
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
        status.textContent = "❌ No words found matching your search. Try a different term.";
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

        // Use the DISPLAY_COLUMNS configuration for rendering
        DISPLAY_COLUMNS.forEach(col => {
            const cell = row.insertCell();
            let value = entry[col.key] || '';
            
            cell.textContent = value;
        });
    });

    const currentQuery = document.getElementById(SEARCH_INPUT_ID).value.toLowerCase().trim();
    if (currentQuery) {
        status.textContent = `🔎 ${dataToDisplay.length} word(s) found. Click a row to view the full definition.`;
        status.className = 'info';
    }
}

/**
 * Filters dictionaryData based on the search query.
 */
function filterData(query) {
    const queryLower = query.toLowerCase().trim();
    const status = document.getElementById(STATUS_MESSAGE_ID);
    const tableContainer = document.getElementById('bookTableContainer');

    document.getElementById(DESCRIPTION_AREA_ID).style.display = 'none';
    document.getElementById(BACK_BUTTON_ID).style.display = 'none';

    if (!queryLower) {
        // HIDE table and clear content when search is empty
        document.getElementById(TABLE_BODY_ID).innerHTML = '';
        tableContainer.style.display = 'none';
        status.textContent = "Start typing above to search for a word.";
        status.className = 'info';
        lastFilterResults = [];
        return;
    }

    const filtered = dictionaryData.filter(entry => {
        // Search against the word and synonyms fields
        const wordMatch = entry.word && entry.word.toLowerCase().includes(queryLower);
        const synonymMatch = entry.synonyms && entry.synonyms.toLowerCase().includes(queryLower);
        return wordMatch || synonymMatch;
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
    if (!csvText) return;

    dictionaryData = parseCSV(csvText); 
    
    if (dictionaryData.length > 0) {
        // Ensure the table is visually empty and hidden on load.
        document.getElementById(TABLE_BODY_ID).innerHTML = ''; 
        tableContainer.style.display = 'none';

        status.textContent = "Start typing above to search for a word.";
        status.className = 'info';
    } else {
        status.textContent = `⚠️ Failed to load dictionary entries. Check your Google Sheet data.`;
        status.className = 'error';
    }
}

document.addEventListener('DOMContentLoaded', init);
