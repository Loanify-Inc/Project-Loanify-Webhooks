const fs = require('fs');
const axios = require('axios');
const path = require('path');
const os = require('os');

// Function to create financial report and trigger webhook
const createFinancialReport = async () => {
  try {
    // ... (Generate financial report data)

    const data = {
      // ... (Generated financial report data)
    };

    // Save the data to a file in the /tmp directory
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, 'financial-report.json');
    fs.writeFileSync(filePath, JSON.stringify(data));

    // Trigger the /receive-financial-report function with a webhook
    const webhookUrl = 'https://harmonious-mike.netlify.app/.netlify/functions/receive-financial-report';
    await axios.post(webhookUrl, { filePath });
    console.log('Webhook sent successfully');
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// Invoke the function
createFinancialReport();
