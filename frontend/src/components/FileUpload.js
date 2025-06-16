/**
 * FileUpload component
 * Handles HL7 file upload and conversion
 */
function FileUpload({ apiKey, onConversionComplete }) {
  // DOM elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const hl7TextArea = document.getElementById('hl7TextArea');
  const convertBtn = document.getElementById('convertBtn');
  const clearBtn = document.getElementById('clearBtn');
  const uploadResult = document.getElementById('uploadResult');
  const uploadAlert = document.getElementById('uploadAlert');

  /**
   * Initialize the FileUpload component
   */
  function init() {
    // Set up drag and drop listeners
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // Set up button listeners
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    convertBtn.addEventListener('click', handleConvert);
    clearBtn.addEventListener('click', clearForm);
  }

  /**
   * Handle dragover event on drop zone
   * @param {Event} event - Drag event
   */
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add('active');
  }

  /**
   * Handle dragleave event on drop zone
   * @param {Event} event - Drag event
   */
  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('active');
  }

  /**
   * Handle file drop event
   * @param {Event} event - Drop event
   */
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('active');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }

  /**
   * Handle file selection from input
   * @param {Event} event - Change event
   */
  function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }

  /**
   * Process selected file
   * @param {File} file - Selected file
   */
  function processFile(file) {
    // Read file content
    const reader = new FileReader();
    reader.onload = function(e) {
      hl7TextArea.value = e.target.result;
    };
    reader.readAsText(file);
  }

  /**
   * Handle convert button click
   */
  async function handleConvert() {
    const hl7Content = hl7TextArea.value.trim();
    
    if (!hl7Content) {
      showResult(false, 'Please provide HL7 content to convert');
      return;
    }
    
    showResult(null, 'Converting HL7 to FHIR...');
    
    try {
      const response = await convertHl7(apiKey, hl7Content);
      
      if (response.success) {
        showResult(true, 'Conversion successful');
        
        if (onConversionComplete && typeof onConversionComplete === 'function') {
          onConversionComplete(response.data, response.meta);
        }
      } else {
        showResult(false, `Conversion failed: ${response.message}`);
      }
    } catch (error) {
      console.error('Conversion error:', error);
      showResult(false, `Error: ${error.message}`);
    }
  }

  /**
   * Clear the form
   */
  function clearForm() {
    hl7TextArea.value = '';
    fileInput.value = '';
    uploadResult.style.display = 'none';
  }

  /**
   * Show result message
   * @param {boolean|null} success - Success state (true/false/null)
   * @param {string} message - Message to display
   */
  function showResult(success, message) {
    uploadResult.style.display = 'block';
    
    if (success === true) {
      uploadAlert.className = 'alert alert-success';
    } else if (success === false) {
      uploadAlert.className = 'alert alert-danger';
    } else {
      uploadAlert.className = 'alert alert-info';
    }
    
    uploadAlert.textContent = message;
  }

  return {
    init,
    clearForm
  };
}