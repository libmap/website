import sidebar from './sidebar.js';
import url from './url.js';
import tweets from './tweets.js';

function displaySearchedTerm(term) {
    const termsContainer = document.getElementById('searched-terms-container');
    const existingTerms = Array.from(termsContainer.children).map(termBox => termBox.textContent.trim());

    // Check if the term already exists
    if (!existingTerms.includes(term)) {
        // Check if the term is a hashtag or an account
        const isHashtag = term.startsWith('#');
        const isAccount = term.startsWith('@');

        // If it's a hashtag, remove existing hashtags
        if (isHashtag) {
            removeExistingTerms(termsContainer, '#');
        }

        // If it's an account, remove existing accounts
        if (isAccount) {
            removeExistingTerms(termsContainer, '@');
        }

        // Create a new term box
        const termBox = document.createElement('div');
        termBox.className = 'searched-term-box';
        termBox.innerHTML = `
            <span>${term}</span>
            <button class="remove-term-btn">&times;</button>
        `;

        // Append the new term box
        termsContainer.appendChild(termBox);

        // If needed, you can now handle the search logic for the new term
        // handleSearch();
    }
}


// Helper function to remove existing terms based on a prefix (e.g., '#' or '@')
function removeExistingTerms(termsContainer, prefix) {
    const existingTerms = Array.from(termsContainer.children);
    existingTerms.forEach(termBox => {
        const term = termBox.textContent.trim();
        if (term.startsWith(prefix)) {
            termsContainer.removeChild(termBox);
        }
    });
}

function removeSearchedTerm(term, event) {
    const termsContainer = document.getElementById('searched-terms-container');

    // Get all elements with the class 'searched-term-box'
    const termBoxes = document.querySelectorAll('.searched-term-box');

    // Loop through the elements to find the one with the specified term
    for (const termBox of termBoxes) {
        const span = termBox.querySelector('span');
        if (span && span.textContent === term) {
            // Remove the element if the term matches
            termsContainer.removeChild(termBox);

            // Get the current state
            let state = url.getState();

            // Check if the removed term was an account or hashtag
            if (term.startsWith('@')) {
                // Remove the account from the state
                delete state.account;
                delete tweets.data.account
            } else if (term.startsWith('#')) {
                // Remove the hashtag from the state
                delete state.hashtag;
                delete tweets.data.hashtag
            }

            url.pushState(state);


            sidebar.displayTweets('', 1, true);

            //base.setState()

            // If event is provided, update the display based on the removed term
            if (event) {
                handleSearch(event);
            }

            break; // Break the loop since we found and removed the element
        }
    }
}

function handleSearch(event) {
    // Check if the Enter key is pressed (key code 13)
    if (event.key === 'Enter') {
        var searchTerm = document.getElementById('term-search').value;
        // Implement your search logic here, possibly using filterTweetsByAccount or similar
        document.getElementById('tweets').innerHTML = ''; // Clear previous tweets
        sidebar.displayTweets(searchTerm);

        // Display the searched term as a box
        displaySearchedTerm(searchTerm);

        // Clear the search input after adding the term
        clearSearchInput();
    }
}

function clearSearchInput() {
    document.getElementById('term-search').value = '';
}

// Event listener for the search input
document.addEventListener('DOMContentLoaded', function () {
    const termsContainer = document.getElementById('searched-terms-container');

    termsContainer.addEventListener('click', function (event) {
        if (event.target.classList.contains('remove-term-btn')) {
            const term = event.target.previousElementSibling.textContent;
            removeSearchedTerm(term, event);
        }
    });

    search.displayInitialSearchedTerms();

    var searchInput = document.getElementById('term-search');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keydown', handleSearch);
    }

    var clearButton = document.querySelector('.clear-btn');
    if (clearButton) {
        clearButton.addEventListener('click', clearSearch);
    }
});


// Function to clear the search
function clearSearch() {
    sidebar.clearSearch()
    sidebar.displayTweets('', 1, true);
    // Clear the results or reset the display
    // Update the display to show all tweets again
}

let search = {
    displayInitialSearchedTerms: function () {
        const termsContainer = document.getElementById('searched-terms-container');
        //const existingTerms = Array.from(termsContainer.children).map(termBox => termBox.textContent.trim());
        const state = url.getState();
    
        // Check if state.account exists and display the account term
        if (state.account) {
            displaySearchedTerm(`@${state.account}`);
        } else {
            removeExistingTerms(termsContainer, '@');
        }
    
        // Check if state.hashtag exists and display the hashtag term
        if (state.hashtag) {
            displaySearchedTerm(`#${state.hashtag}`);
        } else {
            removeExistingTerms(termsContainer, '#');
        }
    }

}

export default search

