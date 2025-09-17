document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const apiTokenInput = document.getElementById('apiToken');
    const reviewDisplay = document.getElementById('reviewDisplay');
    const sentimentIcon = document.getElementById('sentimentIcon');
    const sentimentLabel = document.getElementById('sentimentLabel');
    const resultDiv = document.getElementById('result');
    const errorDiv = document.getElementById('error');
    const loadingDiv = document.getElementById('loading');
    
    let reviews = [];
    
    // Load and parse the TSV file
    fetch('reviews_test.tsv')
        .then(response => response.text())
        .then(tsvData => {
            const parsedData = Papa.parse(tsvData, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true
            });
            
            if (parsedData.errors.length > 0) {
                showError('Error parsing TSV file: ' + parsedData.errors[0].message);
                return;
            }
            
            reviews = parsedData.data.map(row => row.text).filter(text => text && text.trim() !== '');
            
            if (reviews.length === 0) {
                showError('No reviews found in the TSV file');
                return;
            }
            
            analyzeBtn.disabled = false;
        })
        .catch(error => {
            showError('Error loading TSV file: ' + error.message);
        });
    
    analyzeBtn.addEventListener('click', function() {
        analyzeRandomReview();
    });
    
    function analyzeRandomReview() {
        // Reset UI
        hideError();
        resultDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        analyzeBtn.disabled = true;
        
        // Get random review
        const randomIndex = Math.floor(Math.random() * reviews.length);
        const randomReview = reviews[randomIndex];
        
        // Display the review
        reviewDisplay.textContent = randomReview;
        
        // Prepare API request
        const apiToken = apiTokenInput.value.trim();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (apiToken) {
            headers['Authorization'] = `Bearer ${apiToken}`;
        }
        
        // Call Hugging Face API
        fetch('https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ inputs: randomReview })
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error('Model is loading, please try again in a few moments');
                } else if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please add an API token for higher limits');
                } else {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
            }
            return response.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data) || data.length === 0) {
                throw new Error('Invalid response from API');
            }
            
            const result = data[0][0];
            displaySentimentResult(result, randomReview);
        })
        .catch(error => {
            showError(error.message);
        })
        .finally(() => {
            loadingDiv.classList.add('hidden');
            analyzeBtn.disabled = false;
        });
    }
    
    function displaySentimentResult(result, review) {
        let iconClass, icon, label;
        
        if (result.label === 'POSITIVE' && result.score > 0.5) {
            iconClass = 'positive';
            icon = '<i class="fas fa-thumbs-up"></i>';
            label = 'Positive';
        } else if (result.label === 'NEGATIVE' && result.score > 0.5) {
            iconClass = 'negative';
            icon = '<i class="fas fa-thumbs-down"></i>';
            label = 'Negative';
        } else {
            iconClass = 'neutral';
            icon = '<i class="fas fa-question-circle"></i>';
            label = 'Neutral';
        }
        
        sentimentIcon.innerHTML = `<div class="sentiment-icon ${iconClass}">${icon}</div>`;
        sentimentLabel.textContent = `${label} (${(result.score * 100).toFixed(1)}% confidence)`;
        
        resultDiv.classList.remove('hidden');
    }
    
    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        loadingDiv.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
    
    function hideError() {
        errorDiv.classList.add('hidden');
        errorDiv.textContent = '';
    }
});
