// Configuration
// Only table names need to be configured here - API key is stored securely on the backend
const CONFIG = {
    coffeeTable: 'Coffee Freezer', // Name of your coffee stash table
    brewTable: 'Coffee Brews' // Name of your brews table
};

// Backend proxy endpoint (automatically detects Netlify or Vercel)
// For Netlify: uses /.netlify/functions/airtable-proxy
// For Vercel: uses /api/airtable-proxy
// For local dev: you can set this manually or use environment detection
const getProxyUrl = () => {
    // Auto-detect based on current URL
    if (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('netlify.com')) {
        return '/.netlify/functions/airtable-proxy';
    } else if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('vercel.com')) {
        return '/api/airtable-proxy';
    } else {
        // For local development, default to Netlify format
        // Change this to '/api/airtable-proxy' if using Vercel locally
        return '/.netlify/functions/airtable-proxy';
    }
};

const PROXY_URL = getProxyUrl();

// Helper function to call backend proxy
async function callAirtableProxy(action, table, options = {}) {
    const { data, recordId, sort } = options;
    
    const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action,
            table,
            data,
            recordId,
            sort
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return await response.json();
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeForm();
    loadCoffees();
    loadBrews();
});

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
}

// Load coffees from Airtable via backend proxy
async function loadCoffees() {
    const coffeeSelect = document.getElementById('coffee');
    
    try {
        const data = await callAirtableProxy('list', CONFIG.coffeeTable);
        
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
    
    // Get current date/time
    const now = new Date();
    const dateTime = now.toISOString();
    
    // Prepare brew data
    const brewData = {
        fields: {
            'Coffee': [formData.get('coffee')], // Link to coffee record
            'Brew Date': dateTime,
            'Brew Method': formData.get('method'),
            'Grinder Used': formData.get('grinder'),
            'Grind Size': formData.get('grind-size'),
            'Brewer': formData.get('brewer'),
            'Total Brew Time': formData.get('total-brew-time') || '',
            'Dose': parseFloat(formData.get('dose')),
            'Drink Weight': parseFloat(formData.get('water-weight')),
            'Enjoyment Rating': parseInt(formData.get('enjoyment')),
            'Notes & Tasting': formData.get('taste') || ''
        }
    };
    
    // Add optional fields if provided
    const numberOfPours = formData.get('number-of-pours');
    if (numberOfPours) {
        brewData.fields['Number of Pours'] = parseInt(numberOfPours);
    }
    
    const waterTemp = formData.get('water-temperature');
    if (waterTemp) {
        brewData.fields['Water Temperature (°C)'] = parseFloat(waterTemp);
    }
    
    try {
        await callAirtableProxy('create', CONFIG.brewTable, { data: brewData });

        // Success
        showMessage('Brew saved successfully!', 'success');
        form.reset();
        document.getElementById('rating-display').textContent = '5';
        
        // Reload brews list
        loadBrews();
        
    } catch (error) {
        console.error('Error saving brew:', error);
        showMessage(`Error saving brew: ${error.message}`, 'error');
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

