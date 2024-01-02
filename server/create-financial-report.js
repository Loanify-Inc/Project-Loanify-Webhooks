const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');  // Use the https module

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

    const processedData = {
      // ... your existing processed data
    };

    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, 'financial-report.json');
    fs.writeFileSync(filePath, JSON.stringify(processedData));

    // Function to send a POST request using https module
    const sendWebhook = (url, data) => {
      return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const req = https.request(options, (res) => {
          res.setEncoding('utf8');
          let responseBody = '';

          res.on('data', (chunk) => {
            responseBody += chunk;
          });

          res.on('end', () => {
            resolve(responseBody);
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.write(JSON.stringify(data));
        req.end();
      });
    };

    const webhookUrl = 'https://harmonious-mike.netlify.app/.netlify/functions/receive-financial-report';
    await sendWebhook(webhookUrl, { processedData });

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