import sidebar from './sidebar.js';
import url from './url.js';
import tweets from './tweets.js';

function displaySearchedTerm(term, type) {
    const termsContainer = document.getElementById('searched-terms-container');
    const existingTerms = Array.from(termsContainer.children).map(termBox => termBox.textContent.trim());

    // Check if the term already exists
    if (!existingTerms.includes(term)) {
        // Remove existing terms of same type
        removeExistingTerms(termsContainer, type === 'user' ? '@' : '#');

        // Create a new term box
        const termBox = document.createElement('div');
        termBox.className = 'searched-term-box';
        termBox.dataset.type = type;
        termBox.innerHTML = `
            <span>${type === 'user' ? '@' : '#'}${term}</span>
            <button class="remove-term-btn" aria-label="Remove filter">&times;</button>
        `;

        // Append the new term box
        termsContainer.appendChild(termBox);
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
                if(state.hashtag){
                    sidebar.hashtagToIdsDisplay(state.hashtag, true)
                } else {
                    base.visibleTweetIds = base.initVisibleTweetIds
                    sidebar.displayTweetsbyIds()
                }
            } else if (term.startsWith('#')) {
                // Remove the hashtag from the state
                delete state.hashtag;
                delete tweets.data.hashtag
                if(state.account){
                    sidebar.accountToIdsDisplay(state.account, true)
                } else {
                    base.visibleTweetIds = base.initVisibleTweetIds
                    sidebar.displayTweetsbyIds()
                }
            }

            url.pushState(state);
            sidebar.hideID('back-button')
            sidebar.displayTweetsbyIds(null, 1);
            base.stateBefore = null

            tweets.closeSidebar()
            

            //base.setState()

            // After removing term, update display
            const remainingTerms = Array.from(termsContainer.children);
            if (remainingTerms.length > 0) {
                // If terms remain, search for them
                const lastTerm = remainingTerms[remainingTerms.length-1].querySelector('span').textContent;
                if (lastTerm.startsWith('@')) {
                    sidebar.accountToIdsDisplay(lastTerm.slice(1));
                } else if (lastTerm.startsWith('#')) {
                    sidebar.hashtagToIdsDisplay(lastTerm.slice(1));
                }
            } else {
                // If no terms left, show all results
                base.visibleTweetIds = base.initVisibleTweetIds;
                sidebar.displayTweetsbyIds();
            }

            break; // Break the loop since we found and removed the element
        }
    }
}

function handleUserSearch(event) {
    if (event.key === 'Enter') {
        const searchTerm = document.getElementById('user-search').value.trim();
        if (searchTerm.length > 0) {
            document.getElementById('tweets').innerHTML = '';
            sidebar.accountToIdsDisplay(searchTerm);
            displaySearchedTerm(searchTerm, 'user');
            document.getElementById('user-search').value = '';
        }
    }
}

function handleHashtagSearch(event) {
    if (event.key === 'Enter') {
        const searchTerm = document.getElementById('hashtag-search').value.trim();
        if (searchTerm.length > 0) {
            document.getElementById('tweets').innerHTML = '';
            sidebar.hashtagToIdsDisplay(searchTerm);
            displaySearchedTerm(searchTerm, 'hashtag');
            document.getElementById('hashtag-search').value = '';
        }
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    const termsContainer = document.getElementById('searched-terms-container');

    termsContainer.addEventListener('click', function (event) {
        if (event.target.classList.contains('remove-term-btn')) {
            const term = event.target.previousElementSibling.textContent;
            removeSearchedTerm(term, event);
        }
    });

    search.displayInitialSearchedTerms();

    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('keydown', handleUserSearch);
    }

    const hashtagSearch = document.getElementById('hashtag-search');
    if (hashtagSearch) {
        hashtagSearch.addEventListener('keydown', handleHashtagSearch);
    }

    var clearButton = document.querySelector('.clear-btn');
    if (clearButton) {
        clearButton.addEventListener('click', clearSearch);
    }
});


// Function to clear the search
function clearSearch() {
    sidebar.clearSearch()
    sidebar.displayTweetsbyIds(null, 1);
    // Clear the results or reset the display
    // Update the display to show all tweets again
}

let search = {
    displayInitialSearchedTerms: function () {
        const termsContainer = document.getElementById('searched-terms-container');
        if (!termsContainer) return; // Skip if container doesn't exist
        
        const state = url.getState();
    
        // Check if state.account exists and display the account term
        if (state.account) {
            displaySearchedTerm(state.account, 'user');
        } else {
            removeExistingTerms(termsContainer, '@');
        }
    
        // Check if state.hashtag exists and display the hashtag term
        if (state.hashtag) {
            displaySearchedTerm(state.hashtag, 'hashtag');
        } else {
            removeExistingTerms(termsContainer, '#');
        }
    },
    
    init: function() {
        // Wait for DOM to be ready for both desktop and mobile
        const initSearch = () => {
            const userSearch = document.getElementById('user-search');
            const hashtagSearch = document.getElementById('hashtag-search');
            
            if (userSearch) {
                userSearch.addEventListener('keydown', handleUserSearch);
            }
            if (hashtagSearch) {
                hashtagSearch.addEventListener('keydown', handleHashtagSearch);
            }
            
            this.displayInitialSearchedTerms();
        };

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initSearch();
        } else {
            document.addEventListener('DOMContentLoaded', initSearch);
        }
    },
    
    ensureSearchInputs: function() {
        return document.getElementById('user-search') && 
               document.getElementById('hashtag-search') &&
               document.getElementById('searched-terms-container');
    }

}

export default search
