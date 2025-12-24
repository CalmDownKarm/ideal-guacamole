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
                    const payload = JSON.parse(atob(tokenParts[1]));
                    console.log('ID Token payload:', {
                        email: payload.email,
                        sub: payload.sub,
                        aud: payload.aud,
                        iss: payload.iss,
                        exp: payload.exp,
                        expDate: new Date(payload.exp * 1000).toISOString()
                    });
                }
            } catch (e) {
                console.error('Error decoding ID token:', e);
            }
            
            window.location.hash = '';
            updateAuthUI();
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
    loadCoffees();
    loadBrews();
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
    
    // Make setBrewerDefaults available globally for form reset
    window.setBrewerDefaults = function(brewer) {
        if (!brewer) {
            // Default values for no brewer selected
            doseInput.value = '15';
            drinkWeightInput.value = '250';
            numberOfPoursInput.value = '2';
            grindSizeInput.value = '4';
            return;
        }
        
        switch(brewer) {
            case 'Espresso':
                doseInput.value = '18';
                drinkWeightInput.value = '54';
                numberOfPoursInput.value = '1';
                grindSizeInput.value = '4'; // Keep default, user can adjust
                break;
            case 'ORB Soup':
                doseInput.value = '22';
                drinkWeightInput.value = '88';
                numberOfPoursInput.value = '2';
                grindSizeInput.value = '4';
                break;
            default:
                // Default for all other brewers
                doseInput.value = '15';
                drinkWeightInput.value = '250';
                numberOfPoursInput.value = '2';
                grindSizeInput.value = '4';
                break;
        }
    };
    
    // Set defaults when brewer changes
    brewerSelect.addEventListener('change', (e) => {
        window.setBrewerDefaults(e.target.value);
    });
    
    // Set initial defaults on page load
    window.setBrewerDefaults(brewerSelect.value);
}

// Load coffees from Airtable via backend proxy
async function loadCoffees() {
    const coffeeSelect = document.getElementById('coffee');
    
    try {
        const data = await callAirtableProxy('list', CONFIG.coffeeTable, {
            filter: 'AND({Opened}, NOT({Killed}))',
            sort: { field: 'Roast Date', direction: 'asc' }
        });
        
        // Clear loading message
        coffeeSelect.innerHTML = '<option value="">Select a coffee</option>';
        
        // Populate dropdown
        data.records.forEach(record => {
            const option = document.createElement('option');
            option.value = record.id;
            // Use Name/Producer field from Coffee Freezer table
            option.textContent = record.fields['Name/Producer'] || `Coffee ${record.id}`;
            coffeeSelect.appendChild(option);
        });
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
    
    // Get values with defaults
    const grinder = formData.get('grinder') || getDefaultValue('grinder', brewer);
    const grindSize = formData.get('grind-size') || getDefaultValue('grind-size', brewer);
    const dose = formData.get('dose') || getDefaultValue('dose', brewer);
    const drinkWeight = formData.get('water-weight') || getDefaultValue('drink-weight', brewer);
    const numberOfPours = formData.get('number-of-pours') || getDefaultValue('number-of-pours', brewer);
    const waterTemp = formData.get('water-temperature') || getDefaultValue('water-temperature', brewer);
    
    // Validate required fields
    const coffeeId = formData.get('coffee');
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
    
    // Prepare brew data
    const brewData = {
        fields: {
            'Coffee': [coffeeId], // Link to coffee record
            'Brew Date': dateTime,
            'Grinder Used': grinder,
            'Grind Size': parseFloat(grindSize),
            'Brewer': brewer,
            'Total Brew Time': formData.get('total-brew-time') || '',
            'Dose': parseFloat(dose),
            'Drink Weight': parseFloat(drinkWeight),
            'Enjoyment Rating': parseInt(formData.get('enjoyment')),
            'Notes & Tasting': formData.get('taste') || ''
        }
    };
    
    // Add optional fields
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
        form.reset();
        document.getElementById('rating-display').textContent = '5';
        
        // Reset defaults after form reset
        const brewerSelect = document.getElementById('brewer');
        if (brewerSelect && window.setBrewerDefaults) {
            window.setBrewerDefaults(brewerSelect.value);
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
            return;
        }
        
        // Clear loading message
        brewsList.innerHTML = '';
        
        // Display each brew
        for (const record of data.records) {
            const brewCard = await createBrewCard(record);
            brewsList.appendChild(brewCard);
        }
        
    } catch (error) {
        console.error('Error loading brews:', error);
        brewsList.innerHTML = `
            <div class="message error">
                Error loading brews: ${error.message}
            </div>
        `;
    }
}

// Create brew card element
async function createBrewCard(record) {
    const card = document.createElement('div');
    card.className = 'brew-card';
    
    const fields = record.fields;
    
    // Get coffee name if linked
    let coffeeName = 'Unknown Coffee';
    if (fields.Coffee && fields.Coffee.length > 0) {
        try {
            const coffeeData = await callAirtableProxy('get', CONFIG.coffeeTable, {
                recordId: fields.Coffee[0]
            });
            coffeeName = coffeeData.fields['Name/Producer'] || 'Unknown Coffee';
        } catch (error) {
            console.error('Error fetching coffee name:', error);
        }
    }
    
    // Format date
    const dateTime = fields['Brew Date'] || '';
    const date = dateTime ? new Date(dateTime).toLocaleString() : 'Unknown date';
    
    // Format method badge
    const method = fields['Brew Method'] || '';
    const methodClass = method.toLowerCase();
    
    card.innerHTML = `
        <div class="brew-card-header">
            <div>
                <div class="brew-coffee">${coffeeName}</div>
                <div class="brew-date">${date}</div>
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

