const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');

// Function to create financial report and trigger webhook
exports.handler = async (event, context) => {
  try {
    const {
      firstName,
      lastName,
      preparedBy,
      creditScore,
      redFlagCodes,
      debts,
      creditUtilization,
      totalDebt,
      currentSituation,
      debtModificationProgram,
    } = JSON.parse(event.body);
  
    // Add your logic to process the extracted data and construct the response object
    const processedData = {
      firstName,
      lastName,
      preparedBy,
      creditScore,
      redFlagCodes,
      debts,
      creditUtilization,
      totalDebt,
      currentSituation,
      debtModificationProgram,
      // Add other processed data as needed
    };

    // Save the data to a file in the /tmp directory
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, 'financial-report.json');
    fs.writeFileSync(filePath, JSON.stringify(processedData));

    // Trigger the /receive-financial-report function with a webhook using fetch
    const webhookUrl = 'https://harmonious-mike.netlify.app/.netlify/functions/receive-financial-report';
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ processedData }),
    });

    console.log('Webhook sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Webhook sent successfully' }),
    };
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};