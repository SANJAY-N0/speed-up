function extract(idx) {
    // 1. Precise Question Selector
    const qEl = document.querySelector('.question-p pre p') ||
                document.querySelector('.question-p pre') ||
                document.querySelector('.question-p') ||
                document.querySelector('.question-col');

    // 2. Exact Option Extraction (Targets only the 1-per-option label or container)
    const labelElements = document.querySelectorAll('.options-container .mcq-option-label, .Answer-options .mcq-option-label');
    
    let opts = [];
    if (labelElements.length > 0) {
      opts = Array.from(labelElements).map((el, i) => {
        return {
          num: i + 1,
          text: el.innerText.trim().replace(/\s+/g, ' ')
        };
      });
    } else {
      // Fallback: Query unique radio buttons and get their linked labels
      const radios = document.querySelectorAll('.options-container input[type="radio"], input.mcq-questions[type="radio"]');
      opts = Array.from(radios).map((radio, i) => {
        const linkedLabel = document.querySelector(`label[for="${radio.id}"]`) || radio.closest('.form-check');
        return {
          num: i + 1,
          text: linkedLabel ? linkedLabel.innerText.trim().replace(/\s+/g, ' ') : 'N/A'
        };
      });
    }

    return {
      num: idx,
      text: qEl ? qEl.innerText.trim() : 'N/A',
      options: opts
    };
  }
