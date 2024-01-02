const https = require('https');

exports.handler = async (event, context) => {
  const API_KEY = process.env.API_KEY;
  const BASE_URL = 'api.forthcrm.com';
  const contactId = JSON.parse(event.body).contact_id;

  if (!contactId) {
    console.error('Contact ID is required');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Contact ID is required' }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }

  // Function to perform HTTP requests
  function performHttpRequest(options) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject({ statusCode: res.statusCode, message: data });
          }
        });
      });

      req.on('error', (error) => {
        reject({ statusCode: 500, message: error.message });
      });

      req.end();
    });
  }

  try {
    // Get credit report
    const creditReportResponse = await performHttpRequest({
      hostname: BASE_URL,
      path: `/v1/contacts/${contactId}/get_credit_report`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY,
      },
    });
    const creditReport = JSON.parse(creditReportResponse).response.report;

    // Get contact information
    const contactResponse = await performHttpRequest({
      hostname: BASE_URL,
      path: `/v1/contacts/${contactId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': API_KEY,
      },
    });
    const contactInfo = JSON.parse(contactResponse).response;

    // Define the payload object with data from the responses
    const payload = {
      firstName: contactInfo.first_name,
      lastName: contactInfo.last_name,
      preparedBy: "Kevin Kullins",
      creditScore: creditReport.scoreModels.Equifax.score,
      redFlagCodes: creditReport.scoreModels.Equifax.factors.map(factor => {
        const [code, description] = factor.split(" - ", 2);
        return { code: code.trim(), description: description.trim() };
      }),
      debts: "debtDetails", // from your existing code
      creditUtilization: creditReport.revolvingCreditUtilization,
      totalDebt: "totalDebt", // from your existing code
      currentSituation: {
        monthlyPayment: "970",
        payoffTime: "148",
        interestCost: "128,482",
        totalCost: "161,172"
      },
      debtModificationProgram: {
        monthlyPayment: "562",
        payoffTime: "42",
        interestCost: "0",
        totalCost: "23,591"
      }
    };

    return {
      statusCode: 200,
      body: JSON.stringify({ payload }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  } catch (error) {
    console.error('Error:', error.message);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message }),
      headers: { 'Access-Control-Allow-Origin': '*' },
    };
  }
};
