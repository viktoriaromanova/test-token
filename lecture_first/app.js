// Wait for the DOM to fully load before accessing elements
document.addEventListener('DOMContentLoaded', function () {
    // Grab references to UI elements
    const analyzeBtn = document.getElementById('analyzeBtn');
    const apiTokenInput = document.getElementById('apiToken');
    const reviewDisplay = document.getElementById('reviewDisplay');
    const sentimentIcon = document.getElementById('sentimentIcon');
    const sentimentLabel = document.getElementById('sentimentLabel');
    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');
    const loadingDiv = document.getElementById('loading');

    let reviews = [];

    analyzeBtn.disabled = true;

    /**
     * Load and parse the TSV file containing product reviews.
     * Papa Parse is used here to handle the TSV format; it will return an array of objects with keys matching the header names.
     */
    fetch('reviews_test.tsv')
        .then(response => response.text())
        .then(tsvData => {
            // Parse the TSV data into a JavaScript object
            const parsedData = Papa.parse(tsvData, {
                header: true,     // Use the first row as header names
                delimiter: '\t',  // Explicitly set tab as the delimiter
                skipEmptyLines: true
            });

            // If Papa Parse reports any parsing errors, notify the user
            if (parsedData.errors.length > 0) {
                showError('Error parsing TSV file: ' + parsedData.errors[0].message);
                return;
            }

            // Extract the 'text' field from each row and filter out empty or whitespace-only entries
            reviews = parsedData.data
                .map(row => row.text)
                .filter(text => text && text.trim() !== '');

            // If no valid reviews were found, show an error
            if (reviews.length === 0) {
                showError('No reviews found in the TSV file');
                return;
            }

            // Enable the analyze button now that reviews have been loaded
            analyzeBtn.disabled = false;
        })
        .catch(error => {
            // Handle network or fetch errors
            showError('Error loading TSV file: ' + error.message);
        });

    // When the user clicks the button, analyze a random review
    analyzeBtn.addEventListener('click', function () {
        analyzeRandomReview();
    });

    /**
     * Select a random review, display it, and request a sentiment analysis from Hugging Face.
     */
    function analyzeRandomReview() {
        // Reset UI elements for a new analysis
        hideError(); // Remove any previous error messages
        resultDiv.classList.add('hidden'); // Hide previous results
        loadingDiv.classList.remove('hidden'); // Show the loading indicator
        analyzeBtn.disabled = true; // Prevent multiple simultaneous requests

        // Pick a random review from the loaded list
        const randomIndex = Math.floor(Math.random() * reviews.length);
        const randomReview = reviews[randomIndex];

        // Display the chosen review text on the page
        reviewDisplay.textContent = randomReview;

        // Construct headers for the API request
        const apiToken = apiTokenInput.value.trim();
        const headers = {
            'Content-Type': 'application/json'
        };

        // Include the Authorization header only if the user provided a token
        if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`;
        }

        // Perform the sentiment analysis request using Hugging Face Inference API
        fetch('https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: randomReview })
        })
            .then(response => {
                // Handle non-OK HTTP responses with informative messages
                if (!response.ok) {
                    if (response.status === 503) {
                        throw new Error('Model is loading, please try again in a few moments');
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please add an API token for higher limits');
                    } else if (response.status === 401) {
                        throw new Error('Invalid API token provided');
                    } else {
                        throw new Error(`API error: ${response.status} ${response.statusText}`);
                    }
                }
                return response.json();
            })
            .then(data => {
                // Validate the response format expected from Hugging Face
                if (!data || !Array.isArray(data) || data.length === 0 || !Array.isArray(data[0]) || data[0].length === 0) {
                    throw new Error('Invalid response from API');
                }

                // Extract the first result; the API returns an array of arrays of objects
                const result = data[0][0];
                displaySentimentResult(result);
            })
            .catch(error => {
                // Show any errors encountered during the request or parsing
                showError(error.message);
            })
            .finally(() => {
                // Always hide the loading indicator and re-enable the button at the end of the call
                loadingDiv.classList.add('hidden');
                analyzeBtn.disabled = false;
            });
    }

    /**
     * Interpret the sentiment analysis result and update the UI with the appropriate icon and label.
     * @param {Object} result - Object containing label and score, e.g. {label: 'POSITIVE', score: 0.95}
     */
    function displaySentimentResult(result) {
        // Determine the sentiment category based on the label and score
        let iconHTML, iconClass, label;

        if (result.label === 'POSITIVE' && result.score > 0.5) {
            iconClass = 'positive';
            iconHTML = '<i class="fas fa-thumbs-up"></i>';
            label = 'Positive';
        } else if (result.label === 'NEGATIVE' && result.score > 0.5) {
            iconClass = 'negative';
            iconHTML = '<i class="fas fa-thumbs-down"></i>';
            label = 'Negative';
        } else {
            iconClass = 'neutral';
            iconHTML = '<i class="fas fa-question-circle"></i>';
            label = 'Neutral';
        }

        // Insert the icon into the sentimentIcon container with appropriate styling
        sentimentIcon.innerHTML = `<div class="sentiment-icon ${iconClass}">${iconHTML}</div>`;

        // Show the label along with the confidence score (converted to percentage)
        sentimentLabel.textContent = `${label} (${(result.score * 100).toFixed(1)}% confidence)`;

        // Display the result container
        resultDiv.classList.remove('hidden');
    }

    /**
     * Display an error message to the user.
     * @param {string} message - Description of the error encountered.
     */
    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        loadingDiv.classList.add('hidden');
        analyzeBtn.disabled = false;
    }

    /**
     * Hide the error message area.
     */
    function hideError() {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
});
