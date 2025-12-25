// Configuration
// Only table names need to be configured here - API key is stored securely on the backend
const CONFIG = {
    coffeeTable: 'Coffee Freezer', // Name of your coffee stash table
    brewTable: 'Coffee Brews', // Name of your brews table
    // Auth0 config is loaded from serverless function (see initializeAuth0)
};

// Initialize Auth0 (will be initialized after config loads)
let auth0Client = null;

function initializeAuth0() {
    // Wait for Auth0 SDK and config to be available
    if (!window.auth0) {
        console.warn('Auth0 SDK not loaded');
        return;
    }
    
    const domain = window.AUTH0_DOMAIN;
    const clientId = window.AUTH0_CLIENT_ID;
    
    if (!domain || !clientId) {
        console.warn('Auth0 not configured - domain or client ID missing');
        return;
    }
    
    try {
        auth0Client = new window.auth0.WebAuth({
            domain: domain,
            clientID: clientId,
            redirectUri: window.location.origin,
            responseType: 'token id_token',
            scope: 'openid profile email'
        });
        console.log('Auth0 initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Auth0:', error);
    }
}

// Backend proxy endpoint for Netlify
// Uses /.netlify/functions/airtable-proxy
const getProxyUrl = () => {
    // Auto-detect Netlify or default to Netlify format for local development
    if (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('netlify.com')) {
        return '/.netlify/functions/airtable-proxy';
    } else {
        // For local development with Netlify Dev
        return '/.netlify/functions/airtable-proxy';
    }
};

const PROXY_URL = getProxyUrl();

// Helper function to call backend proxy
async function callAirtableProxy(action, table, options = {}) {
    const { data, recordId, sort, filter } = options;
    
    // Include Auth0 access token for create actions
    const authToken = action === 'create' ? getAuthToken() : null;
    
    if (action === 'create') {
        if (!authToken) {
            console.error('No auth token available for create action');
        } else {
            console.log('Sending auth token (length:', authToken.length, ')');
        }
    }
    
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            action,
            table,
            data,
            recordId,
            sort,
            filter
        })
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            // If response isn't JSON, create error from status
            errorData = { error: `Request failed: ${response.statusText}` };
        }
        const error = new Error(errorData.error || `Request failed: ${response.statusText}`);
        error.status = response.status;
        error.responseData = errorData;
        throw error;
    }

    return await response.json();
}

// Auth0 Authentication
let accessToken = null;
let idToken = null;
let userEmail = null; // Store logged-in user's email

function getAuthToken() {
    // For Auth0 SPAs, use ID token (always JWT) instead of access token (might be opaque)
    // The ID token contains the user's email and can be verified
    const token = idToken || accessToken;
    console.log('getAuthToken called:', {
        hasIdToken: !!idToken,
        hasAccessToken: !!accessToken,
        tokenLength: token ? token.length : 0,
        tokenPreview: token ? token.substring(0, 50) + '...' : 'null'
    });
    return token;
}

function parseHash() {
    if (!auth0Client) {
        // If Auth0 client not initialized, check if we have tokens in URL hash anyway
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            // Auth0 client not ready, but we have tokens - wait a bit and try again
            setTimeout(() => {
                if (auth0Client) {
                    parseHash();
                }
            }, 100);
        }
        return;
    }
    
    auth0Client.parseHash((err, authResult) => {
        if (err) {
            console.error('Error parsing hash:', err);
            updateAuthUI();
            return;
        }
        
        if (authResult && authResult.accessToken && authResult.idToken) {
            accessToken = authResult.accessToken;
            idToken = authResult.idToken;
            
            // Debug: Decode ID token to see what's in it
            try {
                const tokenParts = idToken.split('.');
                if (tokenParts.length === 3) {
                    // Handle URL-safe base64 (JWT uses base64url encoding)
                    let base64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
                    // Add padding if needed
                    while (base64.length % 4) {
                        base64 += '=';
                    }
                    const payload = JSON.parse(atob(base64));
                    console.log('ID Token payload:', {
                        email: payload.email,
                        sub: payload.sub,
                        aud: payload.aud,
                        iss: payload.iss,
                        exp: payload.exp,
                        expDate: new Date(payload.exp * 1000).toISOString()
                    });
                    // Store user email for later use
                    userEmail = payload.email;
                }
            } catch (e) {
                console.error('Error decoding ID token:', e);
            }
            
            window.location.hash = '';
            updateAuthUI();
            
            // Fetch user config and load coffees after successful login
            fetchUserConfig().then(() => {
                loadCoffees();
            });
            
            // Switch to New Brew tab after login
            document.querySelector('[data-tab="form"]')?.click();
        } else {
            // No tokens in hash, update UI to show login
            console.log('No tokens in authResult:', authResult);
            updateAuthUI();
        }
    });
}

function login() {
    if (!auth0Client) {
        alert('Auth0 not configured. Please set AUTH0_DOMAIN and AUTH0_CLIENT_ID.');
        return;
    }
    // Request email scope to ensure email is in ID token
    auth0Client.authorize({
        scope: 'openid profile email'
    });
}

function logout() {
    accessToken = null;
    idToken = null;
    userEmail = null;
    updateAuthUI();
    if (auth0Client) {
        auth0Client.logout({
            returnTo: window.location.origin
        });
    }
}

function updateAuthUI() {
    const isAuthenticated = !!accessToken;
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const brewForm = document.getElementById('brew-form');
    const authRequiredMessage = document.getElementById('auth-required-message');
    
    if (loginButton) loginButton.style.display = isAuthenticated ? 'none' : 'inline-block';
    if (logoutButton) logoutButton.style.display = isAuthenticated ? 'inline-block' : 'none';
    if (brewForm) brewForm.style.display = isAuthenticated ? 'block' : 'none';
    if (authRequiredMessage) authRequiredMessage.style.display = isAuthenticated ? 'none' : 'block';
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Set initial UI state (form hidden, login button visible)
    updateAuthUI();
    
    // Wait for Auth0 config to load (if not already loaded from HTML script)
    if (!window.AUTH0_DOMAIN || !window.AUTH0_CLIENT_ID) {
        try {
            const response = await fetch('/.netlify/functions/auth0-config');
            if (!response.ok) {
                throw new Error(`Config endpoint returned ${response.status}`);
            }
            const config = await response.json();
            window.AUTH0_DOMAIN = config.domain || '';
            window.AUTH0_CLIENT_ID = config.clientId || '';
            
            if (!window.AUTH0_DOMAIN || !window.AUTH0_CLIENT_ID) {
                throw new Error('Auth0 config missing domain or client ID');
            }
        } catch (error) {
            console.error('Failed to load Auth0 config:', error);
            // Show error message if config fails
            const authRequiredMessage = document.getElementById('auth-required-message');
            if (authRequiredMessage) {
                authRequiredMessage.textContent = 'Auth0 not configured. Please set AUTH0_DOMAIN and AUTH0_CLIENT_ID environment variables in Netlify.';
                authRequiredMessage.className = 'message error';
            }
            // Still update UI to show login button (even if it won't work)
            updateAuthUI();
            return; // Don't continue initialization if Auth0 isn't configured
        }
    }
    
    // Initialize Auth0 now that config is available
    initializeAuth0();
    
    // Check for Auth0 callback (this will set accessToken if returning from login)
    parseHash();
    
    // Update UI again after parsing hash (in case we just logged in)
    updateAuthUI();
    
    initializeTabs();
    initializeForm();
    initializeAuth();
    initializeFilters();
    
    // Load brews (uses Airtable lookup fields, no separate coffee fetch needed)
    loadBrews();
    
    // Fetch user config and load coffees if logged in
    if (getAuthToken()) {
        fetchUserConfig().then(() => {
            loadCoffees();
        });
    }
});

function initializeAuth() {
    updateAuthUI();
    
    // Login/Logout button handlers
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    
    if (loginButton) {
        loginButton.addEventListener('click', login);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
}

// Tab switching
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Update buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Reload brews when switching to list tab
            if (targetTab === 'list') {
                loadBrews();
            }
        });
    });
}

// Form initialization
function initializeForm() {
    const form = document.getElementById('brew-form');
    const enjoymentSlider = document.getElementById('enjoyment');
    const ratingDisplay = document.getElementById('rating-display');

    // Update rating display
    enjoymentSlider.addEventListener('input', (e) => {
        ratingDisplay.textContent = e.target.value;
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitBrew();
    });

    // Set defaults based on brewer selection
    const brewerSelect = document.getElementById('brewer');
    const doseInput = document.getElementById('dose');
    const drinkWeightInput = document.getElementById('water-weight');
    const numberOfPoursInput = document.getElementById('number-of-pours');
    const grindSizeInput = document.getElementById('grind-size');
    
    // Track if grind size has been manually edited by user
    let grindSizeManuallySet = false;
    
    // Listen for user input on grind size field
    grindSizeInput.addEventListener('input', () => {
        grindSizeManuallySet = true;
    });
    
    // Make setBrewerDefaults available globally for form reset
    // Pass forceReset=true to reset grind size even if manually set (used after form submission)
    window.setBrewerDefaults = function(brewer, forceReset = false) {
        if (!brewer) {
            // Default values for no brewer selected
            doseInput.value = '15';
            drinkWeightInput.value = '250';
            numberOfPoursInput.value = '2';
            if (forceReset || !grindSizeManuallySet) {
                grindSizeInput.value = '4';
            }
            return;
        }
        
        switch(brewer) {
            case 'Espresso':
                doseInput.value = '18';
                drinkWeightInput.value = '54';
                numberOfPoursInput.value = '1';
                break;
            case 'ORB Soup':
                doseInput.value = '22';
                drinkWeightInput.value = '88';
                numberOfPoursInput.value = '2';
                break;
            default:
                // Default for all other brewers
                doseInput.value = '15';
                drinkWeightInput.value = '250';
                numberOfPoursInput.value = '2';
                break;
        }
        
        // Only set grind size if not manually edited or if force resetting
        if (forceReset || !grindSizeManuallySet) {
            grindSizeInput.value = '4';
        }
    };
    
    // Reset the manual flag (call this after successful form submission)
    window.resetGrindSizeFlag = function() {
        grindSizeManuallySet = false;
    };
    
    // Set defaults when brewer changes (use 'input' for text input with datalist)
    brewerSelect.addEventListener('input', (e) => {
        window.setBrewerDefaults(e.target.value);
    });
    
    // Also listen for blur to catch datalist selections
    brewerSelect.addEventListener('blur', (e) => {
        window.setBrewerDefaults(e.target.value);
    });
    
    // Set initial defaults on page load
    window.setBrewerDefaults(brewerSelect.value);
}

// Populate brewer datalist from existing brews
function populateBrewerDatalist() {
    const datalist = document.getElementById('brewer-list');
    if (!datalist) return;
    
    // Get unique brewers from all brews
    const brewers = [...new Set(allBrewsData
        .map(b => b.fields.Brewer)
        .filter(Boolean)
    )].sort();
    
    // Add default brewers if not already present
    const defaultBrewers = ['V60', 'Neo', 'Neo Switch', 'Pulsar', 'Orea V4', 'ORB Soup', 'Espresso'];
    const allBrewers = [...new Set([...defaultBrewers, ...brewers])].sort();
    
    datalist.innerHTML = allBrewers.map(b => `<option value="${b}">`).join('');
}

// User config for multi-tenancy
let userConfig = {
    hasPersonalBase: false,
    baseId: '',
    apiKey: ''
};

// Cache of loaded coffees (id -> full record)
let coffeeCache = {};

// Fetch user's Airtable config (if logged in)
async function fetchUserConfig() {
    const authToken = getAuthToken();
    if (!authToken) {
        userConfig = { hasPersonalBase: false, baseId: '', apiKey: '' };
        return;
    }
    
    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ action: 'getUserConfig' })
        });
        
        if (response.ok) {
            const data = await response.json();
            userConfig = {
                hasPersonalBase: data.hasPersonalBase || false,
                baseId: data.baseId || '',
                apiKey: data.apiKey || ''
            };
            console.log('User config loaded:', userConfig.hasPersonalBase ? 'Personal base' : 'Community Stash');
        }
    } catch (error) {
        console.error('Error fetching user config:', error);
        userConfig = { hasPersonalBase: false, baseId: '', apiKey: '' };
    }
}

// Load coffees from user's personal base or Community Stash
async function loadCoffees() {
    const coffeeSelect = document.getElementById('coffee');
    
    // Only load coffees if user is logged in
    if (!getAuthToken()) {
        coffeeSelect.innerHTML = '<option value="">Login to see coffees</option>';
        return;
    }
    
    try {
        // Fetch coffees using user's config (personal base or Community Stash)
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'listUserCoffees',
                userBaseId: userConfig.baseId,
                userApiKey: userConfig.apiKey
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch coffees');
        }
        
        const data = await response.json();
        
        // Clear loading message and cache
        coffeeSelect.innerHTML = '<option value="">Select a coffee</option>';
        coffeeCache = {};
        
        // Populate dropdown and cache coffee details
        data.records.forEach(record => {
            // Cache the full record for later use
            coffeeCache[record.id] = record.fields;
            
            const option = document.createElement('option');
            option.value = record.id;
            // Use Name/Producer field from Coffee Freezer table
            option.textContent = record.fields['Name/Producer'] || `Coffee ${record.id}`;
            coffeeSelect.appendChild(option);
        });
        
        console.log('Cached', Object.keys(coffeeCache).length, 'coffees');
        
        // Show indicator if using Community Stash
        if (!userConfig.hasPersonalBase) {
            const firstOption = coffeeSelect.querySelector('option');
            if (firstOption) {
                firstOption.textContent = 'Select from Community Stash';
            }
        }
    } catch (error) {
        console.error('Error loading coffees:', error);
        coffeeSelect.innerHTML = '<option value="">Error loading coffees</option>';
        showMessage(`Error loading coffees: ${error.message}`, 'error');
    }
}

// Submit brew to Airtable
async function submitBrew() {
    const form = document.getElementById('brew-form');
    const submitButton = form.querySelector('.submit-button');
    const formData = new FormData(form);
    
    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    
    // Get current date in YYYY-MM-DD format (Airtable Date field format)
    const now = new Date();
    const dateTime = now.toISOString().split('T')[0]; // "2024-12-24"
    
    // Get brewer to determine defaults
    const brewer = formData.get('brewer') || '';
    
    // Helper function to get default values based on brewer
    function getDefaultValue(field, brewer) {
        switch(field) {
            case 'grinder':
                return 'P80';
            case 'grind-size':
                return '4';
            case 'dose':
                if (brewer === 'Espresso') return '18';
                if (brewer === 'ORB Soup') return '22';
                return '15';
            case 'drink-weight':
                if (brewer === 'Espresso') return '54';
                if (brewer === 'ORB Soup') return '88';
                return '250';
            case 'number-of-pours':
                if (brewer === 'Espresso') return '1';
                return '2';
            case 'water-temperature':
                return '93';
            default:
                return '';
        }
    }
    
    // Get values with defaults (empty strings should use defaults too)
    const getValueOrDefault = (fieldName, defaultField) => {
        const value = formData.get(fieldName);
        return (value && value.trim() !== '') ? value : getDefaultValue(defaultField, brewer);
    };
    
    const grinder = getValueOrDefault('grinder', 'grinder');
    const grindSize = getValueOrDefault('grind-size', 'grind-size');
    const dose = getValueOrDefault('dose', 'dose');
    const drinkWeight = getValueOrDefault('water-weight', 'drink-weight');
    const numberOfPours = getValueOrDefault('number-of-pours', 'number-of-pours');
    const waterTemp = getValueOrDefault('water-temperature', 'water-temperature');
    
    console.log('Form values:', { grinder, grindSize, dose, drinkWeight, numberOfPours, waterTemp });
    
    // Validate required fields
    let coffeeId = formData.get('coffee');
    if (!coffeeId) {
        showMessage('Please select a coffee from your stash.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Save Brew';
        return;
    }
    
    if (!brewer) {
        showMessage('Please select a brewer.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Save Brew';
        return;
    }
    
    // Get coffee details from cache
    const coffeeDetails = coffeeCache[coffeeId] || {};
    const coffeeName = coffeeDetails['Name/Producer'] || 'Unknown Coffee';
    
    console.log('Coffee details from cache:', coffeeDetails);
    
    // Prepare brew data with coffee details as text fields (no linked record needed)
    const brewData = {
        fields: {
            // Coffee details as text fields (works for any user's base)
            'Coffee Name': coffeeName,
            'Roaster': coffeeDetails['Roaster'] || '',
            'Roast Date': coffeeDetails['Roast Date'] || '',
            'Varietal': coffeeDetails['Varietal'] || '',
            'Origin': coffeeDetails['Origin'] || '',
            'Process': coffeeDetails['Process'] || '',
            // Brew details
            'Brew Date': dateTime,
            'Grinder Used': grinder,
            'Grind Size': parseFloat(grindSize),
            'Brewer': brewer,
            'Dose': parseFloat(dose),
            'Drink Weight': parseFloat(drinkWeight),
            'Enjoyment Rating': parseInt(formData.get('enjoyment'))
        }
    };
    
    // Add user email (CreatedBy field)
    if (userEmail) {
        brewData.fields['User'] = userEmail;
    }
    
    // Auto-set Brew Method based on brewer
    const brewMethod = (brewer === 'Espresso' || brewer === 'ORB Soup') ? 'Espresso' : 'Filter';
    brewData.fields['Brew Method'] = brewMethod;
    
    // Add optional fields only if they have values
    const totalBrewTime = formData.get('total-brew-time');
    console.log('Total Brew Time raw value:', totalBrewTime);
    if (totalBrewTime && totalBrewTime.trim() !== '') {
        // Convert to seconds for Airtable Duration field
        // Input can be: "2:30" (m:ss), "5:44" (m:ss), "1:02:30" (h:mm:ss), or just "30" (seconds)
        const timeStr = totalBrewTime.trim();
        let totalSeconds = 0;
        
        const parts = timeStr.split(':').map(p => parseInt(p, 10) || 0);
        if (parts.length === 1) {
            // Just seconds: "30" -> 30 seconds
            totalSeconds = parts[0];
        } else if (parts.length === 2) {
            // m:ss format: "2:30" -> 2 min 30 sec
            totalSeconds = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            // h:mm:ss format: "1:02:30" -> 1 hour 2 min 30 sec
            totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        
        console.log('Total Brew Time converted to seconds:', totalSeconds);
        // Airtable Duration field accepts seconds as a number
        brewData.fields['Total Brew Time'] = totalSeconds;
    }
    
    const notes = formData.get('taste');
    if (notes && notes.trim() !== '') {
        brewData.fields['Notes & Tasting'] = notes.trim();
    }
    
    const recipe = formData.get('recipe');
    if (recipe && recipe.trim() !== '') {
        brewData.fields['Recipe'] = recipe.trim();
    }
    
    if (numberOfPours) {
        brewData.fields['Number of Pours'] = parseInt(numberOfPours);
    }
    
    if (waterTemp) {
        brewData.fields['Water Temperature (°C)'] = parseFloat(waterTemp);
    }
    
    try {
        // Verify we have an auth token before submitting
        if (!getAuthToken()) {
            accessToken = null;
            idToken = null;
            updateAuthUI();
            showMessage('You are not logged in. Please login to create brews.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Save Brew';
            return;
        }
        
        await callAirtableProxy('create', CONFIG.brewTable, { data: brewData });

        // Success
        showMessage('Brew saved successfully!', 'success');
        
        // Reset all form fields to defaults
        form.reset();
        
        // Reset the grind size manual flag so defaults apply
        if (window.resetGrindSizeFlag) {
            window.resetGrindSizeFlag();
        }
        
        // Set default values
        const brewerSelect = document.getElementById('brewer');
        if (brewerSelect) {
            brewerSelect.value = ''; // Clear brewer selection
        }
        
        // Apply defaults with forceReset to ensure grind size is reset
        if (window.setBrewerDefaults) {
            window.setBrewerDefaults('', true); // forceReset = true
        }
        
        // Set default grinder
        const grinderSelect = document.getElementById('grinder');
        if (grinderSelect) {
            grinderSelect.value = 'P80';
        }
        
        // Set default water temperature
        const waterTempInput = document.getElementById('water-temperature');
        if (waterTempInput) {
            waterTempInput.value = '93';
        }
        
        // Reset enjoyment slider and display
        const enjoymentSlider = document.getElementById('enjoyment');
        const ratingDisplay = document.getElementById('rating-display');
        if (enjoymentSlider) {
            enjoymentSlider.value = '5';
        }
        if (ratingDisplay) {
            ratingDisplay.textContent = '5';
        }
        
        // Clear recipe field
        const recipeInput = document.getElementById('recipe');
        if (recipeInput) {
            recipeInput.value = '';
        }
        
        // Clear total brew time
        const brewTimeInput = document.getElementById('total-brew-time');
        if (brewTimeInput) {
            brewTimeInput.value = '';
        }
        
        // Clear notes
        const notesInput = document.getElementById('taste');
        if (notesInput) {
            notesInput.value = '';
        }
        
        // Reload brews list
        loadBrews();
        
    } catch (error) {
        console.error('Error saving brew:', error);
        console.error('Error details:', {
            status: error.status,
            message: error.message,
            responseData: error.responseData
        });
        
        // Handle authentication errors - only logout on actual token/auth failures
        const errorMessage = error.message || '';
        const isAuthError = error.status === 401 && (
            errorMessage.includes('token') || 
            errorMessage.includes('Unauthorized') ||
            errorMessage.includes('authentication')
        );
        
        if (isAuthError) {
            // Only logout on actual authentication failures, not validation errors
            accessToken = null;
            idToken = null;
            updateAuthUI();
            showMessage('Session expired. Please login again.', 'error');
        } else if (error.status === 403 || errorMessage.includes('Forbidden') || errorMessage.includes('not authorized')) {
            showMessage('Your email is not authorized to create brews. Please contact the administrator.', 'error');
        } else {
            // Don't logout on other errors - might be validation or data issues
            const userMessage = errorMessage || 'An error occurred while saving the brew. Please check the console for details.';
            showMessage(`Error saving brew: ${userMessage}`, 'error');
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Save Brew';
    }
}

// Store all brews data for filtering
let allBrewsData = [];

// Pagination settings
let currentPage = 1;
const itemsPerPage = 10;


// Load and display brews
async function loadBrews() {
    const brewsList = document.getElementById('brews-list');
    brewsList.innerHTML = '<div class="loading">Loading brews...</div>';
    
    try {
        // Fetch brews sorted by date (newest first)
        const data = await callAirtableProxy('list', CONFIG.brewTable, {
            sort: { field: 'Brew Date', direction: 'desc' }
        });
        
        if (data.records.length === 0) {
            brewsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">☕</div>
                    <div class="empty-state-text">No brews yet. Start tracking your coffee!</div>
                </div>
            `;
            populateFilters([]);
            return;
        }
        
        // Use Airtable lookup fields directly from brew records (no extra API calls needed)
        allBrewsData = data.records.map(record => {
            const fields = record.fields;
            
            // Airtable lookup fields return arrays, get first value
            const getName = (arr) => Array.isArray(arr) && arr.length > 0 ? arr[0] : '';
            
            return {
                ...record,
                // Try new text fields first, fall back to lookup fields for older brews
                coffeeName: fields['Coffee Name'] || getName(fields['Name/Producer (from Coffee)']) || 'Unknown Coffee',
                varietal: fields['Varietal'] || getName(fields['Varietal (from Coffee)']),
                origin: fields['Origin'] || getName(fields['Origin (from Coffee)']),
                roaster: fields['Roaster'] || getName(fields['Roaster (from Coffee)']),
                process: fields['Process'] || getName(fields['Process (from Coffee)'])
            };
        });
        
        // Populate filter dropdowns
        populateFilters(allBrewsData);
        
        // Populate brewer datalist for the form
        populateBrewerDatalist();
        
        // Display brews immediately
        displayFilteredBrews();
        
    } catch (error) {
        console.error('Error loading brews:', error);
        brewsList.innerHTML = `
            <div class="message error">
                Error loading brews: ${error.message}
            </div>
        `;
    }
}

// Populate filter dropdowns with unique values
function populateFilters(brews) {
    const coffeeFilter = document.getElementById('filter-coffee');
    const varietalFilter = document.getElementById('filter-varietal');
    const brewerFilter = document.getElementById('filter-brewer');
    const userFilter = document.getElementById('filter-user');
    
    // Get unique values
    const coffees = [...new Set(brews.map(b => b.coffeeName).filter(Boolean))].sort();
    const varietals = [...new Set(brews.map(b => b.varietal).filter(Boolean))].sort();
    const brewers = [...new Set(brews.map(b => b.fields.Brewer).filter(Boolean))].sort();
    const users = [...new Set(brews.map(b => {
        const userField = b.fields['User'];
        if (typeof userField === 'string') return userField;
        if (typeof userField === 'object' && userField) return userField.email || userField.name || '';
        return '';
    }).filter(Boolean))].sort();
    
    // Populate dropdowns (preserve current selection)
    const currentCoffee = coffeeFilter.value;
    const currentVarietal = varietalFilter.value;
    const currentBrewer = brewerFilter.value;
    const currentUser = userFilter.value;
    
    // Helper to truncate long text for display
    const truncate = (text, maxLen = 25) => {
        if (!text || text.length <= maxLen) return text;
        return text.substring(0, maxLen) + '...';
    };
    
    coffeeFilter.innerHTML = '<option value="">All Coffees</option>' + 
        coffees.map(c => `<option value="${c}" title="${c}">${truncate(c)}</option>`).join('');
    varietalFilter.innerHTML = '<option value="">All Varietals</option>' + 
        varietals.map(v => `<option value="${v}" title="${v}">${truncate(v)}</option>`).join('');
    brewerFilter.innerHTML = '<option value="">All Brewers</option>' + 
        brewers.map(b => `<option value="${b}" title="${b}">${truncate(b)}</option>`).join('');
    userFilter.innerHTML = '<option value="">All Users</option>' + 
        users.map(u => `<option value="${u}" title="${u}">${truncate(u, 20)}</option>`).join('');
    
    // Restore selections
    coffeeFilter.value = currentCoffee;
    varietalFilter.value = currentVarietal;
    brewerFilter.value = currentBrewer;
    userFilter.value = currentUser;
}

// Display brews based on current filters
async function displayFilteredBrews() {
    const brewsList = document.getElementById('brews-list');
    const coffeeFilter = document.getElementById('filter-coffee').value;
    const varietalFilter = document.getElementById('filter-varietal').value;
    const brewerFilter = document.getElementById('filter-brewer').value;
    const userFilter = document.getElementById('filter-user').value;
    
    // Filter brews
    let filteredBrews = allBrewsData.filter(brew => {
        // Coffee filter
        if (coffeeFilter && brew.coffeeName !== coffeeFilter) return false;
        
        // Varietal filter
        if (varietalFilter && brew.varietal !== varietalFilter) return false;
        
        // Brewer filter
        if (brewerFilter && brew.fields.Brewer !== brewerFilter) return false;
        
        // User filter
        if (userFilter) {
            const userField = brew.fields['User'];
            let userValue = '';
            if (typeof userField === 'string') userValue = userField;
            else if (typeof userField === 'object' && userField) userValue = userField.email || userField.name || '';
            if (userValue !== userFilter) return false;
        }
        
        return true;
    });
    
    if (filteredBrews.length === 0) {
        brewsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">No brews match your filters.</div>
            </div>
        `;
        updatePagination(0, 0);
        return;
    }
    
    // Pagination calculations
    const totalItems = filteredBrews.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Ensure current page is valid
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }
    
    // Get items for current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageBrews = filteredBrews.slice(startIndex, endIndex);
    
    // Clear and display
    brewsList.innerHTML = '';
    for (const record of pageBrews) {
        const brewCard = await createBrewCardFromEnriched(record);
        brewsList.appendChild(brewCard);
    }
    
    // Update pagination controls
    updatePagination(currentPage, totalPages);
}

// Update pagination controls
function updatePagination(current, total) {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    if (!prevButton || !nextButton || !pageInfo) return;
    
    if (total === 0) {
        pageInfo.textContent = 'No results';
        prevButton.disabled = true;
        nextButton.disabled = true;
    } else {
        pageInfo.textContent = `Page ${current} of ${total}`;
        prevButton.disabled = current <= 1;
        nextButton.disabled = current >= total;
    }
}

// Initialize filter event listeners
function initializeFilters() {
    const filters = ['filter-coffee', 'filter-varietal', 'filter-brewer', 'filter-user'];
    filters.forEach(filterId => {
        const filterEl = document.getElementById(filterId);
        if (filterEl) {
            // Reset to page 1 when filter changes
            filterEl.addEventListener('change', () => {
                currentPage = 1;
                displayFilteredBrews();
            });
        }
    });
    
    // Pagination buttons
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayFilteredBrews();
                // Scroll to top of list
                document.getElementById('brews-list').scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            currentPage++;
            displayFilteredBrews();
            // Scroll to top of list
            document.getElementById('brews-list').scrollIntoView({ behavior: 'smooth' });
        });
    }
}

// Create brew card from enriched record (with cached coffee data)
async function createBrewCardFromEnriched(record) {
    const card = document.createElement('div');
    card.className = 'brew-card';
    
    const fields = record.fields;
    const coffeeName = record.coffeeName || 'Unknown Coffee';
    
    // Format date
    const dateTime = fields['Brew Date'] || '';
    const date = dateTime ? new Date(dateTime).toLocaleString() : 'Unknown date';
    
    // Format method badge
    const method = fields['Brew Method'] || '';
    const methodClass = method.toLowerCase();
    
    // Get user who created the brew
    let createdBy = '';
    const userField = fields['User'];
    if (userField) {
        if (typeof userField === 'string') {
            createdBy = userField;
        } else if (typeof userField === 'object') {
            createdBy = userField.email || userField.name || userField.id || '';
        }
    }
    
    card.innerHTML = `
        <div class="brew-card-header">
            <div>
                <div class="brew-coffee">${coffeeName}</div>
                <div class="brew-date">${date}${createdBy ? ` • ${createdBy}` : ''}</div>
            </div>
            ${method ? `<span class="brew-method ${methodClass}">${method}</span>` : ''}
        </div>
        
        <div class="brew-details">
            ${fields['Grinder Used'] ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Grinder</span>
                    <span class="brew-detail-value">${fields['Grinder Used']}</span>
                </div>
            ` : ''}
            
            ${fields['Grind Size'] ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Grind Size</span>
                    <span class="brew-detail-value">${fields['Grind Size']}</span>
                </div>
            ` : ''}
            
            ${fields.Brewer ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Brewer</span>
                    <span class="brew-detail-value">${fields.Brewer}</span>
                </div>
            ` : ''}
            
            ${fields['Total Brew Time'] ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Total Brew Time</span>
                    <span class="brew-detail-value">${fields['Total Brew Time']}</span>
                </div>
            ` : ''}
            
            ${fields.Dose !== undefined ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Dose</span>
                    <span class="brew-detail-value">${fields.Dose}g</span>
                </div>
            ` : ''}
            
            ${fields['Drink Weight'] !== undefined ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Drink Weight</span>
                    <span class="brew-detail-value">${fields['Drink Weight']}g</span>
                </div>
            ` : ''}
            
            ${fields.Ratio ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Ratio</span>
                    <span class="brew-detail-value">${fields.Ratio}</span>
                </div>
            ` : ''}
            
            ${fields['Number of Pours'] !== undefined ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Number of Pours</span>
                    <span class="brew-detail-value">${fields['Number of Pours']}</span>
                </div>
            ` : ''}
            
            ${fields['Water Temperature (°C)'] !== undefined ? `
                <div class="brew-detail">
                    <span class="brew-detail-label">Water Temperature</span>
                    <span class="brew-detail-value">${fields['Water Temperature (°C)']}°C</span>
                </div>
            ` : ''}
        </div>
        
        ${fields['Enjoyment Rating'] !== undefined ? `
            <div class="brew-rating">
                <span class="brew-rating-label">Enjoyment:</span>
                <span class="brew-rating-value">${fields['Enjoyment Rating']}/10</span>
            </div>
        ` : ''}
        
        ${fields['Notes & Tasting'] ? `
            <div class="brew-taste">
                <div class="brew-taste-label">Taste Notes</div>
                <div>${fields['Notes & Tasting']}</div>
            </div>
        ` : ''}
    `;
    
    return card;
}

// Show message to user
function showMessage(message, type) {
    const messageEl = document.getElementById('form-message');
    messageEl.textContent = message;
    messageEl.className = `message ${type}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageEl.className = 'message';
    }, 5000);
}

