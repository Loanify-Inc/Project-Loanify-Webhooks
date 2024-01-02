const fs = require('fs');
const axios = require('axios');

exports.handler = async (event, context) => {
  try {
    // ... (Generate financial report data)

    const data = {
      // ... (Generated financial report data)
    };

    // Save the data to a file
    const filePath = 'financial-report.json';
    fs.writeFileSync(filePath, JSON.stringify(data));

    // Trigger the /receive-financial-report function with a webhook
    const webhookUrl = 'https://harmonious-mike.netlify.app/.netlify/functions/receive-financial-report';
    await axios.post(webhookUrl, { filePath });

    console.log('Webhook sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Financial report created and webhook sent successfully' }),
    };
  } catch (error) {
    console.error('Error:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
